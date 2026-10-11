import { Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { CATALOG } from '../src/lib/index';
import type { SteelNippleParams } from '../src/lib/index';
import { SteelNippleGenerator } from '../src/lib/generators/steel/SteelNippleGenerator';
import { boundsBox } from './modelHelpers';

// Позиции gl2; сдвоенный ниппель версии 2 проверяется отдельно.
const PRESETS = CATALOG.find((entry) => entry.generatorId === 'steel.nipple')!.items
  .map((preset) => preset.params as unknown as SteelNippleParams)
  .filter((params) => params.kind === undefined);

// d и t по таблице sizeRezba, мм. Наружная резьба: n = d − t.
const PIPE: Record<string, [number, number]> = {
  '1/4': [13.5, 2.2], '3/8': [17.0, 2.2], '1/2': [21.3, 2.7], '3/4': [26.8, 2.8],
  '1': [33.5, 3.2], '1 1/4': [42.3, 3.2], '1 1/2': [48.0, 3.5], '2': [60.0, 3.5],
};

/**
 * Ожидаемые размеры по формулам st_nippel_1. Габариты 1/2×1/2, 2×1 и 3/8×1/4
 * сверены с моделью из gl2 (9 октября 2026).
 */
function expected({ nominalLeft: r1, nominalRight: r2, length: m1 }: SteelNippleParams) {
  const n = (nominal: string) => Math.round((PIPE[nominal][0] - PIPE[nominal][1]) * 10) / 10000;
  const thread = (nominal: string) => Math.min(Math.max(0.3 * n(nominal), 0.008), 0.012);
  // Шестигранник: описанный радиус (n + n/4)/2; по Y — апофема r·√3/2.
  const hex = (Math.max(n(r1), n(r2)) * 1.25) / 2;
  return { size: new Vector3(m1, hex * Math.sqrt(3), hex * 2), x1: thread(r1), x2: thread(r2) };
}

const generator = new SteelNippleGenerator();

describe.each(PRESETS)('ниппель $nominalLeft × $nominalRight, m1 = $length', (params) => {
  const exp = expected(params);

  it('строится, буферы согласованы, есть резьба', () => {
    expect(generator.validate(params)).toEqual([]);
    const model = generator.build(params);
    const geometry = model.geometry;
    const position = geometry.getAttribute('position');
    // В gl2 у ниппеля 1176 треугольников.
    expect(position.count / 3).toBe(1176);
    for (const name of ['position', 'normal', 'uv']) {
      expect(Array.from(geometry.getAttribute(name).array).every(Number.isFinite)).toBe(true);
    }
    // Группы — в порядке первого появления ключа: первым идёт кусок резьбы.
    expect(model.materials).toEqual(['thread', 'metal']);
    model.dispose();
  });

  it('габариты', () => {
    const model = generator.build(params);
    const size = boundsBox(model.bounds).getSize(new Vector3());
    expect(size.x).toBeCloseTo(exp.size.x, 6);
    expect(size.y).toBeCloseTo(exp.size.y, 6);
    expect(size.z).toBeCloseTo(exp.size.z, 6);
    model.dispose();
  });

  it('разъёмы на торцах, наружная резьба', () => {
    const model = generator.build(params);
    const [left, right] = model.connectors;
    const common = { joint: 'thread', gender: 'external' };
    expect(left).toMatchObject({ id: 'left', nominal: params.nominalLeft, direction: { x: -1, y: 0, z: 0 }, ...common });
    expect(right).toMatchObject({ id: 'right', nominal: params.nominalRight, direction: { x: 1, y: 0, z: 0 }, ...common });
    expect(left.position.x).toBeCloseTo(-params.length / 2, 9);
    expect(right.position.x).toBeCloseTo(params.length / 2, 9);
    expect(left.depth).toBeCloseTo(exp.x1, 9);
    expect(right.depth).toBeCloseTo(exp.x2, 9);
    model.dispose();
  });
});

describe('ниппель: параметры', () => {
  const codes = (params: SteelNippleParams) => generator.validate(params).map(({ code, param }) => `${code}:${param}`);

  it('ошибки и название', () => {
    expect(codes({ nominalLeft: '7/8', nominalRight: '1/2', length: 0.022 })).toEqual(['unknown_option:nominalLeft']);
    // 2": резьба 12 мм — нужно m1 > 24 мм.
    expect(codes({ nominalLeft: '2', nominalRight: '2', length: 0.024 })).toEqual(['too_short:length']);
    expect(generator.build({ nominalLeft: '1', nominalRight: '1/2', length: 0.034 }).title).toBe('Ниппель 1(н)х1/2(н)');
    expect(generator.build({ nominalLeft: '1/2', nominalRight: '1/2', length: 0.022 }).title).toBe('Ниппель 1/2(н)');
  });
});

describe('сдвоенный коллекторный ниппель (версия 2, VT.0606)', () => {
  const codes = (params: SteelNippleParams) => generator.validate(params).map(({ code, param }) => `${code}:${param}`);
  const plain = { nominalLeft: '1', nominalRight: '1', length: 0.036 } as const;

  it("параметры версии 1 и 'plain' — прежняя модель", () => {
    const old = generator.build(plain);
    const explicit = generator.build({ ...plain, kind: 'plain' });
    expect(Array.from(explicit.geometry.getAttribute('position').array)).toEqual(Array.from(old.geometry.getAttribute('position').array));
    expect(explicit.connectors).toEqual(old.connectors);
    old.dispose(); explicit.dispose();
  });

  it.each([['1', 0.036, 0.016, 0.037], ['1 1/4', 0.045, 0.02, 0.048]] as const)('%s: длина A, шестигранник D × SW по таблице, кольца EPDM, прежние разъёмы', (nominal, a, d, key) => {
    const params = { nominalLeft: nominal, nominalRight: nominal, length: a, kind: 'double' } as const;
    expect(codes(params)).toEqual([]);
    const model = generator.build(params);
    const old = generator.build({ ...params, kind: 'plain' });
    expect(model.connectors).toEqual(old.connectors);
    expect(model.materials).toContain('black');
    const size = boundsBox(model.bounds).getSize(new Vector3());
    expect(size.x).toBeCloseTo(a, 6);
    // Под ключ — расстояние между гранями шестигранника (по Y).
    expect(size.y).toBeCloseTo(key, 6);
    // Шестигранник — участок полного габарита по Y длиной D.
    const position = model.geometry.getAttribute('position');
    let hexMin = Infinity; let hexMax = -Infinity;
    for (let i = 0; i < position.count; i++) {
      if (Math.abs(position.getY(i)) > key / 2 - 1e-6) { hexMin = Math.min(hexMin, position.getX(i)); hexMax = Math.max(hexMax, position.getX(i)); }
    }
    expect(hexMax - hexMin).toBeCloseTo(d, 6);
    expect(model.title).toBe(`Ниппель сдвоенный ${nominal}(н)`);
    model.dispose(); old.dispose();
  });

  it('только 1 × 1 и 1 1/4 × 1 1/4; короткий — ошибка', () => {
    expect(codes({ nominalLeft: '3/4', nominalRight: '3/4', length: 0.036, kind: 'double' })).toEqual(['incompatible:kind']);
    expect(codes({ nominalLeft: '1', nominalRight: '1 1/4', length: 0.045, kind: 'double' })).toEqual(['incompatible:kind']);
    // 1": резьба 9,09 мм, половина шестигранника 8 мм.
    expect(codes({ nominalLeft: '1', nominalRight: '1', length: 0.034, kind: 'double' })).toEqual(['too_short:length']);
    expect(codes({ nominalLeft: '1', nominalRight: '1', length: 0.0345, kind: 'double' })).toEqual([]);
  });
});
