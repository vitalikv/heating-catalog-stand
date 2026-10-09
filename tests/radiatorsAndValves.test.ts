import { Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import {
  BallValveGenerator,
  BallValveUnionGenerator,
  MaterialLibrary,
  RadiatorVentGenerator,
  RegulatingValveGenerator,
  SteelRadiatorGenerator,
} from '../src/lib/index';
import type { Connector, GeneratedModel, ModelGenerator } from '../src/lib/index';

// Габариты всех наборов сверяются с gl2 в gl2Reference.test.ts; здесь — разъёмы и проверки параметров.
const materials = new MaterialLibrary();
const byId = (model: GeneratedModel, id: string): Connector => model.connectors.find((c) => c.id === id)!;
const codes = <T>(generator: ModelGenerator<T>, params: T) => generator.validate(params).map(({ code, param }) => `${code}:${param}`);

describe('стальной радиатор st_radiator_1', () => {
  const generator = new SteelRadiatorGenerator(materials);

  it('четыре порта с обычной трубной резьбой на межосевом расстоянии', () => {
    const model = generator.build({ size: { x: 0.8, y: 0.5, z: 0.07 }, r1: '1/2' });
    expect(model.connectors.map((c) => c.id)).toEqual(['bottom-left', 'top-left', 'top-right', 'bottom-right']);
    for (const connector of model.connectors) {
      expect(connector).toMatchObject({ joint: 'thread', gender: 'internal', nominal: '1/2', depth: 0.005 });
      expect(Math.abs(connector.position.x)).toBeCloseTo(0.4 + 0.005, 9);
      expect(Math.abs(connector.position.y)).toBeCloseTo(0.25, 9);
    }
    // Высота корпуса — межосевое + 2 × 20 мм окантовки + диаметр порта (21,3 мм).
    const size = model.bounds.getSize(new Vector3());
    expect(size.y).toBeCloseTo(0.5 + 0.04 + 0.0213, 6);
    expect(size.z).toBeCloseTo(0.07, 6);
    expect(model.title).toBe('Ст.радиатор h500 (0.8м)');
  });

  it('размеры вне схемы — ошибки', () => {
    expect(codes(generator, { size: { x: 0.05, y: 0.5, z: 0.07 }, r1: '1/2' })).toEqual(['out_of_range:size.x']);
    expect(codes(generator, { size: { x: 0.8, y: 0.5, z: 0.01 }, r1: '1/2' })).toEqual(['out_of_range:size.z']);
  });
});

describe('воздухоотводчик rad_vozduhotvod_1', () => {
  it('наружная резьба 8 мм слева; без воздухоотводчика — пробка', () => {
    const generator = new RadiatorVentGenerator(materials);
    const vent = generator.build({ r1: '1/2', type: 'vsd' });
    expect(vent.connectors).toEqual([
      expect.objectContaining({ id: 'left', joint: 'thread', gender: 'external', nominal: '1/2', depth: 0.008, position: { x: -0.008, y: 0, z: 0 } }),
    ]);
    expect(vent.title).toBe('воздухоотв.радиаторный 1/2');
    const plug = generator.build({ r1: '1/2', type: 'zgl' });
    // Без диска и бабочки деталь кончается гайкой 5 мм.
    expect(plug.bounds.max.x).toBeCloseTo(0.005, 6);
    expect(plug.title).toBe('заглушка радиаторная 1/2');
  });
});

describe('шаровые краны shar_kran_*', () => {
  const variants = [
    ['n', 'shar_kran_n_1', 'external', 'external', '(н-н)'],
    ['v', 'shar_kran_v_1', 'internal', 'internal', '(в-в)'],
    ['v_n', 'shar_kran_v_n_1', 'internal', 'external', '(в-н)'],
  ] as const;

  it.each(variants)('%s: концы на ±m1/2, глубина — резьба, ручка сверху', (ends, id, left, right, suffix) => {
    const generator = new BallValveGenerator(materials, ends);
    const model = generator.build({ r1: '3/4', m1: 0.07, t1: 0.053 });
    // Резьба крана — 0,4 n корпуса (у н-н n = d − t, иначе n = d), не меньше 12 мм.
    const thread = Math.max(0.4 * (ends === 'n' ? 0.024 : 0.0268), 0.012);
    expect(generator.id).toBe(id);
    expect(byId(model, 'left')).toMatchObject({ gender: left, nominal: '3/4', joint: 'thread' });
    expect(byId(model, 'right')).toMatchObject({ gender: right });
    expect(byId(model, 'left').position.x).toBeCloseTo(-0.035, 9);
    expect(byId(model, 'right').position.x).toBeCloseTo(0.035, 9);
    expect(byId(model, 'left').depth).toBeCloseTo(thread, 9);
    // Бабочка шириной t1 — по X, над корпусом.
    expect(model.bounds.max.y).toBeGreaterThan(0.03);
    expect(model.title).toBe(`Шаровой кран 3/4${suffix}`);
  });

  it('корпус справа нулевой длины — ошибка', () => {
    const generator = new BallValveGenerator(materials, 'v');
    // 1 1/2(в): резьба 0,4 × 48 мм = 19,2 мм; нужно m1 > 2 × (2 мм + резьба).
    const minimum = 2 * (0.002 + 0.4 * 0.048);
    expect(codes(generator, { r1: '1 1/2', m1: minimum - 0.0001, t1: 0.05 })).toEqual(['too_short:m1']);
    expect(codes(generator, { r1: '1 1/2', m1: minimum + 0.0001, t1: 0.05 })).toEqual([]);
  });

  it('с полусгоном: справа наружная резьба r1 на конце сгона', () => {
    const generator = new BallValveUnionGenerator(materials);
    const params = { r1: '1/2', r2: '3/4', m1: 0.055, m2: 0.026, t1: 0.053 };
    const model = generator.build(params);
    const right = byId(model, 'right');
    // Резьба сгона: 1,5 × 0,4 × n(1/2, н) = 1,5 × 0,4 × 18,6 мм.
    expect(right).toMatchObject({ gender: 'external', nominal: '1/2' });
    expect(right.depth).toBeCloseTo(1.5 * 0.4 * 0.0186, 9);
    expect(right.position.x).toBeCloseTo(model.bounds.max.x, 6);
    expect(byId(model, 'left')).toMatchObject({ gender: 'internal', nominal: '1/2' });
    expect(model.title).toBe('Шаровой кран с полусгоном 1/2');
    // Гладкий участок сгона: m2 − 1,5 × 7,44 мм − 2 мм.
    expect(codes(generator, { ...params, m2: 0.013 })).toEqual(['too_short:m2']);
    expect(codes(generator, { ...params, m2: 0.0135 })).toEqual([]);
  });
});

describe('кран регулировочный reg_kran_primoy_1', () => {
  const generator = new RegulatingValveGenerator(materials);
  const params = { r1: '1/2', r2: '3/4', m1: 0.055, m2: 0.02, head: 'cap' } as const;

  it('головка — колпачок или терморегулятор, разъёмы одинаковые', () => {
    const cap = generator.build(params);
    const termo = generator.build({ ...params, head: 'termo' });
    expect(cap.title).toBe('Кран регулировочный 1/2');
    expect(termo.title).toBe('Клапан с терморегулятором 1/2');
    expect(termo.connectors).toEqual(cap.connectors);
    // Терморегулятор выше колпачка: 6 + 10 + 35 мм против 2 + 20 мм над штоком.
    expect(termo.bounds.max.y - cap.bounds.max.y).toBeCloseTo(0.051 - 0.022, 6);
    expect(byId(cap, 'left')).toMatchObject({ gender: 'internal', nominal: '1/2', depth: 0.012 });
    expect(byId(cap, 'left').position.x).toBeCloseTo(-0.0275, 9);
    // Справа — сгон с наружной резьбой r1: 1,5 × 0,4 × 18,6 мм.
    expect(byId(cap, 'right')).toMatchObject({ gender: 'external', nominal: '1/2' });
    expect(byId(cap, 'right').depth).toBeCloseTo(1.5 * 0.4 * 0.0186, 9);
  });

  it('ошибки параметров', () => {
    // Корпус между переходами: m1 > 4 × 2 мм + 2 × 12 мм.
    expect(codes(generator, { ...params, m1: 0.032 })).toEqual(['too_short:m1']);
    expect(codes(generator, { ...params, m1: 0.0325 })).toEqual([]);
    expect(codes(generator, { ...params, head: 'none' as 'cap' })).toEqual(['unknown_option:head']);
  });
});
