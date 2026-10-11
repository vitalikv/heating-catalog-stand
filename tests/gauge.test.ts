import { describe, expect, it } from 'vitest';
import { ConnectorMating, GeneratorRegistry } from '../src/lib/index';
import type { Connector, GaugeParams, GeneratedModel } from '../src/lib/index';

const registry = new GeneratorRegistry();
const generator = registry.get('equipment.gauge');
const port = (model: GeneratedModel): Connector => model.connectors.find((c) => c.id === 'connection')!;
const build = (params: Partial<GaugeParams>) => generator.build({ ...generator.defaults, ...params });

describe('показывающий прибор equipment.gauge (позиции 79, 80, 96)', () => {
  it.each([[40, 'top'], [63, 'bottom'], [100, 'back']] as const)('Ø%s: корпус по диаметру, циферблат вперёд', (diameter, connection) => {
    const model = build({ diameter, connection, nominal: '1/4' });
    expect(model.bounds.max.x - model.bounds.min.x).toBeCloseTo(diameter / 1000 + 0.002, 6);
    expect(model.bounds.max.z).toBeCloseTo(0.003, 9);
    expect(model.materials).toContain('manometer');
    model.dispose();
  });

  it.each([
    ['bottom', { x: 0, y: -1, z: 0 }], ['top', { x: 0, y: 1, z: 0 }], ['back', { x: 0, y: 0, z: -1 }],
  ] as const)('подключение %s: наружная резьба смотрит наружу, торец — крайняя точка штуцера', (connection, direction) => {
    const model = build({ connection });
    const c = port(model);
    expect(c).toMatchObject({ joint: 'thread', gender: 'external', nominal: '1/4', direction });
    const axis = (['x', 'y', 'z'] as const).find((key) => direction[key] !== 0)!;
    const extreme = direction[axis] < 0 ? model.bounds.min[axis] : model.bounds.max[axis];
    expect(c.position[axis]).toBeCloseTo(extreme, 6);
    model.dispose();
  });

  it('термометр: погружная часть уходит за торец резьбы, разъём не меняется', () => {
    const short = build({ kind: 'thermometer', connection: 'back', nominal: '1/2', probe: 0.05 });
    const long = build({ kind: 'thermometer', connection: 'back', nominal: '1/2', probe: 0.1 });
    expect(port(long)).toEqual(port(short));
    expect(port(short).position.z - short.bounds.min.z).toBeCloseTo(0.05, 6);
    expect(short.bounds.min.z - long.bounds.min.z).toBeCloseTo(0.05, 6);
    expect(short.materials).toContain('thermometer');
    expect(short.title).toBe('Термометр осевой Ø63, G1/2(н), погружная 50 мм');
    short.dispose(); long.dispose();
  });

  it('погружная часть — только у термометра', () => {
    const a = build({ kind: 'manometer', probe: 0.05 });
    const b = build({ kind: 'manometer', probe: 0.1 });
    expect(Array.from(b.geometry.getAttribute('position').array)).toEqual(Array.from(a.geometry.getAttribute('position').array));
    a.dispose(); b.dispose();
  });

  it('термоманометр: свой циферблат', () => {
    const model = build({ kind: 'thermomanometer', diameter: 80, nominal: '1/2' });
    expect(model.materials).toContain('thermomanometer');
    expect(model.materials).not.toContain('manometer');
    model.dispose();
  });

  it('UV циферблата масштабированы к эталонному диску 59,4 мм: шкала целиком на циферблате', () => {
    for (const diameter of [40, 100] as const) {
      const model = build({ diameter, connection: 'back' });
      const group = model.geometry.groups.find((g) => model.materials[g.materialIndex!] === 'manometer')!;
      const uv = model.geometry.getAttribute('uv');
      let max = 0;
      for (let i = group.start; i < group.start + group.count; i++) max = Math.max(max, Math.abs(uv.getX(i)), Math.abs(uv.getY(i)));
      expect(max, `Ø${diameter}`).toBeCloseTo(0.0594 / 2, 3);
      model.dispose();
    }
  });

  it('стыкуется с портом манометра промывного фильтра и с муфтой 1/2', () => {
    const gauge = build({ connection: 'bottom', nominal: '1/4' });
    const filter = registry.get('equipment.flush-filter').build({ nominal: '1/2', gauge: 'none' });
    const filterPort = filter.connectors.find((c) => c.id === 'gauge')!;
    expect(ConnectorMating.check(filterPort, port(gauge))).toMatchObject({ compatible: true });
    const thermometer = build({ kind: 'thermometer', connection: 'back', nominal: '1/2' });
    const coupling = registry.get('steel.coupling').build({ nominalLeft: '1/2', nominalRight: '1/2', length: 0.03 });
    expect(ConnectorMating.check(coupling.connectors[0], port(thermometer))).toMatchObject({ compatible: true });
    expect(ConnectorMating.check(filterPort, port(thermometer))).toMatchObject({ compatible: false, reason: 'nominal' });
    gauge.dispose(); filter.dispose(); thermometer.dispose(); coupling.dispose();
  });

  it('резьба 1/2 сбоку малого корпуса отклоняется', () => {
    const codes = (params: Partial<GaugeParams>) => generator.validate({ ...generator.defaults, ...params }).map((e) => `${e.code}:${e.param}`);
    expect(codes({ diameter: 40, connection: 'bottom', nominal: '1/2' })).toEqual(['too_small:diameter']);
    expect(codes({ diameter: 80, connection: 'bottom', nominal: '1/2' })).toEqual([]);
  });
});
