import { describe, expect, it } from 'vitest';
import { ConnectorMating, GeneratorParamsError } from '../src/lib/index';
import type { AluminiumRadiatorParams, Connector, GeneratedModel, ModelGenerator } from '../src/lib/index';
import { AluminiumRadiatorGenerator } from '../src/lib/generators/radiator/AluminiumRadiatorGenerator';
import { SteelNippleGenerator } from '../src/lib/generators/steel/SteelNippleGenerator';
import { boundsBox } from './modelHelpers';

// Наборы al_radiator_1 из gl2/createObj/start.js: 6 высот × 1…10 секций.
const PRESETS: AluminiumRadiatorParams[] = [0.2, 0.35, 0.5, 0.6, 0.7, 0.8].flatMap((y) =>
  Array.from({ length: 10 }, (_, i) => ({ sections: i + 1, dimensions: { x: 0.08, y, z: 0.08 }, nominal: '1' })),
);

/**
 * Ожидаемые размеры по формулам al_radiator_1, независимо от генератора.
 * Для '1': d = 33.5 мм, коллектор n = 1.2 × d. Значения для 1×200, 3×500 и 10×800
 * дополнительно сверены с моделью, построенной в gl2 (9 октября 2026).
 */
function expected({ sections: count, dimensions: size }: AluminiumRadiatorParams) {
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

describe.each(PRESETS)('радиатор $sections шт., h = $dimensions.y', (params) => {
  const exp = expected(params);

  it('секции слиты в одну геометрию, буферы согласованы', () => {
    expect(generator.validate(params)).toEqual([]);
    const model = generator.build(params);
    const geometry = model.geometry;
    const position = geometry.getAttribute('position');
    expect(geometry.index).toBeNull();
    // В gl2 у секции 2036 треугольников; секции — копии со сдвигом на шаг.
    expect(position.count / 3).toBe(2036 * params.sections);
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
    const h = params.dimensions.y / 2;
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
  const base: AluminiumRadiatorParams = { sections: 3, dimensions: { x: 0.08, y: 0.5, z: 0.08 }, nominal: '1' };
  const codes = (patch: Partial<AluminiumRadiatorParams>) =>
    generator.validate({ ...base, ...patch }).map(({ code, param }) => `${code}:${param}`);

  it('ошибки параметров', () => {
    expect(codes({ sections: 0 })).toEqual(['out_of_range:sections']);
    expect(codes({ sections: 11 })).toEqual(['out_of_range:sections']);
    expect(codes({ sections: 2.5 })).toEqual(['not_integer:sections']);
    expect(codes({ nominal: '7/8' })).toEqual(['unknown_option:nominal']);
    expect(codes({ dimensions: { x: 0.04, y: 0.5, z: 0.08 } })).toEqual(['out_of_range:dimensions.x']);
    expect(codes({ dimensions: { x: 0.08, y: 0.05, z: 0.08 } })).toEqual(['out_of_range:dimensions.y']);
    expect(() => generator.build({ ...base, sections: 0 })).toThrow(GeneratorParamsError);
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

const byId = (model: GeneratedModel, id: string): Connector => model.connectors.find((c) => c.id === id)!;
const codes = <T>(g: ModelGenerator<T>, params: T) => g.validate(params).map(({ code, param }) => `${code}:${param}`);

describe('алюминиевый радиатор radiator.aluminium: нижнее подключение (версия 2)', () => {
  const base = { sections: 6, dimensions: { x: 0.08, y: 0.5, z: 0.08 }, nominal: '1' } as const;
  const geometryOf = (model: GeneratedModel) => Array.from(model.geometry.getAttribute('position').array);

  it("параметры версии 1 и явное 'side' — прежняя модель с четырьмя radiator-thread", () => {
    const old = generator.build(base);
    const side = generator.build({ ...base, connection: 'side', bottomSide: 'left', bottomNominal: '3/4' });
    expect(side.connectors).toEqual(old.connectors);
    expect(old.connectors.map((c) => c.joint)).toEqual(Array(4).fill('radiator-thread'));
    expect(geometryOf(side)).toEqual(geometryOf(old));
    expect(side.title).toBe(old.title);
    old.dispose(); side.dispose();
  });

  it.each([['right', 1], ['left', -1]] as const)("'bottom' %s: шесть портов, нижние thread вниз через 50 мм у крайнего торца", (bottomSide, sign) => {
    const side = generator.build(base);
    const model = generator.build({ ...base, connection: 'bottom', bottomSide, bottomNominal: '1/2' });
    expect(model.connectors.map((c) => c.id)).toEqual(['bottom-left', 'top-left', 'top-right', 'bottom-right', 'below-outer', 'below-inner']);
    expect(model.connectors.slice(0, 4)).toEqual(side.connectors);
    const endX = byId(side, sign > 0 ? 'bottom-right' : 'bottom-left').position.x;
    const outer = byId(model, 'below-outer');
    const inner = byId(model, 'below-inner');
    for (const port of [outer, inner]) {
      expect(port).toMatchObject({ joint: 'thread', gender: 'internal', nominal: '1/2', depth: 0.01, direction: { x: 0, y: -1, z: 0 } });
      // Резьба выступает на 10 мм ниже самой низкой точки секций (переднего ребра).
      expect(port.position.y).toBeCloseTo(side.bounds.min.y - 0.01, 6);
      expect(port.position.z).toBe(0);
    }
    expect(outer.position.x).toBeCloseTo(endX - sign * 0.05, 9);
    expect(inner.position.x - outer.position.x).toBeCloseTo(-sign * 0.05, 9);
    expect(model.bounds.min.y).toBeCloseTo(side.bounds.min.y - 0.01, 6);
    // Габарит по X и Z не меняется: патрубки под коллектором.
    expect(model.bounds.min.x).toBeCloseTo(side.bounds.min.x, 9);
    expect(model.bounds.max.x).toBeCloseTo(side.bounds.max.x, 9);
    expect(model.title).toBe('Ал.радиатор h500 (6шт.), нижн.');
    side.dispose(); model.dispose();
  });

  it('нижний номинал не меняет боковые порты', () => {
    const model = generator.build({ ...base, connection: 'bottom', bottomNominal: '3/4' });
    expect(model.connectors.slice(0, 4).every((c) => c.nominal === '1' && c.joint === 'radiator-thread')).toBe(true);
    expect(byId(model, 'below-inner').nominal).toBe('3/4');
    model.dispose();
  });

  it('минимальное, типовое и максимальное число секций', () => {
    const bottom = { ...base, connection: 'bottom', bottomNominal: '1/2' } as const;
    // 2 секции × 82 мм ≥ 50 + 50 + 10,65 + 21 мм; одна — нет.
    expect(codes(generator, { ...bottom, sections: 1 })).toEqual(['too_short:sections']);
    for (const sections of [2, 6, 10]) expect(codes(generator, { ...bottom, sections })).toEqual([]);
    expect(codes(generator, { ...base, sections: 1, connection: 'side' })).toEqual([]);
    expect(generator.validate({ ...bottom, sections: 1 })[0].message).toContain('не меньше 2');
  });

  it('нижняя резьба не шире коллектора; неверное подключение — ошибка', () => {
    // Коллектор 1": 33,5 × 1,2 = 40,2 мм; 1 1/4 — 42,3 мм.
    expect(codes(generator, { ...base, connection: 'bottom', bottomNominal: '1 1/4' })).toEqual(['incompatible:bottomNominal']);
    expect(codes(generator, { ...base, connection: 'bottom', bottomNominal: '1' })).toEqual([]);
    expect(codes(generator, { ...base, connection: 'top' as 'side' })).toEqual(['unknown_option:connection']);
  });

  it('обычный ниппель не стыкуется с боковым radiator-thread, стыкуется с нижним патрубком', () => {
    const model = generator.build({ ...base, connection: 'bottom', bottomNominal: '1/2' });
    const nipple = new SteelNippleGenerator().build({ nominalLeft: '3/4', nominalRight: '1/2', length: 0.026 });
    expect(ConnectorMating.check(byId(model, 'bottom-right'), byId(nipple, 'right')).compatible).toBe(false);
    expect(ConnectorMating.check(byId(model, 'below-outer'), byId(nipple, 'right')).compatible).toBe(true);
    model.dispose(); nipple.dispose();
  });
});
