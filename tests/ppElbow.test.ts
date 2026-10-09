import { Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { GeneratorParamsError, PpPipeSizes } from '../src/lib/index';
import type { PpElbowParams } from '../src/lib/index';
import { PpElbowGenerator } from '../src/lib/generators/pp/PpElbowGenerator';
import { boundsBox } from './modelHelpers';

// Наборы pl_ugol_90 из gl2/createObj/start.js.
const PRESETS: PpElbowParams[] = [
  { nominal: '20', armLength: 0.026 },
  { nominal: '25', armLength: 0.03 },
  { nominal: '32', armLength: 0.037 },
  { nominal: '40', armLength: 0.044 },
  { nominal: '50', armLength: 0.053 },
  { nominal: '63', armLength: 0.06 },
];

// Толщина стенки t по таблице sizeTubePP, мм.
const WALL_MM: Record<string, number> = { '20': 4.2, '25': 5.4, '32': 6.7, '40': 8.3, '50': 10.5, '63': 12.5 };

/** Ожидаемые размеры по формулам pl_ugol_90_1, независимо от генератора. */
function expected({ nominal: r1, armLength: m1 }: PpElbowParams) {
  const n = Math.round((Number(r1) + 1.4 * WALL_MM[r1]) * 10) / 10000;
  return { size: new Vector3(m1 + n / 2, m1 + n / 2, n) };
}

const generator = new PpElbowGenerator();

describe('PpPipeSizes', () => {
  // Посчитано вручную: n = d + 1.4t с округлением до 0,1 мм, v = d.
  it('диаметры', () => {
    expect(PpPipeSizes.diameters('20')).toEqual({ n: 0.0259, v: 0.02 });
    expect(PpPipeSizes.diameters('63')).toEqual({ n: 0.0805, v: 0.063 });
    expect(PpPipeSizes.diameters('1/2')).toBeNull();
  });
});

describe.each(PRESETS)('угол ПП $nominal, m1 = $armLength', (params) => {
  const exp = expected(params);

  it('строится, буферы согласованы, одна группа пластика', () => {
    expect(generator.validate(params)).toEqual([]);
    const model = generator.build(params);
    const geometry = model.geometry;
    const position = geometry.getAttribute('position');

    expect(geometry.index).toBeNull();
    for (const name of ['normal', 'uv']) expect(geometry.getAttribute(name).count).toBe(position.count);
    for (const name of ['position', 'normal', 'uv']) {
      expect(Array.from(geometry.getAttribute(name).array).every(Number.isFinite)).toBe(true);
    }
    expect(geometry.groups).toEqual([{ start: 0, count: position.count, materialIndex: 0 }]);
    expect(model.materials).toEqual(['plastic']);
    model.dispose();
  });

  it('габариты: плечи по +X и +Y, скругление в −X/−Y', () => {
    const model = generator.build(params);
    const size = boundsBox(model.bounds).getSize(new Vector3());
    expect(size.x).toBeCloseTo(exp.size.x, 6);
    expect(size.y).toBeCloseTo(exp.size.y, 6);
    expect(size.z).toBeCloseTo(exp.size.z, 6);
    expect(model.bounds.max.x).toBeCloseTo(params.armLength, 6);
    expect(model.bounds.max.y).toBeCloseTo(params.armLength, 6);
    model.dispose();
  });

  it('разъёмы right и top под пайку на торцах плеч', () => {
    const model = generator.build(params);
    // Глубина — длина раструба x_1 = 15 мм.
    const common = { depth: 0.015, nominal: params.nominal, joint: 'pp-socket', gender: 'internal' };
    expect(model.connectors).toHaveLength(2);
    const [right, top] = model.connectors;

    expect(right).toMatchObject({ id: 'right', direction: { x: 1, y: 0, z: 0 }, ...common });
    expect(top).toMatchObject({ id: 'top', direction: { x: 0, y: 1, z: 0 }, ...common });
    expect(right.position.x).toBeCloseTo(params.armLength, 9);
    expect(top.position.y).toBeCloseTo(params.armLength, 9);
    expect([right.position.y, right.position.z, top.position.x, top.position.z]).toEqual([0, 0, 0, 0]);
    model.dispose();
  });
});

describe('угол ПП: параметры', () => {
  const codes = (params: PpElbowParams) => generator.validate(params).map(({ code, param }) => `${code}:${param}`);

  it('ошибки параметров', () => {
    expect(codes({ nominal: '1/2', armLength: 0.026 })).toEqual(['unknown_option:nominal']);
    expect(codes({ nominal: '20', armLength: 0 })).toEqual(['out_of_range:armLength']);
    expect(codes({ nominal: '20', armLength: 0.015 })).toEqual(['too_short:armLength']);
    expect(codes({ nominal: '20', armLength: 0.0151 })).toEqual([]);
    expect(() => generator.build({ nominal: '20', armLength: 0.01 })).toThrow(GeneratorParamsError);
  });

  it('название и повторный dispose', () => {
    const model = generator.build(PRESETS[0]);
    expect(model.title).toBe('Угол 20');
    model.dispose();
    expect(() => model.dispose()).not.toThrow();
  });
});
