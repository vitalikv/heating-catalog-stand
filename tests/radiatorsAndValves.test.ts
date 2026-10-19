import { Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import type { Connector, GeneratedModel, ModelGenerator } from '../src/lib/index';
import { RadiatorVentGenerator } from '../src/lib/generators/radiator/RadiatorVentGenerator';
import { SteelRadiatorGenerator } from '../src/lib/generators/radiator/SteelRadiatorGenerator';
import { BallValveGenerator } from '../src/lib/generators/valve/BallValveGenerator';
import { BallValveUnionGenerator } from '../src/lib/generators/valve/BallValveUnionGenerator';
import { RegulatingValveGenerator } from '../src/lib/generators/valve/RegulatingValveGenerator';
import { boundsBox } from './modelHelpers';

// Габариты всех наборов сверяются с gl2 в gl2Reference.test.ts; здесь — разъёмы и проверки параметров.
const byId = (model: GeneratedModel, id: string): Connector => model.connectors.find((c) => c.id === id)!;
const codes = <T>(generator: ModelGenerator<T>, params: T) => generator.validate(params).map(({ code, param }) => `${code}:${param}`);

describe('стальной радиатор radiator.steel', () => {
  const generator = new SteelRadiatorGenerator();

  it('четыре порта с обычной трубной резьбой на межосевом расстоянии', () => {
    const model = generator.build({ dimensions: { x: 0.8, y: 0.5, z: 0.07 }, nominal: '1/2' });
    expect(model.connectors.map((c) => c.id)).toEqual(['bottom-left', 'top-left', 'top-right', 'bottom-right']);
    for (const connector of model.connectors) {
      expect(connector).toMatchObject({ joint: 'thread', gender: 'internal', nominal: '1/2', depth: 0.005 });
      expect(Math.abs(connector.position.x)).toBeCloseTo(0.4 + 0.005, 9);
      expect(Math.abs(connector.position.y)).toBeCloseTo(0.25, 9);
    }
    // Высота корпуса — межосевое + 2 × 20 мм окантовки + диаметр порта (21,3 мм).
    const size = boundsBox(model.bounds).getSize(new Vector3());
    expect(size.y).toBeCloseTo(0.5 + 0.04 + 0.0213, 6);
    expect(size.z).toBeCloseTo(0.07, 6);
    expect(model.title).toBe('Ст.радиатор h500 (0.8м)');
  });

  it('крышки, торцы и окантовка корпуса смотрят наружу', () => {
    // Площадь пластика корпуса в плоскости `at`, смотрящего лицевой стороной в `sign`;
    // −1 — там есть вывернутая грань: односторонний материал её не рисует.
    const facingArea = (model: GeneratedModel, axis: 'x' | 'y' | 'z', sign: 1 | -1, at: number) => {
      const position = model.geometry.getAttribute('position');
      const plastic = model.geometry.groups[model.materials.indexOf('plastic')];
      const [a, b, c] = [new Vector3(), new Vector3(), new Vector3()];
      let area = 0;
      for (let i = plastic.start; i < plastic.start + plastic.count; i += 3) {
        a.fromBufferAttribute(position, i);
        b.fromBufferAttribute(position, i + 1);
        c.fromBufferAttribute(position, i + 2);
        if ([a, b, c].some((v) => Math.abs(v[axis] - at) > 1e-6)) continue;
        const normal = b.clone().sub(a).cross(c.clone().sub(a));
        if (normal[axis] * sign > 0) area += normal.length() / 2;
        else return -1;
      }
      return area;
    };
    const model = generator.build({ dimensions: { x: 0.8, y: 0.5, z: 0.07 }, nominal: '1/2' });
    const box = boundsBox(model.bounds);
    const height = 0.5 + 0.04 + 0.0213;
    expect(facingArea(model, 'y', 1, height / 2)).toBeCloseTo(0.8 * 0.07, 6);
    expect(facingArea(model, 'y', -1, -height / 2)).toBeCloseTo(0.8 * 0.07, 6);
    expect(facingArea(model, 'x', -1, -0.4)).toBeCloseTo(height * 0.07, 6);
    expect(facingArea(model, 'x', 1, 0.4)).toBeCloseTo(height * 0.07, 6);
    expect(facingArea(model, 'z', 1, box.max.z)).toBeGreaterThan(0);
    expect(facingArea(model, 'z', -1, box.min.z)).toBeGreaterThan(0);
  });

  it('размеры вне схемы — ошибки', () => {
    expect(codes(generator, { dimensions: { x: 0.05, y: 0.5, z: 0.07 }, nominal: '1/2' })).toEqual(['out_of_range:dimensions.x']);
    expect(codes(generator, { dimensions: { x: 0.8, y: 0.5, z: 0.01 }, nominal: '1/2' })).toEqual(['out_of_range:dimensions.z']);
  });

  describe('нижнее подключение (версия 2)', () => {
    const base = { dimensions: { x: 0.8, y: 0.5, z: 0.07 }, nominal: '1/2' } as const;
    const geometryOf = (model: GeneratedModel) => Array.from(model.geometry.getAttribute('position').array);

    it("параметры версии 1 и явное 'side' — прежняя модель", () => {
      const old = generator.build(base);
      const side = generator.build({ ...base, connection: 'side', bottomSide: 'left' });
      expect(side.connectors).toEqual(old.connectors);
      expect(geometryOf(side)).toEqual(geometryOf(old));
      expect(side.title).toBe(old.title);
      old.dispose(); side.dispose();
    });

    it.each([['right', 1], ['left', -1]] as const)("'bottom' %s: шесть портов, нижние вниз через 50 мм у торца", (bottomSide, sign) => {
      const side = generator.build(base);
      const model = generator.build({ ...base, connection: 'bottom', bottomSide });
      expect(model.connectors.map((c) => c.id)).toEqual(['bottom-left', 'top-left', 'top-right', 'bottom-right', 'below-outer', 'below-inner']);
      // Боковые порты не меняются.
      expect(model.connectors.slice(0, 4)).toEqual(side.connectors);
      const outer = byId(model, 'below-outer');
      const inner = byId(model, 'below-inner');
      for (const port of [outer, inner]) {
        expect(port).toMatchObject({ joint: 'thread', gender: 'internal', nominal: '1/2', depth: 0.005, direction: { x: 0, y: -1, z: 0 } });
        // Торец резьбы — на 5 мм ниже дна корпуса.
        expect(port.position.y).toBeCloseTo(side.bounds.min.y - 0.005, 6);
        expect(port.position.z).toBe(0);
      }
      expect(outer.position.x).toBeCloseTo(sign * (0.4 - 0.05), 9);
      expect(inner.position.x - outer.position.x).toBeCloseTo(-sign * 0.05, 9);
      expect(model.bounds.min.y).toBeCloseTo(side.bounds.min.y - 0.005, 6);
      expect(model.title).toBe('Ст.радиатор h500 (0.8м), нижн.');
      side.dispose(); model.dispose();
    });

    it('короткий корпус для нижней пары и неверное подключение — ошибки', () => {
      // 1/2: n = 21,3 мм; минимум 50 + 50 + 20 + 21,3 мм.
      const minimum = 0.05 + 0.05 + 0.02 + 0.0213;
      const short = { ...base, dimensions: { x: 0.14, y: 0.5, z: 0.07 }, connection: 'bottom' } as const;
      expect(minimum).toBeGreaterThan(0.14);
      expect(codes(generator, short)).toEqual(['too_short:dimensions.x']);
      expect(codes(generator, { ...short, connection: 'side' })).toEqual([]);
      expect(codes(generator, { ...base, connection: 'top' as 'side' })).toEqual(['unknown_option:connection']);
    });
  });
});

describe('воздухоотводчик radiator.vent', () => {
  it('наружная резьба 8 мм слева; без воздухоотводчика — пробка', () => {
    const generator = new RadiatorVentGenerator();
    const vent = generator.build({ nominal: '1/2', kind: 'vent' });
    expect(vent.connectors).toEqual([
      expect.objectContaining({ id: 'left', joint: 'thread', gender: 'external', nominal: '1/2', depth: 0.008, position: { x: -0.008, y: 0, z: 0 } }),
    ]);
    expect(vent.title).toBe('воздухоотв.радиаторный 1/2');
    const plug = generator.build({ nominal: '1/2', kind: 'plug' });
    // Без диска и бабочки деталь кончается гайкой 5 мм.
    expect(plug.bounds.max.x).toBeCloseTo(0.005, 6);
    expect(plug.title).toBe('заглушка радиаторная 1/2');
  });
});

describe('шаровые краны valve.ball и valve.ball-union', () => {
  const variants = [
    ['external', 'external', 'external', '(н-н)'],
    ['internal', 'internal', 'internal', '(в-в)'],
    ['internal-external', 'internal', 'external', '(в-н)'],
  ] as const;
  const generator = new BallValveGenerator();

  it.each(variants)('%s: концы на ±length/2, глубина — резьба, ручка сверху', (ends, left, right, suffix) => {
    const model = generator.build({ ends, nominal: '3/4', length: 0.07, handleLength: 0.053 });
    // Резьба крана — 0,4 n корпуса (у н-н n = d − t, иначе n = d), не меньше 12 мм.
    const thread = Math.max(0.4 * (ends === 'external' ? 0.024 : 0.0268), 0.012);
    expect(byId(model, 'left')).toMatchObject({ gender: left, nominal: '3/4', joint: 'thread' });
    expect(byId(model, 'right')).toMatchObject({ gender: right });
    expect(byId(model, 'left').position.x).toBeCloseTo(-0.035, 9);
    expect(byId(model, 'right').position.x).toBeCloseTo(0.035, 9);
    expect(byId(model, 'left').depth).toBeCloseTo(thread, 9);
    // Бабочка шириной handleLength — по X, над корпусом.
    expect(model.bounds.max.y).toBeGreaterThan(0.03);
    expect(model.title).toBe(`Шаровой кран 3/4${suffix}`);
  });

  it('корпус справа нулевой длины — ошибка', () => {
    // 1 1/2(в): резьба 0,4 × 48 мм = 19,2 мм; нужно length > 2 × (2 мм + резьба).
    const minimum = 2 * (0.002 + 0.4 * 0.048);
    const params = { ends: 'internal', nominal: '1 1/2', handleLength: 0.05 } as const;
    expect(codes(generator, { ...params, length: minimum - 0.0001 })).toEqual(['too_short:length']);
    expect(codes(generator, { ...params, length: minimum + 0.0001 })).toEqual([]);
    expect(codes(generator, { ...params, ends: 'none' as 'internal', length: 0.07 })).toEqual(['unknown_option:ends']);
  });

  it('с полусгоном: справа наружная резьба nominal на конце сгона', () => {
    const generator = new BallValveUnionGenerator();
    const params = { nominal: '1/2', unionNominal: '3/4', length: 0.055, unionLength: 0.026, handleLength: 0.053 };
    const model = generator.build(params);
    const right = byId(model, 'right');
    // Резьба сгона: 1,5 × 0,4 × n(1/2, н) = 1,5 × 0,4 × 18,6 мм.
    expect(right).toMatchObject({ gender: 'external', nominal: '1/2' });
    expect(right.depth).toBeCloseTo(1.5 * 0.4 * 0.0186, 9);
    expect(right.position.x).toBeCloseTo(model.bounds.max.x, 6);
    expect(byId(model, 'left')).toMatchObject({ gender: 'internal', nominal: '1/2' });
    expect(model.title).toBe('Шаровой кран с полусгоном 1/2');
    // Гладкий участок сгона: m2 − 1,5 × 7,44 мм − 2 мм.
    expect(codes(generator, { ...params, unionLength: 0.013 })).toEqual(['too_short:unionLength']);
    expect(codes(generator, { ...params, unionLength: 0.0135 })).toEqual([]);
  });
});

describe('кран регулировочный valve.regulating', () => {
  const generator = new RegulatingValveGenerator();
  const params = { nominal: '1/2', unionNominal: '3/4', length: 0.055, unionLength: 0.02, head: 'cap' } as const;

  it('головка — колпачок или терморегулятор, разъёмы одинаковые', () => {
    const cap = generator.build(params);
    const termo = generator.build({ ...params, head: 'thermostatic' });
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
    expect(codes(generator, { ...params, length: 0.032 })).toEqual(['too_short:length']);
    expect(codes(generator, { ...params, length: 0.0325 })).toEqual([]);
    expect(codes(generator, { ...params, head: 'none' as 'cap' })).toEqual(['unknown_option:head']);
  });
});
