import { Box3, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { Assembly, ConnectorMating, GeneratorRegistry } from '../src/lib/index';
import type { Connector, GeneratedModel, GeneratorId } from '../src/lib/index';
import { ppBrassValves, ppLine } from '../src/stand/assemblies';

const registry = new GeneratorRegistry();
const port = (model: GeneratedModel, id: string): Connector => {
  const found = model.connectors.find((c) => c.id === id);
  if (!found) throw new Error(`нет порта ${id}`);
  return found;
};
const build = (id: GeneratorId, params: object = {}) => {
  const generator = registry.get(id);
  return generator.build({ ...(generator.defaults as object), ...params } as never);
};
const pipeEnd = () => {
  const pipe = build('pp.pipe', { nominal: '20', length: 0.1 });
  const end = port(pipe, 'end');
  pipe.dispose();
  return end;
};

describe('ПП-фитинги (часть 05a)', () => {
  it('29: заглушка VTp.790 — раструб B, глухое дно, длина A', () => {
    for (const [nominal, a, b] of [['20', 0.0215, 0.015], ['32', 0.0275, 0.0185], ['75', 0.058, 0.03]] as const) {
      const model = build('pp.cap', { nominal, length: a });
      expect(port(model, 'socket')).toMatchObject({ nominal, joint: 'pp-socket', gender: 'internal', depth: b, position: { x: 0, y: 0, z: 0 } });
      expect(model.bounds.max.x - model.bounds.min.x).toBeCloseTo(a, 6);
      model.dispose();
    }
    expect(ConnectorMating.check(pipeEnd(), { ...pipeEnd(), gender: 'internal', depth: 0.015 }).compatible).toBe(true);
    expect(registry.get('pp.cap').validate({ nominal: '20', length: 0.016 }).map((e) => e.param)).toEqual(['length']);
  });

  it.each([
    ['socket', 0.042, { joint: 'pp-socket', gender: 'internal', nominal: '20' }],
    ['external', 0.045, { joint: 'thread', gender: 'external', nominal: '1/2' }],
    ['internal', 0.035, { joint: 'thread', gender: 'internal', nominal: '1/2' }],
    ['nut', 0.057, { joint: 'thread', gender: 'internal', nominal: '1/2' }],
  ] as const)('30: разъёмное соединение, второй конец %s — длина A по VALTEC, раструб слева', (end, a, right) => {
    const model = build('pp.union', { end, length: a });
    expect(port(model, 'left')).toMatchObject({ nominal: '20', joint: 'pp-socket', gender: 'internal', depth: 0.015 });
    expect(port(model, 'right')).toMatchObject(right);
    expect(port(model, 'right').position.x - port(model, 'left').position.x).toBeCloseTo(a, 9);
    model.dispose();
  });

  it('81: угольник с накидной гайкой VTp.758 — раструб вверх на A, гайка вправо на C', () => {
    const model = build('pp.nut-elbow', { pipeNominal: '25', threadNominal: '3/4', socketArm: 0.031, nutArm: 0.0495 });
    expect(port(model, 'socket')).toMatchObject({ nominal: '25', joint: 'pp-socket', direction: { x: 0, y: 1, z: 0 } });
    expect(port(model, 'socket').position.y).toBeCloseTo(0.031, 9);
    expect(port(model, 'nut')).toMatchObject({ nominal: '3/4', joint: 'thread', gender: 'internal', direction: { x: 1, y: 0, z: 0 } });
    expect(port(model, 'nut').position.x).toBeCloseTo(0.0495, 9);
    model.dispose();
    expect(registry.get('pp.nut-elbow').validate({ pipeNominal: '20', threadNominal: '1/2', socketArm: 0.01, nutArm: 0.01 })
      .map((e) => e.param)).toEqual(['socketArm', 'nutArm']);
  });

  it.each([
    ['socket', 'plastic', 'pp-socket'],
    ['union-internal', 'metal', 'thread'],
    ['union', 'metal', 'pp-socket'],
  ] as const)('32: кран %s — корпус %s, справа %s, ручка на высоте H', (ends, material, rightJoint) => {
    const model = build('pp.ball-valve', { ends, length: 0.07, height: 0.036, handleLength: 0.08 });
    expect(port(model, 'left')).toMatchObject({ nominal: '20', joint: 'pp-socket', gender: 'internal' });
    expect(port(model, 'right').joint).toBe(rightJoint);
    expect(model.bounds.max.y).toBeCloseTo(0.036, 6);
    expect(model.materials).toContain(material);
    expect(model.materials).toContain(ends === 'socket' ? 'blue' : 'red');
    model.dispose();
  });

  it('сборки: все стыки совместимы, ручки кранов вверх', () => {
    for (const definition of [ppLine(), ppBrassValves()]) {
      const assembly = new Assembly(registry, definition);
      expect(assembly.errors).toEqual([]);
      expect(assembly.joints.every(({ check }) => check.compatible), definition.label).toBe(true);
      for (const part of assembly.parts.filter((p) => p.name.startsWith('кран'))) {
        const box = new Box3(new Vector3().copy(part.model.bounds.min), new Vector3().copy(part.model.bounds.max)).applyMatrix4(part.matrix);
        expect(box.max.y, part.name).toBeGreaterThan(0.03);
      }
      assembly.dispose();
    }
  });
});
