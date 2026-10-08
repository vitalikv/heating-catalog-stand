import { Box3, Mesh, Vector3 } from 'three';
import type { BufferGeometry } from 'three';
import { describe, expect, it } from 'vitest';
import { GeneratorParamsError, MaterialLibrary, SteelCouplingGenerator } from '../src/lib/index';
import type { SteelCouplingParams } from '../src/lib/index';

// Наборы из gl2/createObj/start.js, блок st_mufta.
const PRESETS: SteelCouplingParams[] = [
  { r1: '1/2', r2: '1/2', m1: 0.03 },
  { r1: '3/4', r2: '3/4', m1: 0.033 },
  { r1: '1', r2: '1', m1: 0.035 },
  { r1: '1 1/4', r2: '1 1/4', m1: 0.047 },
  { r1: '1 1/2', r2: '1 1/2', m1: 0.052 },
  { r1: '2', r2: '2', m1: 0.06 },
  { r1: '1/2', r2: '3/8', m1: 0.028 },
  { r1: '3/4', r2: '1/2', m1: 0.032 },
  { r1: '1', r2: '1/2', m1: 0.034 },
  { r1: '1', r2: '3/4', m1: 0.039 },
  { r1: '1 1/4', r2: '1/2', m1: 0.041 },
  { r1: '1 1/4', r2: '3/4', m1: 0.041 },
  { r1: '1 1/4', r2: '1', m1: 0.042 },
  { r1: '1 1/2', r2: '1 1/4', m1: 0.043 },
  { r1: '2', r2: '1', m1: 0.048 },
  { r1: '2', r2: '1 1/4', m1: 0.048 },
  { r1: '2', r2: '1 1/2', m1: 0.048 },
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
function expected({ r1, r2, m1 }: SteelCouplingParams) {
  const n1 = OUTER_MM[r1] / 1000;
  const n2 = OUTER_MM[r2] / 1000;
  const x1 = Math.max(0.3 * n1, 0.012);
  const x2 = Math.max(0.3 * n2, 0.012);
  const x4 = Math.max(n1, n2) / 7;
  return {
    size: new Vector3(m1 + x4, Math.max(n1, n2) + 0.002, Math.max(n1, n2) + 0.002),
    left: -(m1 / 2 - x1 + x1 / 2),
    right: m1 / 2 - x2 + x2 / 2,
  };
}

function geometryOf(root: { children: unknown[] }): BufferGeometry {
  const mesh = root.children[0];
  if (!(mesh instanceof Mesh)) throw new Error('Нет меша в корне модели');
  return mesh.geometry;
}

const generator = new SteelCouplingGenerator(new MaterialLibrary());

describe.each(PRESETS)('муфта $r1 × $r2, m1 = $m1', (params) => {
  const exp = expected(params);

  it('строится без ошибок параметров', () => {
    expect(generator.validate(params)).toEqual([]);
  });

  it('буферы согласованы, без NaN, есть группы обоих материалов', () => {
    const model = generator.build(params);
    const geometry = geometryOf(model.root);
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

    expect(geometry.groups.map((group) => group.materialIndex)).toEqual([0, 1]);
    expect(geometry.groups.reduce((sum, group) => sum + group.count, 0)).toBe(position.count);
    model.dispose();
  });

  it('габариты', () => {
    const model = generator.build(params);
    const size = model.bounds.getSize(new Vector3());
    expect(size.x).toBeCloseTo(exp.size.x, 6);
    expect(size.y).toBeCloseTo(exp.size.y, 6);
    expect(size.z).toBeCloseTo(exp.size.z, 6);

    // bounds совпадает с фактическим габаритом корня.
    const actual = new Box3().setFromObject(model.root);
    expect(actual.min.distanceTo(model.bounds.min)).toBeLessThan(1e-9);
    expect(actual.max.distanceTo(model.bounds.max)).toBeLessThan(1e-9);
    model.dispose();
  });

  it('разъёмы left и right', () => {
    const model = generator.build(params);
    const [left, right] = model.connectors;

    expect(left).toMatchObject({ id: 'left', nominal: params.r1, gender: 'internal', direction: { x: -1, y: 0, z: 0 } });
    expect(right).toMatchObject({ id: 'right', nominal: params.r2, gender: 'internal', direction: { x: 1, y: 0, z: 0 } });
    expect(left.position.x).toBeCloseTo(exp.left, 9);
    expect(right.position.x).toBeCloseTo(exp.right, 9);
    expect([left.position.y, left.position.z, right.position.y, right.position.z]).toEqual([0, 0, 0, 0]);
    model.dispose();
  });
});

describe('муфта: параметры и ресурсы', () => {
  const codes = (params: SteelCouplingParams) => generator.validate(params).map(({ code, param }) => `${code}:${param}`);

  it('неизвестный номинал', () => {
    expect(codes({ r1: '7/8', r2: '1/2', m1: 0.03 })).toEqual(['unknown_nominal:r1']);
    expect(codes({ r1: '1/2', r2: '', m1: 0.03 })).toEqual(['unknown_nominal:r2']);
  });

  it('m1 ≤ 0 и не число', () => {
    expect(codes({ r1: '1/2', r2: '1/2', m1: 0 })).toEqual(['not_positive:m1']);
    expect(codes({ r1: '1/2', r2: '1/2', m1: -0.03 })).toEqual(['not_positive:m1']);
    expect(codes({ r1: '1/2', r2: '1/2', m1: Number.NaN })).toEqual(['not_positive:m1']);
  });

  it('m1 не больше суммы резьбовых участков', () => {
    // 2": x_1 = 0,3 × 0,06 = 0,018 м, нужно m1 > 0,036 м.
    expect(codes({ r1: '2', r2: '2', m1: 0.036 })).toEqual(['too_short:m1']);
    expect(codes({ r1: '2', r2: '2', m1: 0.0361 })).toEqual([]);
    // Переходная: решает бо́льшая сторона.
    expect(codes({ r1: '1/2', r2: '2', m1: 0.03 })).toEqual(['too_short:m1']);
  });

  it('build с ошибкой бросает GeneratorParamsError', () => {
    expect(() => generator.build({ r1: '7/8', r2: '1/2', m1: 0 })).toThrow(GeneratorParamsError);
  });

  it('не меняет параметры', () => {
    const params = Object.freeze({ r1: '1', r2: '1/2', m1: 0.034 });
    generator.build(params).dispose();
    expect(params).toEqual({ r1: '1', r2: '1/2', m1: 0.034 });
  });

  it('название как в gl2', () => {
    expect(generator.build({ r1: '1/2', r2: '1/2', m1: 0.03 }).root.name).toBe('Муфта 1/2(в)');
    expect(generator.build({ r1: '1', r2: '1/2', m1: 0.034 }).root.name).toBe('Муфта 1(в)х1/2(в)');
  });

  it('повторный dispose безопасен и не трогает общие материалы', () => {
    const materials = new MaterialLibrary();
    const model = new SteelCouplingGenerator(materials).build(PRESETS[0]);
    let materialDisposed = false;
    materials.get('metal').addEventListener('dispose', () => (materialDisposed = true));

    model.dispose();
    expect(() => model.dispose()).not.toThrow();
    expect(materialDisposed).toBe(false);
  });
});
