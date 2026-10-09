import { describe, expect, it } from 'vitest';
import { AluminiumRadiatorGenerator, GeneratorParamsError } from '../src/lib/index';
import type { AluminiumRadiatorParams } from '../src/lib/index';
import { boundsBox } from './modelHelpers';

// Наборы al_radiator_1 из gl2/createObj/start.js: 6 высот × 1…10 секций.
const PRESETS: AluminiumRadiatorParams[] = [0.2, 0.35, 0.5, 0.6, 0.7, 0.8].flatMap((y) =>
  Array.from({ length: 10 }, (_, i) => ({ count: i + 1, size: { x: 0.08, y, z: 0.08 }, r1: '1' })),
);

/**
 * Ожидаемые размеры по формулам al_radiator_1, независимо от генератора.
 * Для '1': d = 33.5 мм, коллектор n = 1.2 × d. Значения для 1×200, 3×500 и 10×800
 * дополнительно сверены с моделью, построенной в gl2 (9 октября 2026).
 */
function expected({ count, size }: AluminiumRadiatorParams) {
  const n = 0.0335 * 1.2;
  const step = size.x + 0.002; // ширина секции: резьбовые участки выступают на 1 мм с каждой стороны
  const x2 = (size.x - 0.04) / 2 + 0.001;
  // Торец коллектора — край секции, глубина — резьбовой участок x_2.
  const faceX = 0.02 + x2;
  return {
    depth: x2,
    min: [-step / 2, -size.y / 2 - 0.025, -(n / 2 + 0.025)],
    max: [step / 2 + step * (count - 1), size.y / 2 + 0.03, n / 2 + 0.025 + 0.003],
    leftX: -faceX,
    rightX: faceX + step * (count - 1),
  };
}

const generator = new AluminiumRadiatorGenerator();

describe.each(PRESETS)('радиатор $count шт., h = $size.y', (params) => {
  const exp = expected(params);

  it('секции слиты в одну геометрию, буферы согласованы', () => {
    expect(generator.validate(params)).toEqual([]);
    const model = generator.build(params);
    const geometry = model.geometry;
    const position = geometry.getAttribute('position');
    expect(geometry.index).toBeNull();
    // В gl2 у секции 2036 треугольников; секции — копии со сдвигом на шаг.
    expect(position.count / 3).toBe(2036 * params.count);
    for (const name of ['position', 'normal', 'uv']) {
      const attribute = geometry.getAttribute(name);
      expect(attribute.count).toBe(position.count);
      expect(Array.from(attribute.array).every(Number.isFinite)).toBe(true);
    }
    expect(model.materials).toEqual(['plastic', 'thread']);
    model.dispose();
  });

  it('габариты', () => {
    const model = generator.build(params);
    expect(boundsBox(model.bounds).min.toArray().map((v, i) => v - exp.min[i]).every((d) => Math.abs(d) < 1e-6)).toBe(true);
    expect(boundsBox(model.bounds).max.toArray().map((v, i) => v - exp.max[i]).every((d) => Math.abs(d) < 1e-6)).toBe(true);
    model.dispose();
  });

  it('четыре разъёма по углам на торцах коллекторов', () => {
    const model = generator.build(params);
    const h = params.size.y / 2;
    const common = { nominal: '1', joint: 'radiator-thread', gender: 'internal' };
    const byId = Object.fromEntries(model.connectors.map((c) => [c.id, c]));

    expect(Object.keys(byId).sort()).toEqual(['bottom-left', 'bottom-right', 'top-left', 'top-right']);
    for (const [id, x, y, dx] of [
      ['bottom-left', exp.leftX, -h, -1],
      ['top-left', exp.leftX, h, -1],
      ['top-right', exp.rightX, h, 1],
      ['bottom-right', exp.rightX, -h, 1],
    ] as const) {
      expect(byId[id]).toMatchObject({ direction: { x: dx, y: 0, z: 0 }, ...common });
      expect(byId[id].position.x).toBeCloseTo(x, 6);
      expect(byId[id].position.y).toBeCloseTo(y, 9);
      expect(byId[id].position.z).toBe(0);
      expect(byId[id].depth).toBeCloseTo(exp.depth, 9);
    }
    model.dispose();
  });
});

describe('радиатор: параметры и ресурсы', () => {
  const base: AluminiumRadiatorParams = { count: 3, size: { x: 0.08, y: 0.5, z: 0.08 }, r1: '1' };
  const codes = (patch: Partial<AluminiumRadiatorParams>) =>
    generator.validate({ ...base, ...patch }).map(({ code, param }) => `${code}:${param}`);

  it('ошибки параметров', () => {
    expect(codes({ count: 0 })).toEqual(['out_of_range:count']);
    expect(codes({ count: 11 })).toEqual(['out_of_range:count']);
    expect(codes({ count: 2.5 })).toEqual(['not_integer:count']);
    expect(codes({ r1: '7/8' })).toEqual(['unknown_option:r1']);
    expect(codes({ size: { x: 0.04, y: 0.5, z: 0.08 } })).toEqual(['out_of_range:size.x']);
    expect(codes({ size: { x: 0.08, y: 0.05, z: 0.08 } })).toEqual(['out_of_range:size.y']);
    expect(() => generator.build({ ...base, count: 0 })).toThrow(GeneratorParamsError);
  });

  it('название как в gl2', () => {
    expect(generator.build(base).title).toBe('Ал.радиатор h500 (3шт.)');
  });

  it('геометрия освобождается один раз, повторный dispose безопасен', () => {
    const model = generator.build(base);
    let disposals = 0;
    model.geometry.addEventListener('dispose', () => disposals++);

    model.dispose();
    model.dispose();
    expect(disposals).toBe(1);
  });
});
