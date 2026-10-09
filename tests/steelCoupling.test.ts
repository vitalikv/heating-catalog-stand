import { Box3, Vector3 } from 'three';
import type { BufferAttribute } from 'three';
import { describe, expect, it } from 'vitest';
import { GeneratorParamsError } from '../src/lib/index';
import type { SteelCouplingParams } from '../src/lib/index';
import { SteelCouplingGenerator } from '../src/lib/generators/steel/SteelCouplingGenerator';
import { boundsBox } from './modelHelpers';

// Наборы из gl2/createObj/start.js, блок st_mufta.
const PRESETS: SteelCouplingParams[] = [
  { nominalLeft: '1/2', nominalRight: '1/2', length: 0.03 },
  { nominalLeft: '3/4', nominalRight: '3/4', length: 0.033 },
  { nominalLeft: '1', nominalRight: '1', length: 0.035 },
  { nominalLeft: '1 1/4', nominalRight: '1 1/4', length: 0.047 },
  { nominalLeft: '1 1/2', nominalRight: '1 1/2', length: 0.052 },
  { nominalLeft: '2', nominalRight: '2', length: 0.06 },
  { nominalLeft: '1/2', nominalRight: '3/8', length: 0.028 },
  { nominalLeft: '3/4', nominalRight: '1/2', length: 0.032 },
  { nominalLeft: '1', nominalRight: '1/2', length: 0.034 },
  { nominalLeft: '1', nominalRight: '3/4', length: 0.039 },
  { nominalLeft: '1 1/4', nominalRight: '1/2', length: 0.041 },
  { nominalLeft: '1 1/4', nominalRight: '3/4', length: 0.041 },
  { nominalLeft: '1 1/4', nominalRight: '1', length: 0.042 },
  { nominalLeft: '1 1/2', nominalRight: '1 1/4', length: 0.043 },
  { nominalLeft: '2', nominalRight: '1', length: 0.048 },
  { nominalLeft: '2', nominalRight: '1 1/4', length: 0.048 },
  { nominalLeft: '2', nominalRight: '1 1/2', length: 0.048 },
];

// Наружный диаметр d трубы по таблице sizeRezba, мм. Для внутренней резьбы n = d.
const OUTER_MM: Record<string, number> = {
  '3/8': 17.0,
  '1/2': 21.3,
  '3/4': 26.8,
  '1': 33.5,
  '1 1/4': 42.3,
  '1 1/2': 48.0,
  '2': 60.0,
};

/** Ожидаемые размеры по формулам st_mufta_1, независимо от генератора. */
function expected({ nominalLeft: r1, nominalRight: r2, length: m1 }: SteelCouplingParams) {
  const n1 = OUTER_MM[r1] / 1000;
  const n2 = OUTER_MM[r2] / 1000;
  const x1 = Math.max(0.3 * n1, 0.012);
  const x2 = Math.max(0.3 * n2, 0.012);
  const x4 = Math.max(n1, n2) / 7;
  // Торец — наружная грань кольца; резьба от него до гладкого участка (m1/2 − x_1).
  const face = m1 / 2 + x4 / 2;
  return {
    size: new Vector3(m1 + x4, Math.max(n1, n2) + 0.002, Math.max(n1, n2) + 0.002),
    face,
    leftDepth: face - (m1 / 2 - x1),
    rightDepth: face - (m1 / 2 - x2),
  };
}

const generator = new SteelCouplingGenerator();

describe.each(PRESETS)('муфта $nominalLeft × $nominalRight, m1 = $length', (params) => {
  const exp = expected(params);

  it('строится без ошибок параметров', () => {
    expect(generator.validate(params)).toEqual([]);
  });

  it('буферы согласованы, без NaN, есть группы обоих материалов', () => {
    const model = generator.build(params);
    const geometry = model.geometry;
    const position = geometry.getAttribute('position');
    const normal = geometry.getAttribute('normal');
    const uv = geometry.getAttribute('uv');

    expect(geometry.index).toBeNull();
    expect(position.count % 3).toBe(0);
    expect(normal.count).toBe(position.count);
    expect(uv.count).toBe(position.count);
    for (const attribute of [position, normal, uv]) {
      expect(Array.from(attribute.array).every(Number.isFinite)).toBe(true);
    }

    expect(geometry.groups).toHaveLength(2);
    expect(model.materials).toEqual(['metal', 'thread']);
    expect(geometry.groups.reduce((sum, group) => sum + group.count, 0)).toBe(position.count);
    model.dispose();
  });

  it('габариты', () => {
    const model = generator.build(params);
    const size = boundsBox(model.bounds).getSize(new Vector3());
    expect(size.x).toBeCloseTo(exp.size.x, 6);
    expect(size.y).toBeCloseTo(exp.size.y, 6);
    expect(size.z).toBeCloseTo(exp.size.z, 6);

    // bounds совпадает с фактическим габаритом геометрии.
    const actual = new Box3().setFromBufferAttribute(model.geometry.getAttribute('position') as BufferAttribute);
    expect(actual.min.distanceTo(boundsBox(model.bounds).min)).toBeLessThan(1e-9);
    expect(actual.max.distanceTo(boundsBox(model.bounds).max)).toBeLessThan(1e-9);
    model.dispose();
  });

  it('разъёмы left и right на торцах', () => {
    const model = generator.build(params);
    const [left, right] = model.connectors;

    expect(left).toMatchObject({ id: 'left', nominal: params.nominalLeft, joint: 'thread', gender: 'internal', direction: { x: -1, y: 0, z: 0 } });
    expect(right).toMatchObject({ id: 'right', nominal: params.nominalRight, joint: 'thread', gender: 'internal', direction: { x: 1, y: 0, z: 0 } });
    expect(left.position.x).toBeCloseTo(-exp.face, 9);
    expect(right.position.x).toBeCloseTo(exp.face, 9);
    expect(left.depth).toBeCloseTo(exp.leftDepth, 9);
    expect(right.depth).toBeCloseTo(exp.rightDepth, 9);
    // Торец лежит на границе габарита.
    expect(right.position.x).toBeCloseTo(model.bounds.max.x, 6);
    expect([left.position.y, left.position.z, right.position.y, right.position.z]).toEqual([0, 0, 0, 0]);
    model.dispose();
  });
});

describe('муфта: параметры и ресурсы', () => {
  const codes = (params: SteelCouplingParams) => generator.validate(params).map(({ code, param }) => `${code}:${param}`);

  it('неизвестный номинал', () => {
    expect(codes({ nominalLeft: '7/8', nominalRight: '1/2', length: 0.03 })).toEqual(['unknown_option:nominalLeft']);
    expect(codes({ nominalLeft: '1/2', nominalRight: '', length: 0.03 })).toEqual(['unknown_option:nominalRight']);
  });

  it('m1 вне диапазона схемы и не число', () => {
    expect(codes({ nominalLeft: '1/2', nominalRight: '1/2', length: 0 })).toEqual(['out_of_range:length']);
    expect(codes({ nominalLeft: '1/2', nominalRight: '1/2', length: -0.03 })).toEqual(['out_of_range:length']);
    expect(codes({ nominalLeft: '1/2', nominalRight: '1/2', length: 0.25 })).toEqual(['out_of_range:length']);
    expect(codes({ nominalLeft: '1/2', nominalRight: '1/2', length: Number.NaN })).toEqual(['not_a_number:length']);
  });

  it('m1 не больше суммы резьбовых участков', () => {
    // 2": x_1 = 0,3 × 0,06 = 0,018 м, нужно m1 > 0,036 м.
    expect(codes({ nominalLeft: '2', nominalRight: '2', length: 0.036 })).toEqual(['too_short:length']);
    expect(codes({ nominalLeft: '2', nominalRight: '2', length: 0.0361 })).toEqual([]);
    // Переходная: решает бо́льшая сторона.
    expect(codes({ nominalLeft: '1/2', nominalRight: '2', length: 0.03 })).toEqual(['too_short:length']);
  });

  it('build с ошибкой бросает GeneratorParamsError', () => {
    expect(() => generator.build({ nominalLeft: '7/8', nominalRight: '1/2', length: 0 })).toThrow(GeneratorParamsError);
  });

  it('не меняет параметры', () => {
    const params = Object.freeze({ nominalLeft: '1', nominalRight: '1/2', length: 0.034 });
    generator.build(params).dispose();
    expect(params).toEqual({ nominalLeft: '1', nominalRight: '1/2', length: 0.034 });
  });

  it('название как в gl2', () => {
    const single = generator.build({ nominalLeft: '1/2', nominalRight: '1/2', length: 0.03 });
    expect(single.title).toBe('Муфта 1/2(в)');
    expect(generator.build({ nominalLeft: '1', nominalRight: '1/2', length: 0.034 }).title).toBe('Муфта 1(в)х1/2(в)');
  });

  it('dispose освобождает геометрию, повторный вызов безопасен', () => {
    const model = generator.build(PRESETS[0]);
    let disposals = 0;
    model.geometry.addEventListener('dispose', () => disposals++);
    model.dispose();
    expect(() => model.dispose()).not.toThrow();
    expect(disposals).toBe(1);
  });
});
