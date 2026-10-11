import { Box3, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { Assembly, ConnectorMating, GeneratorRegistry } from '../src/lib/index';
import type { Connector, GeneratedModel, GeneratorId } from '../src/lib/index';
import { gaugeAndHoseTee, threadedLine } from '../src/stand/assemblies';

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

describe('резьбовые детали (часть 04a)', () => {
  it('11: удлинитель VTr.197 — В слева, Н справа, торцы ±A/2', () => {
    for (const [nominal, a] of [['1/2', 0.02], ['1/2', 0.06], ['3/4', 0.026], ['1', 0.052]] as const) {
      const model = build('steel.extension', { nominal, length: a });
      expect(port(model, 'left')).toMatchObject({ nominal, gender: 'internal', position: { x: -a / 2, y: 0, z: 0 } });
      expect(port(model, 'right')).toMatchObject({ nominal, gender: 'external', position: { x: a / 2, y: 0, z: 0 } });
      expect(model.bounds.max.x - model.bounds.min.x).toBeCloseTo(a, 6);
      model.dispose();
    }
    const generator = registry.get('steel.extension');
    expect(generator.validate({ nominal: '1/2', length: 0.015 }).map((e) => e.param)).toEqual(['length']);
    // Шестигранник S = 24 мм у 1/2: размер по граням.
    const half = build('steel.extension');
    expect(Math.min(half.bounds.max.y - half.bounds.min.y, half.bounds.max.z - half.bounds.min.z)).toBeCloseTo(0.024, 4);
    half.dispose();
  });

  it('12: сгон VTr.653 — длинная резьба L1 справа, разъём контргайки у её начала', () => {
    const model = build('steel.running-nipple', { length: 0.15 });
    expect(port(model, 'left')).toMatchObject({ gender: 'external', position: { x: -0.075, y: 0, z: 0 } });
    expect(port(model, 'right')).toMatchObject({ gender: 'external', position: { x: 0.075, y: 0, z: 0 } });
    expect(port(model, 'locknut').position.x).toBeCloseTo(0.075 - 0.04 + 0.0065, 9);
    expect(port(model, 'locknut').depth).toBeCloseTo(0.0065, 9);
    model.dispose();
    const generator = registry.get('steel.running-nipple');
    expect(generator.validate({ ...generator.defaults, longThread: 0.005, shortThread: 0.002, length: 0.005 }).map((e) => e.param))
      .toEqual(['shortThread', 'longThread', 'length']);
    // Номинала нет в таблице контргаек — разъёма нет.
    const odd = build('steel.running-nipple', { nominal: '3/8' });
    expect(odd.connectors.map((c) => c.id)).toEqual(['left', 'right']);
    odd.dispose();
  });

  it('13: контргайка VTr.656 — толщина A, размер под ключ S, резьба на всю толщину', () => {
    for (const [nominal, a, s] of [['1/2', 0.0065, 0.032], ['1', 0.007, 0.046], ['2', 0.008, 0.075]] as const) {
      const model = build('steel.locknut', { nominal });
      expect(model.bounds.max.x - model.bounds.min.x).toBeCloseTo(a, 6);
      expect(Math.min(model.bounds.max.y - model.bounds.min.y, model.bounds.max.z - model.bounds.min.z)).toBeCloseTo(s, 4);
      expect(port(model, 'thread')).toMatchObject({ nominal, gender: 'internal', depth: a, direction: { x: -1, y: 0, z: 0 } });
      model.dispose();
    }
  });

  it('15: эксцентрик VTr.670 — оси параллельны со смещением 9 мм, чашка Ø55 у стены', () => {
    const model = build('steel.eccentric');
    const left = port(model, 'left');
    const right = port(model, 'right');
    expect(left).toMatchObject({ nominal: '1/2', gender: 'external', direction: { x: -1, y: 0, z: 0 } });
    expect(right).toMatchObject({ nominal: '3/4', gender: 'external', direction: { x: 1, y: 0, z: 0 } });
    expect(right.position.y - left.position.y).toBeCloseTo(0.009, 9);
    expect(right.position.x - left.position.x).toBeCloseTo(0.043, 9);
    expect(model.bounds.max.z - model.bounds.min.z).toBeCloseTo(0.055, 4);
    const bare = build('steel.eccentric', { cup: 'none' });
    expect(bare.connectors).toEqual(model.connectors);
    expect(bare.bounds.max.z - bare.bounds.min.z).toBeLessThan(0.05);
    model.dispose(); bare.dispose();
  });

  it('132: американка v2 — В–В (VTr.340) и Н–Н (VTr.728), гайка разъёма посередине', () => {
    const generator = registry.get('steel.union');
    expect(generator.version).toBe(2);
    for (const [ends, gender, a] of [['internal', 'internal', 0.034], ['external', 'external', 0.048]] as const) {
      const model = build('steel.union', { armLength: a / 2, ends });
      for (const id of ['inlet', 'outlet']) expect(port(model, id).gender).toBe(gender);
      expect(port(model, 'outlet').position.x - port(model, 'inlet').position.x).toBeCloseTo(a, 9);
      model.dispose();
    }
    // Умолчание — прежняя В–Н; у угловой ends не действует.
    const plain = build('steel.union');
    expect([port(plain, 'inlet').gender, port(plain, 'outlet').gender]).toEqual(['internal', 'external']);
    const angle = build('steel.union', { configuration: 'angle', ends: 'external' });
    expect(port(angle, 'inlet').direction).toEqual({ x: 0, y: -1, z: 0 });
    expect(port(angle, 'inlet').gender).toBe('internal');
    // В–В и Н–Н стыкуются друг с другом.
    const a = build('steel.union', { armLength: 0.017, ends: 'internal' });
    const b = build('steel.union', { armLength: 0.024, ends: 'external' });
    expect(ConnectorMating.check(port(a, 'inlet'), port(b, 'outlet')).compatible).toBe(true);
    plain.dispose(); angle.dispose(); a.dispose(); b.dispose();
  });

  it('14: переходной ниппель уже есть — steel.nipple с разными номиналами', () => {
    const model = build('steel.nipple', { nominalLeft: '3/4', nominalRight: '1/2', length: 0.026 });
    expect([port(model, 'left').nominal, port(model, 'right').nominal]).toEqual(['3/4', '1/2']);
    model.dispose();
  });

  it('сборка: контргайка у начала длинной резьбы сгона, муфта на конце, детали не пересекаются', () => {
    const assembly = new Assembly(registry, threadedLine());
    expect(assembly.errors).toEqual([]);
    expect(assembly.joints.every(({ check }) => check.compatible)).toBe(true);
    const box = (name: string) => {
      const part = assembly.parts.find((p) => p.name === name)!;
      return new Box3(new Vector3().copy(part.model.bounds.min), new Vector3().copy(part.model.bounds.max)).applyMatrix4(part.matrix);
    };
    const nut = box('контргайка');
    expect(nut.min.x).toBeCloseTo(0.05 - 0.04, 6);
    expect(nut.max.x).toBeCloseTo(0.05 - 0.04 + 0.0065, 6);
    expect(nut.intersectsBox(box('муфта'))).toBe(false);
    assembly.dispose();
  });

  it('16: переход под манометр — футорка VTr.581 1/2(н) × 1/4(в), манометр 1/4 садится; В–В 1/2 × 1/4 у VALTEC нет', () => {
    const bushing = build('steel.bushing', { outerNominal: '1/2', innerNominal: '1/4', length: 0.014 });
    const gauge = build('equipment.gauge');
    expect(port(bushing, 'left')).toMatchObject({ nominal: '1/2', gender: 'external' });
    expect(ConnectorMating.check(port(bushing, 'right'), port(gauge, 'connection')).compatible).toBe(true);
    bushing.dispose(); gauge.dispose();
  });

  it('17: штуцер VTr.654 — внутренняя резьба, ёлочка под шланг, длина 44 мм', () => {
    for (const [nominal, hose] of [['1/2', '10'], ['1/2', '20'], ['3/4', '20']] as const) {
      const model = build('steel.hose-adapter', { nominal, hoseNominal: hose });
      expect(port(model, 'thread')).toMatchObject({ nominal, joint: 'thread', gender: 'internal', position: { x: -0.022, y: 0, z: 0 } });
      expect(port(model, 'hose')).toMatchObject({ nominal: hose, joint: 'hose-barb', gender: 'external', position: { x: 0.022, y: 0, z: 0 } });
      expect(model.bounds.max.x - model.bounds.min.x).toBeCloseTo(0.044, 6);
      model.dispose();
    }
    const generator = registry.get('steel.hose-adapter');
    expect(generator.validate({ nominal: '1/2', hoseNominal: '14', length: 0.02 }).map((e) => e.param)).toEqual(['length']);
    expect(generator.validate({ nominal: '1/4', hoseNominal: '20', length: 0.044 }).map((e) => e.code)).toContain('incompatible');
  });

  it('сборка 04b: манометр над тройником, штуцер на ниппеле — все стыки совместимы', () => {
    const assembly = new Assembly(registry, gaugeAndHoseTee());
    expect(assembly.errors).toEqual([]);
    expect(assembly.joints.every(({ check }) => check.compatible)).toBe(true);
    const gauge = assembly.parts.find((p) => p.name === 'манометр')!;
    expect(new Vector3().setFromMatrixPosition(gauge.matrix).y).toBeGreaterThan(0.02);
    assembly.dispose();
  });
});
