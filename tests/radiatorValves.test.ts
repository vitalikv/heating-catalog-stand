import { Box3, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { Assembly, ConnectorMating, GeneratorRegistry } from '../src/lib/index';
import { radiatorAxialValve, radiatorStraightValves } from '../src/stand/assemblies';
import type { Connector, GeneratedModel, GeneratorId } from '../src/lib/index';

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

describe('радиаторная арматура (часть 24)', () => {
  it('45: прямой термоклапан VT.032 — порты на одной оси, A и B по каталогу', () => {
    for (const [nominal, a, b] of [['1/2', 0.082, 0.055], ['3/4', 0.0975, 0.0655]] as const) {
      const model = build('valve.thermostatic-straight', { nominal, inletLength: a - b, radiatorLength: b });
      const inlet = port(model, 'inlet');
      const radiator = port(model, 'radiator');
      expect(inlet.direction).toEqual({ x: -1, y: 0, z: 0 });
      expect(radiator.direction).toEqual({ x: 1, y: 0, z: 0 });
      expect(radiator.position.x - inlet.position.x).toBeCloseTo(a, 9);
      expect(radiator.position.x).toBeCloseTo(b, 9);
      expect([inlet.position.y, inlet.position.z, radiator.position.y, radiator.position.z]).toEqual([0, 0, 0, 0]);
      expect(inlet).toMatchObject({ nominal, joint: 'thread', gender: 'internal' });
      expect(radiator).toMatchObject({ nominal, joint: 'thread', gender: 'external' });
      expect(model.connectors).toHaveLength(2);
      model.dispose();
    }
  });

  it('98: осевой термоклапан VT.179 — вход снизу, головка соосна выходу и смотрит от радиатора', () => {
    const model = build('valve.thermostatic-axial', { head: 'none' });
    expect(port(model, 'inlet').direction).toEqual({ x: 0, y: -1, z: 0 });
    expect(port(model, 'inlet').position.y).toBeCloseTo(-0.026, 9);
    expect(port(model, 'radiator').position.x).toBeCloseTo(0.0535, 9);
    const head = port(model, 'head');
    expect(head.direction).toEqual({ x: -1, y: 0, z: 0 });
    expect([head.position.y, head.position.z]).toEqual([0, 0]);
    const cap = build('valve.thermostatic-axial');
    expect(cap.bounds.min.x).toBeLessThan(-0.02);
    expect(cap.bounds.max.y).toBeLessThan(0.02);
    model.dispose(); cap.dispose();
  });

  it.each([
    ['valve.thermostatic-angle', { x: 0, y: 1, z: 0 }],
    ['valve.thermostatic-straight', { x: 0, y: 1, z: 0 }],
    ['valve.thermostatic-axial', { x: -1, y: 0, z: 0 }],
  ] as const)('97: %s без головки — посадочное место M30×1,5, на него садятся термоголовка и привод', (id, direction) => {
    const valve = build(id, { head: 'none' });
    const seat = port(valve, 'head');
    expect(seat).toMatchObject({ nominal: 'M30x1.5', joint: 'valve-head', gender: 'external', direction });
    for (const accessory of ['valve.thermostatic-head', 'valve.thermoelectric-actuator'] as const) {
      const model = build(accessory);
      expect(ConnectorMating.check(seat, port(model, 'valve')).compatible).toBe(true);
      model.dispose();
    }
    // Порты подключения не зависят от головки.
    const cap = build(id, { head: 'cap' });
    expect(valve.connectors.slice(0, 2)).toEqual(cap.connectors);
    valve.dispose(); cap.dispose();
  });

  it('97: термоголовка VT.5000 — диаметр 50 мм, высота 76–81 мм по шкале, не садится на трубную резьбу', () => {
    const low = build('valve.thermostatic-head', { setting: '*' });
    const high = build('valve.thermostatic-head', { setting: '5' });
    expect(low.bounds.max.y - low.bounds.min.y).toBeCloseTo(0.076, 6);
    expect(high.bounds.max.y - high.bounds.min.y).toBeCloseTo(0.081, 6);
    expect(high.bounds.max.x - high.bounds.min.x).toBeCloseTo(0.05, 3);
    const valve = port(high, 'valve');
    expect(valve.position).toEqual({ x: 0, y: 0, z: 0 });
    expect(valve.direction).toEqual({ x: 0, y: -1, z: 0 });
    const manifold = build('manifold.brass', { inserts: 'thermostatic', head: 'none' });
    expect(ConnectorMating.check(port(manifold, 'head-1'), valve).compatible).toBe(true);
    const nipple = build('steel.nipple');
    expect(ConnectorMating.check(port(nipple, 'left'), valve)).toMatchObject({ compatible: false, reason: 'joint' });
    low.dispose(); high.dispose(); manifold.dispose(); nipple.dispose();
  });

  it.each([
    ['valve.thermostatic-angle', {}],
    ['valve.thermostatic-straight', {}],
    ['valve.lockshield', { configuration: 'angle' }],
    ['valve.lockshield', { configuration: 'straight' }],
  ] as const)('131: %s %o с евроконусом 3/4 — стыкуется с адаптером МП, радиаторная сторона 1/2', (id, extra) => {
    const valve = build(id, { ...extra, pipeEnd: 'eurocone' });
    const inlet = port(valve, 'inlet');
    expect(inlet).toMatchObject({ nominal: '3/4', joint: 'eurocone', gender: 'external' });
    expect(port(valve, 'radiator')).toMatchObject({ nominal: '1/2', joint: 'thread', gender: 'external' });
    const adapter = build('mp.eurocone-adapter');
    expect(ConnectorMating.check(inlet, port(adapter, 'eurocone')).compatible).toBe(true);
    const pipe = build('mp.pipe');
    expect(ConnectorMating.check(inlet, port(pipe, 'start')).compatible).toBe(false);
    expect(valve.title).toContain('3/4 ЕК');
    valve.dispose(); adapter.dispose(); pipe.dispose();
  });

  it('131: евроконус только у клапанов 1/2 (VALTEC *.NER 1/2 × 3/4 ЕК)', () => {
    const generator = registry.get('valve.thermostatic-straight');
    expect(generator.validate({ ...generator.defaults, nominal: '3/4', pipeEnd: 'eurocone' }))
      .toEqual([expect.objectContaining({ code: 'incompatible', param: 'pipeEnd' })]);
    const lockshield = registry.get('valve.lockshield');
    expect(lockshield.validate({ ...lockshield.defaults, nominal: '3/4', pipeEnd: 'eurocone' }))
      .toEqual([expect.objectContaining({ code: 'incompatible', param: 'pipeEnd' })]);
  });

  it('версия 2 углового и клапана обратки: параметры версии 1 дополняются pipeEnd internal', () => {
    for (const [id, params] of [
      ['valve.thermostatic-angle', { nominal: '1/2', armLength: 0.04, head: 'thermostatic' }],
      ['valve.lockshield', { nominal: '1/2', armLength: 0.035, configuration: 'angle' }],
    ] as const) {
      const generator = registry.get(id);
      expect(generator.version).toBe(2);
      const legacy = generator.build(params as never);
      const current = generator.build({ ...params, pipeEnd: 'internal' } as never);
      expect(Array.from(legacy.geometry.getAttribute('position').array)).toEqual(Array.from(current.geometry.getAttribute('position').array));
      expect(legacy.connectors).toEqual(current.connectors);
      legacy.dispose(); current.dispose();
    }
  });

  it('короткие плечи: у новых клапанов ошибка по каждому плечу, у старых — одна по armLength', () => {
    const straight = registry.get('valve.thermostatic-straight');
    expect(straight.validate({ ...straight.defaults, inletLength: 0.01, radiatorLength: 0.01 }).map((e) => e.param))
      .toEqual(['inletLength', 'radiatorLength']);
    // Евроконус длиннее внутренней резьбы: плечо VT.032 1/2 к трубе (27 мм) годится и для него.
    expect(straight.validate({ ...straight.defaults, pipeEnd: 'eurocone' })).toEqual([]);
    const angle = registry.get('valve.thermostatic-angle');
    expect(angle.validate({ ...angle.defaults, armLength: 0.01 }).map((e) => e.param)).toEqual(['armLength']);
  });

  describe('сборки стенда', () => {
    const placed = (assembly: Assembly, name: string) => {
      const part = assembly.parts.find((p) => p.name === name);
      if (!part) throw new Error(`нет детали ${name}`);
      return part;
    };
    const worldDirection = (assembly: Assembly, name: string, id: string) =>
      new Vector3().copy(port(placed(assembly, name).model, id).direction).transformDirection(placed(assembly, name).matrix);
    const worldBox = (assembly: Assembly, name: string) => {
      const { model, matrix } = placed(assembly, name);
      return new Box3(new Vector3().copy(model.bounds.min), new Vector3().copy(model.bounds.max)).applyMatrix4(matrix);
    };

    it('прямой термоклапан: головка вверх, трубы МП уходят от радиатора, головка не задевает радиатор', () => {
      const assembly = new Assembly(registry, radiatorStraightValves());
      expect(assembly.joints.every(({ check }) => check.compatible)).toBe(true);
      expect(worldDirection(assembly, 'термоклапан', 'head').y).toBeCloseTo(1, 9);
      expect(worldDirection(assembly, 'термоклапан', 'inlet').x).toBeCloseTo(1, 9);
      expect(worldDirection(assembly, 'обратка', 'inlet').x).toBeCloseTo(1, 9);
      expect(worldBox(assembly, 'термоголовка').intersectsBox(worldBox(assembly, 'радиатор'))).toBe(false);
      expect(worldBox(assembly, 'термоголовка').min.y).toBeGreaterThan(worldBox(assembly, 'термоклапан').min.y);
      assembly.dispose();
    });

    it('осевой термоклапан: вход снизу, сервопривод соосен выходу и стоит дальше от радиатора', () => {
      const assembly = new Assembly(registry, radiatorAxialValve());
      expect(assembly.joints.every(({ check }) => check.compatible)).toBe(true);
      expect(worldDirection(assembly, 'термоклапан', 'inlet').y).toBeCloseTo(-1, 9);
      expect(worldDirection(assembly, 'термоклапан', 'head').x).toBeCloseTo(1, 9);
      const actuator = worldBox(assembly, 'сервопривод');
      expect(actuator.intersectsBox(worldBox(assembly, 'радиатор'))).toBe(false);
      expect(actuator.min.x).toBeGreaterThan(worldBox(assembly, 'радиатор').max.x);
      assembly.dispose();
    });
  });
});
