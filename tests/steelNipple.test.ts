import { Mesh, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { MaterialLibrary, SteelNippleGenerator } from '../src/lib/index';
import type { SteelNippleParams } from '../src/lib/index';
import { STAND_PRESETS } from '../src/stand/presets';

const PRESETS = STAND_PRESETS.find((entry) => entry.generatorId === 'st_nippel_1')!.presets.map(
  (preset) => preset.params as unknown as SteelNippleParams,
);

// d и t по таблице sizeRezba, мм. Наружная резьба: n = d − t.
const PIPE: Record<string, [number, number]> = {
  '1/4': [13.5, 2.2], '3/8': [17.0, 2.2], '1/2': [21.3, 2.7], '3/4': [26.8, 2.8],
  '1': [33.5, 3.2], '1 1/4': [42.3, 3.2], '1 1/2': [48.0, 3.5], '2': [60.0, 3.5],
};

/**
 * Ожидаемые размеры по формулам st_nippel_1. Габариты 1/2×1/2, 2×1 и 3/8×1/4
 * сверены с моделью из gl2 (9 октября 2026).
 */
function expected({ r1, r2, m1 }: SteelNippleParams) {
  const n = (nominal: string) => Math.round((PIPE[nominal][0] - PIPE[nominal][1]) * 10) / 10000;
  const thread = (nominal: string) => Math.min(Math.max(0.3 * n(nominal), 0.008), 0.012);
  // Шестигранник: описанный радиус (n + n/4)/2; по Y — апофема r·√3/2.
  const hex = (Math.max(n(r1), n(r2)) * 1.25) / 2;
  return { size: new Vector3(m1, hex * Math.sqrt(3), hex * 2), x1: thread(r1), x2: thread(r2) };
}

const generator = new SteelNippleGenerator(new MaterialLibrary());

describe.each(PRESETS)('ниппель $r1 × $r2, m1 = $m1', (params) => {
  const exp = expected(params);

  it('строится, буферы согласованы, есть резьба', () => {
    expect(generator.validate(params)).toEqual([]);
    const model = generator.build(params);
    const geometry = (model.root.children[0] as Mesh).geometry;
    const position = geometry.getAttribute('position');
    // В gl2 у ниппеля 1176 треугольников.
    expect(position.count / 3).toBe(1176);
    for (const name of ['position', 'normal', 'uv']) {
      expect(Array.from(geometry.getAttribute(name).array).every(Number.isFinite)).toBe(true);
    }
    expect(geometry.groups.map((group) => group.materialIndex)).toEqual([0, 1]);
    model.dispose();
  });

  it('габариты', () => {
    const model = generator.build(params);
    const size = model.bounds.getSize(new Vector3());
    expect(size.x).toBeCloseTo(exp.size.x, 6);
    expect(size.y).toBeCloseTo(exp.size.y, 6);
    expect(size.z).toBeCloseTo(exp.size.z, 6);
    model.dispose();
  });

  it('разъёмы на торцах, наружная резьба', () => {
    const model = generator.build(params);
    const [left, right] = model.connectors;
    const common = { joint: 'thread', gender: 'external' };
    expect(left).toMatchObject({ id: 'left', nominal: params.r1, direction: { x: -1, y: 0, z: 0 }, ...common });
    expect(right).toMatchObject({ id: 'right', nominal: params.r2, direction: { x: 1, y: 0, z: 0 }, ...common });
    expect(left.position.x).toBeCloseTo(-params.m1 / 2, 9);
    expect(right.position.x).toBeCloseTo(params.m1 / 2, 9);
    expect(left.depth).toBeCloseTo(exp.x1, 9);
    expect(right.depth).toBeCloseTo(exp.x2, 9);
    model.dispose();
  });
});

describe('ниппель: параметры', () => {
  const codes = (params: SteelNippleParams) => generator.validate(params).map(({ code, param }) => `${code}:${param}`);

  it('ошибки и название', () => {
    expect(codes({ r1: '7/8', r2: '1/2', m1: 0.022 })).toEqual(['unknown_option:r1']);
    // 2": резьба 12 мм — нужно m1 > 24 мм.
    expect(codes({ r1: '2', r2: '2', m1: 0.024 })).toEqual(['too_short:m1']);
    expect(generator.build({ r1: '1', r2: '1/2', m1: 0.034 }).title).toBe('Ниппель 1(н)х1/2(н)');
    expect(generator.build({ r1: '1/2', r2: '1/2', m1: 0.022 }).title).toBe('Ниппель 1/2(н)');
  });
});
