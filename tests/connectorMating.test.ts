import { Matrix4, Quaternion, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import {
  AluminiumRadiatorGenerator,
  ConnectorMating,
  RadiatorPortFittingGenerator,
  SteelCouplingGenerator,
  SteelNippleGenerator,
} from '../src/lib/index';
import type { Connector } from '../src/lib/index';

const coupling = new SteelCouplingGenerator();
const nipple = new SteelNippleGenerator();
const radiator = new AluminiumRadiatorGenerator();
const plug = new RadiatorPortFittingGenerator();

const byId = (connectors: Connector[], id: string) => connectors.find((c) => c.id === id)!;

/** Мировые торец, направление и up разъёма детали, стоящей в matrix. */
function world(connector: Connector, matrix: Matrix4) {
  return {
    position: new Vector3().copy(connector.position).applyMatrix4(matrix),
    direction: new Vector3().copy(connector.direction).transformDirection(matrix),
    up: new Vector3().copy(connector.up).transformDirection(matrix),
  };
}

describe('ConnectorMating.check', () => {
  const mufta = coupling.build({ nominalLeft: '1/2', nominalRight: '1/2', length: 0.03 }).connectors;
  const nip = nipple.build({ nominalLeft: '1/2', nominalRight: '1', length: 0.034 }).connectors;
  const rad = radiator.build({ sections: 1, dimensions: { x: 0.08, y: 0.5, z: 0.08 }, nominal: '1' }).connectors;
  const adapter = plug.build({ kind: 'adapter', portNominal: '1', outletNominal: '1/2' }).connectors;

  it('внутренняя и наружная резьба одного номинала совместимы', () => {
    expect(ConnectorMating.check(byId(mufta, 'right'), byId(nip, 'left'))).toEqual({ compatible: true, engagement: 0.008 });
    expect(ConnectorMating.check(byId(rad, 'top-right'), byId(adapter, 'radiator'))).toMatchObject({ compatible: true });
    expect(ConnectorMating.check(byId(adapter, 'outlet'), byId(nip, 'left'))).toMatchObject({ compatible: true });
  });

  it('несовместимые пары и причина', () => {
    // Обычная резьба 1 не подходит к порту радиатора, хотя номинал тот же.
    expect(ConnectorMating.check(byId(rad, 'top-right'), byId(nip, 'right'))).toMatchObject({ compatible: false, reason: 'joint' });
    expect(ConnectorMating.check(byId(mufta, 'right'), byId(nip, 'right'))).toMatchObject({ compatible: false, reason: 'nominal' });
    expect(ConnectorMating.check(byId(mufta, 'left'), byId(mufta, 'right'))).toMatchObject({ compatible: false, reason: 'gender' });
  });
});

describe('ConnectorMating.place', () => {
  it('направления противоположны, наружная деталь входит на min(depth)', () => {
    const fixed = coupling.build({ nominalLeft: '1/2', nominalRight: '1/2', length: 0.03 });
    const moving = nipple.build({ nominalLeft: '1/2', nominalRight: '1/2', length: 0.022 });
    const fixedConnector = byId(fixed.connectors, 'right');
    const movingConnector = byId(moving.connectors, 'left');

    const matrix = ConnectorMating.place(fixedConnector, new Matrix4(), movingConnector);
    const a = world(fixedConnector, new Matrix4());
    const b = world(movingConnector, matrix);
    const engagement = Math.min(fixedConnector.depth, movingConnector.depth);

    expect(b.direction.dot(a.direction)).toBeCloseTo(-1, 9);
    expect(b.position.distanceTo(a.position.clone().addScaledVector(a.direction, -engagement))).toBeLessThan(1e-9);
  });

  it('учитывает поворот и сдвиг неподвижной детали', () => {
    const fixed: Connector = { id: 'f', position: { x: 0.1, y: 0, z: 0 }, direction: { x: 1, y: 0, z: 0 }, up: { x: 0, y: 1, z: 0 }, depth: 0.01, nominal: '1', joint: 'thread', gender: 'internal' };
    const moving: Connector = { id: 'm', position: { x: 0, y: 0.02, z: 0 }, direction: { x: 0, y: 1, z: 0 }, up: { x: 1, y: 0, z: 0 }, depth: 0.006, nominal: '1', joint: 'thread', gender: 'external' };
    const fixedMatrix = new Matrix4().compose(
      new Vector3(1, 2, 3),
      new Quaternion().setFromAxisAngle(new Vector3(0, 0, 1), Math.PI / 2),
      new Vector3(1, 1, 1),
    );

    const matrix = ConnectorMating.place(fixed, fixedMatrix, moving);
    const a = world(fixed, fixedMatrix);
    const b = world(moving, matrix);

    // Неподвижный разъём после поворота смотрит в +Y из точки (1, 2.1, 3).
    expect(a.position.distanceTo(new Vector3(1, 2.1, 3))).toBeLessThan(1e-9);
    expect(b.direction.dot(a.direction)).toBeCloseTo(-1, 9);
    expect(b.position.distanceTo(new Vector3(1, 2.1 - 0.006, 3))).toBeLessThan(1e-9);
  });

  it('встречные направления без поворота: переходник в правый порт радиатора', () => {
    const rad = radiator.build({ sections: 3, dimensions: { x: 0.08, y: 0.5, z: 0.08 }, nominal: '1' });
    const adapter = plug.build({ kind: 'plug', portNominal: '1' });
    const port = byId(rad.connectors, 'top-right');
    const matrix = ConnectorMating.place(port, new Matrix4(), byId(adapter.connectors, 'radiator'));

    const position = new Vector3();
    const rotation = new Quaternion();
    matrix.decompose(position, rotation, new Vector3());
    expect(rotation.angleTo(new Quaternion())).toBeLessThan(1e-9);
    // Резьба переходника (8 мм) короче резьбы порта (21 мм): входит на 8 мм.
    expect(position.x + byId(adapter.connectors, 'radiator').position.x).toBeCloseTo(port.position.x - 0.008, 9);
  });

  it('up подвижной детали совпадает с up неподвижной', () => {
    const fixed: Connector = { id: 'f', position: { x: 0, y: 0, z: 0 }, direction: { x: 0, y: 0, z: 1 }, up: { x: 1, y: 0, z: 0 }, depth: 0.01, nominal: '1', joint: 'thread', gender: 'internal' };
    const moving: Connector = { id: 'm', position: { x: 0, y: 0, z: 0 }, direction: { x: 0, y: 1, z: 0 }, up: { x: 0, y: 0, z: -1 }, depth: 0.01, nominal: '1', joint: 'thread', gender: 'external' };
    const a = world(fixed, new Matrix4());
    const b = world(moving, ConnectorMating.place(fixed, new Matrix4(), moving));
    expect(b.direction.dot(a.direction)).toBeCloseTo(-1, 9);
    expect(b.up.dot(a.up)).toBeCloseTo(1, 9);
  });

  it('одинаковые направления: разворот на 180° не переворачивает up', () => {
    // setFromUnitVectors для противоположных векторов выбирает ось произвольно — доворот это исправляет.
    const right = byId(coupling.build({ nominalLeft: '1/2', nominalRight: '1/2', length: 0.03 }).connectors, 'right');
    const nippleRight = byId(nipple.build({ nominalLeft: '1/2', nominalRight: '1/2', length: 0.022 }).connectors, 'right');
    const b = world(nippleRight, ConnectorMating.place(right, new Matrix4(), nippleRight));
    expect(b.direction.x).toBeCloseTo(-1, 9);
    expect(b.up.y).toBeCloseTo(1, 9);
  });

  it('угол стыка поворачивает деталь вокруг оси разъёма', () => {
    const fixed = byId(coupling.build({ nominalLeft: '1/2', nominalRight: '1/2', length: 0.03 }).connectors, 'right');
    const moving = byId(nipple.build({ nominalLeft: '1/2', nominalRight: '1/2', length: 0.022 }).connectors, 'left');
    const plain = ConnectorMating.place(fixed, new Matrix4(), moving);
    const turned = ConnectorMating.place(fixed, new Matrix4(), moving, Math.PI / 2);
    const b = world(moving, turned);

    // Ось — +X: up +Y поворачивается в +Z, торец остаётся на месте.
    expect(b.up.distanceTo(new Vector3(0, 0, 1))).toBeLessThan(1e-9);
    expect(b.position.distanceTo(world(moving, plain).position)).toBeLessThan(1e-9);
  });
});
