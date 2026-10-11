import { Box3, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { Assembly, ConnectorMating, GeneratorRegistry } from '../src/lib/index';
import type { Connector, GeneratedModel } from '../src/lib/index';
import { boilerFilter } from '../src/stand/assemblies';

const registry = new GeneratorRegistry();
const port = (model: GeneratedModel, id: string): Connector => model.connectors.find((c) => c.id === id)!;
const positions = (model: GeneratedModel) => Array.from(model.geometry.getAttribute('position').array);
const extent = (model: GeneratedModel, axis: 'x' | 'y' | 'z') => model.bounds.max[axis] - model.bounds.min[axis];

describe('косой фильтр equipment.strainer, версия 2 (позиция 130)', () => {
  const strainer = registry.get('equipment.strainer');

  it('параметры версии 1 строят прежнюю модель В–В (эталон gl2)', () => {
    const legacy = strainer.build({ nominal: '3/4', length: 0.065 });
    const explicit = strainer.build({ nominal: '3/4', length: 0.065, ends: 'internal' });
    expect(positions(explicit)).toEqual(positions(legacy));
    expect(legacy.title).toBe('Фильтр косой 3/4(в-в)');
    legacy.dispose(); explicit.dispose();
  });

  it.each([
    ['external-internal', 'external', 'internal', 'н-в'], ['external', 'external', 'external', 'н-н'],
  ] as const)('%s: пол концов, торцы на прежних местах', (ends, left, right, label) => {
    const base = strainer.build({ nominal: '1/2', length: 0.056 });
    const model = strainer.build({ nominal: '1/2', length: 0.056, ends });
    expect(port(model, 'left')).toMatchObject({ gender: left, joint: 'thread', nominal: '1/2', position: port(base, 'left').position });
    expect(port(model, 'right')).toMatchObject({ gender: right, position: port(base, 'right').position });
    expect(model.title).toBe(`Фильтр косой 1/2(${label})`);
    base.dispose(); model.dispose();
  });

  it('Н–В стыкуется наружным концом с муфтой, внутренним — с ниппелем', () => {
    const model = strainer.build({ nominal: '1/2', length: 0.056, ends: 'external-internal' });
    const coupling = registry.get('steel.coupling').build({ nominalLeft: '1/2', nominalRight: '1/2', length: 0.03 });
    const nipple = registry.get('steel.nipple').build({ nominalLeft: '1/2', nominalRight: '1/2', length: 0.03 });
    expect(ConnectorMating.check(port(model, 'left'), port(coupling, 'right'))).toMatchObject({ compatible: true });
    expect(ConnectorMating.check(port(model, 'right'), port(nipple, 'left'))).toMatchObject({ compatible: true });
    model.dispose(); coupling.dispose(); nipple.dispose();
  });
});

describe('прямой фильтр equipment.strainer-straight (позиция 120, по VALTEC VT.385/387/388)', () => {
  const generator = registry.get('equipment.strainer-straight');

  it.each([
    ['VT.388', 'internal', 0.054, 0.046], ['VT.387', 'external-internal', 0.058, 0.046],
  ] as const)('%s 1/2: длина L и высота H по чертежу, колба вниз', (_, ends, length, height) => {
    const model = generator.build({ nominal: '1/2', ends, length, height, bottom: 'cap' });
    expect(port(model, 'right').position.x - port(model, 'left').position.x).toBeCloseTo(length, 12);
    expect(extent(model, 'x')).toBeCloseTo(length, 6);
    expect(extent(model, 'y')).toBeCloseTo(height, 6);
    expect(model.bounds.min.y).toBeLessThan(-0.02);
    expect(port(model, 'left').gender).toBe(ends === 'internal' ? 'internal' : 'external');
    expect(port(model, 'right').gender).toBe('internal');
    model.dispose();
  });

  it('VT.385: низ колбы — порт G1/2 под пробку или сливной кран', () => {
    const model = generator.build({ nominal: '1/2', ends: 'internal', length: 0.047, height: 0.049, bottom: 'port' });
    const service = port(model, 'service');
    expect(service).toMatchObject({ nominal: '1/2', gender: 'internal', joint: 'thread', direction: { x: 0, y: -1, z: 0 } });
    expect(service.position.y).toBeCloseTo(model.bounds.min.y, 6);
    const drain = registry.get('valve.drain').build({ nominal: '1/2', hoseNominal: '13', length: 0.06 });
    const plug = registry.get('steel.plug').build({ nominal: '1/2', length: 0.022 });
    expect(ConnectorMating.check(service, port(drain, 'inlet'))).toMatchObject({ compatible: true });
    expect(ConnectorMating.check(service, port(plug, 'left'))).toMatchObject({ compatible: true });
    expect(generator.build({ nominal: '1/2', ends: 'internal', length: 0.054, height: 0.046, bottom: 'cap' }).connectors.map((c) => c.id)).toEqual(['left', 'right']);
    model.dispose(); drain.dispose(); plug.dispose();
  });

  it('слишком короткий корпус и колба отклоняются', () => {
    const codes = (params: Parameters<typeof generator.validate>[0]) => generator.validate(params).map((e) => `${e.code}:${e.param}`);
    expect(codes({ ...generator.defaults, nominal: '3/4', length: 0.03 })).toEqual(['too_short:length']);
    expect(codes({ ...generator.defaults, height: 0.03 })).toEqual(['too_short:height']);
  });
});

describe('промывной фильтр equipment.flush-filter (позиция 121, по VALTEC VT.389)', () => {
  const generator = registry.get('equipment.flush-filter');

  it.each([
    ['1/2', 0.054, 0.201], ['3/4', 0.066, 0.225], ['1', 0.078, 0.259],
  ] as const)('%s: длина C = %f м, полная высота B = %f м с манометром', (nominal, length, height) => {
    const model = generator.build({ nominal, gauge: 'manometer' });
    expect(port(model, 'right').position.x - port(model, 'left').position.x).toBeCloseTo(length, 12);
    expect(extent(model, 'y')).toBeCloseTo(height, 6);
    expect(model.connectors.map((c) => c.id)).toEqual(['left', 'right', 'drain']);
    model.dispose();
  });

  it('слив — штуцер под шланг 14 мм внизу; без манометра — свободный порт 1/4 сверху', () => {
    const model = generator.build({ nominal: '3/4', gauge: 'none' });
    expect(port(model, 'drain')).toMatchObject({ joint: 'hose-barb', gender: 'external', nominal: '14', direction: { x: 0, y: -1, z: 0 } });
    expect(port(model, 'drain').position.y).toBeCloseTo(model.bounds.min.y, 6);
    const gauge = port(model, 'gauge');
    expect(gauge).toMatchObject({ nominal: '1/4', gender: 'internal', direction: { x: 0, y: 1, z: 0 } });
    const plug = registry.get('steel.plug').build({ nominal: '1/4', length: 0.02 });
    expect(ConnectorMating.check(gauge, port(plug, 'left'))).toMatchObject({ compatible: true });
    model.dispose(); plug.dispose();
  });
});

describe.each([
  ['equipment.strainer-straight', { nominal: '3/4', ends: 'internal', length: 0.068, height: 0.058, bottom: 'cap' }],
  ['equipment.flush-filter', { nominal: '3/4', gauge: 'manometer' }],
] as const)('замена фильтра в обвязке котла: %s', (id, params) => {
  it('стыки совместимы, фильтр на горизонтали колбой вниз и целиком ниже котла', () => {
    const assembly = new Assembly(registry, boilerFilter(id, params, 'фильтр'));
    expect(assembly.errors).toEqual([]);
    expect(assembly.joints.every(({ check }) => check.compatible)).toBe(true);
    const filter = assembly.parts.find((part) => part.name === 'фильтр')!;
    const boiler = assembly.parts.find((part) => part.name === 'котёл')!;
    // Низ колбы (−Y модели) смотрит вниз.
    expect(new Vector3(0, -1, 0).transformDirection(filter.matrix).y).toBeCloseTo(-1, 9);
    expect(Math.abs(new Vector3(1, 0, 0).transformDirection(filter.matrix).y)).toBeCloseTo(0, 9);
    const box = (part: typeof filter) => new Box3(new Vector3().copy(part.model.bounds.min), new Vector3().copy(part.model.bounds.max)).applyMatrix4(part.matrix);
    expect(box(filter).max.y).toBeLessThan(box(boiler).min.y);
    assembly.dispose();
  });
});
