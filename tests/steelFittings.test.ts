import { describe, expect, it } from 'vitest';
import { GeneratorParamsError } from '../src/lib/index';
import type { Connector, GeneratedModel, ModelGenerator } from '../src/lib/index';
import { SteelCrossGenerator } from '../src/lib/generators/steel/SteelCrossGenerator';
import { SteelElbow45Generator } from '../src/lib/generators/steel/SteelElbow45Generator';
import { SteelElbowGenerator } from '../src/lib/generators/steel/SteelElbowGenerator';
import { SteelHalfUnionGenerator } from '../src/lib/generators/steel/SteelHalfUnionGenerator';
import { SteelManifoldGenerator } from '../src/lib/generators/steel/SteelManifoldGenerator';
import { SteelPlugGenerator } from '../src/lib/generators/steel/SteelPlugGenerator';
import { SteelTeeGenerator } from '../src/lib/generators/steel/SteelTeeGenerator';
import { SteelValveManifoldGenerator } from '../src/lib/generators/steel/SteelValveManifoldGenerator';

// Габариты всех наборов сверяются с gl2 в gl2Reference.test.ts; здесь — разъёмы и проверки параметров.
// d и t по таблице sizeRezba, мм.
const PIPE: Record<string, [number, number]> = {
  '1/4': [13.5, 2.2], '3/8': [17.0, 2.2], '1/2': [21.3, 2.7], '3/4': [26.8, 2.8],
  '1': [33.5, 3.2], '1 1/4': [42.3, 3.2], '1 1/2': [48.0, 3.5], '2': [60.0, 3.5],
};
/** Наружный диаметр детали, м: внутренняя резьба — d, наружная — d − t. */
const n = (nominal: string, side: 'v' | 'n') => Math.round((PIPE[nominal][0] - (side === 'n' ? PIPE[nominal][1] : 0)) * 10) / 10000;

const byId = (model: GeneratedModel, id: string): Connector => model.connectors.find((c) => c.id === id)!;
const codes = <T>(generator: ModelGenerator<T>, params: T) => generator.validate(params).map(({ code, param }) => `${code}:${param}`);
const X = { x: 1, y: 0, z: 0 };
const Y = { x: 0, y: 1, z: 0 };
const minusX = { x: -1, y: 0, z: 0 };

describe('заглушка steel.plug', () => {
  const generator = new SteelPlugGenerator();

  it('разъём на конце резьбы, глубина — резьба 8…12 мм', () => {
    for (const [r1, m1] of [['1/2', 0.022], ['2', 0.039]] as const) {
      const model = generator.build({ nominal: r1, length: m1 });
      const thread = Math.min(Math.max(0.3 * n(r1, 'n'), 0.008), 0.012);
      expect(model.connectors).toHaveLength(1);
      expect(byId(model, 'left')).toMatchObject({ direction: minusX, up: Y, nominal: r1, joint: 'thread', gender: 'external' });
      expect(byId(model, 'left').position.x).toBeCloseTo(-m1 / 2, 9);
      expect(byId(model, 'left').depth).toBeCloseTo(thread, 9);
      // Шестигранник: длина n/7 по центру.
      expect(model.bounds.max.x).toBeCloseTo(n(r1, 'n') / 14, 9);
      expect(model.title).toBe(`Заглушка ${r1}(н)`);
    }
  });

  it('m1 не больше двух длин резьбы — ошибка', () => {
    // 2": резьба 12 мм.
    expect(codes(generator, { nominal: '2', length: 0.024 })).toEqual(['too_short:length']);
    expect(codes(generator, { nominal: '2', length: 0.0245 })).toEqual([]);
    expect(() => generator.build({ nominal: '7/8', length: 0.02 })).toThrow(GeneratorParamsError);
  });
});

describe('полусгон steel.half-union', () => {
  const generator = new SteelHalfUnionGenerator();

  it('гайка слева с внутренней резьбой r1, патрубок справа с наружной r2', () => {
    const params = { nutNominal: '3/4', pipeNominal: '1/2', length: 0.04 };
    const model = generator.build(params);
    const x1 = 0.4 * n('3/4', 'v');
    const x2 = 0.4 * n('1/2', 'n');
    // Корпус гайки кончается в 1 мм правее оси, резьба гайки — от её левого края.
    expect(byId(model, 'nut')).toMatchObject({ direction: minusX, nominal: '3/4', gender: 'internal' });
    expect(byId(model, 'nut').position.x).toBeCloseTo(0.001 - 1.5 * x1, 9);
    expect(byId(model, 'nut').depth).toBeCloseTo(x1, 9);
    expect(byId(model, 'pipe')).toMatchObject({ direction: X, nominal: '1/2', gender: 'external' });
    expect(byId(model, 'pipe').position.x).toBeCloseTo(0.04, 9);
    expect(byId(model, 'pipe').depth).toBeCloseTo(2.3 * x2, 9);
    expect(model.title).toBe('Полусгон 1/2');
  });

  it('гладкий участок патрубка нулевой длины — ошибка', () => {
    const x2 = 0.4 * n('1/2', 'n');
    expect(codes(generator, { nutNominal: '3/4', pipeNominal: '1/2', length: 2.3 * x2 + 0.002 })).toEqual(['too_short:length']);
    expect(codes(generator, { nutNominal: '3/4', pipeNominal: '1/2', length: 2.3 * x2 + 0.0025 })).toEqual([]);
  });
});

describe('угол стальной 90° steel.elbow-90', () => {
  const generator = new SteelElbowGenerator();

  it('внутренняя резьба: торец за кольцом, глубина — резьба и кольцо', () => {
    const model = generator.build({ threadGender: 'internal', nominal: '1/2', armLength: 0.023 });
    const ring = n('1/2', 'v') / 10;
    const right = byId(model, 'right');
    const top = byId(model, 'top');
    expect(right).toMatchObject({ direction: X, up: Y, gender: 'internal', joint: 'thread', nominal: '1/2' });
    expect(top).toMatchObject({ direction: Y, up: X, gender: 'internal' });
    expect(right.position.x).toBeCloseTo(0.023 + ring, 9);
    expect(top.position.y).toBeCloseTo(0.023 + ring, 9);
    expect(right.depth).toBeCloseTo(0.015 + ring, 9);
    expect(model.title).toBe('Угол 1/2(в)');
  });

  it('наружная резьба: торец — конец резьбы, глубина — без кольца у начала', () => {
    const model = generator.build({ threadGender: 'external', nominal: '1', armLength: 0.041 });
    expect(byId(model, 'right')).toMatchObject({ gender: 'external' });
    expect(byId(model, 'right').position.x).toBeCloseTo(0.041, 9);
    expect(byId(model, 'right').depth).toBeCloseTo(0.015 - n('1', 'n') / 10, 9);
    expect(model.title).toBe('Угол 1(н)');
  });

  it('плечо короче резьбы — ошибка', () => {
    expect(codes(generator, { threadGender: 'internal', nominal: '1/2', armLength: 0.015 })).toEqual(['too_short:armLength']);
    expect(codes(generator, { threadGender: 'x' as 'internal', nominal: '1/2', armLength: 0.02 })).toEqual(['unknown_option:threadGender']);
  });
});

describe('угол стальной 45° steel.elbow-45', () => {
  it('второй выход — левый, повёрнутый на 45° вверх', () => {
    const model = new SteelElbow45Generator().build({ nominal: '3/4', armLength: 0.022 });
    const face = 0.022 + n('3/4', 'v') / 10;
    const left = byId(model, 'left');
    expect(left.direction.x).toBeCloseTo(-Math.SQRT1_2, 12);
    expect(left.direction.y).toBeCloseTo(Math.SQRT1_2, 12);
    expect(left.up.x).toBeCloseTo(Math.SQRT1_2, 12);
    expect(left.up.y).toBeCloseTo(Math.SQRT1_2, 12);
    expect(left.position.x).toBeCloseTo(-face * Math.SQRT1_2, 9);
    expect(left.position.y).toBeCloseTo(face * Math.SQRT1_2, 9);
    expect(byId(model, 'right').position.x).toBeCloseTo(face, 9);
    expect(model.title).toBe('Угол_45 3/4(в)');
  });
});

describe('тройник steel.tee', () => {
  const generator = new SteelTeeGenerator();

  it('выходы слева, вверх и справа со своими номиналами', () => {
    const model = generator.build({ threadGender: 'internal', nominalLeft: '1', nominalBranch: '1/2', nominalRight: '1', length: 0.056, branchLength: 0.03 });
    expect(model.connectors.map((c) => [c.id, c.nominal])).toEqual([['left', '1'], ['top', '1/2'], ['right', '1']]);
    expect(byId(model, 'left').position.x).toBeCloseTo(-0.028, 9);
    expect(byId(model, 'top').position.y).toBeCloseTo(0.03, 9);
    expect(byId(model, 'top')).toMatchObject({ direction: Y, up: X });
    expect(byId(model, 'right').depth).toBeCloseTo(0.015, 9);
    expect(model.title).toBe('Тройник 1(в)x1/2(в)x1(в)');
    expect(generator.build({ threadGender: 'external', nominalLeft: '1/2', nominalBranch: '1/2', nominalRight: '1/2', length: 0.06, branchLength: 0.03 }).title).toBe('Тройник 1/2(н)');
  });

  it('проход и отвод короче резьбы — ошибки', () => {
    expect(codes(generator, { threadGender: 'internal', nominalLeft: '1', nominalBranch: '1', nominalRight: '1', length: 0.03, branchLength: 0.015 })).toEqual(['too_short:length', 'too_short:branchLength']);
  });
});

describe('крестовина steel.cross', () => {
  it('четыре выхода на ±m1/2', () => {
    const model = new SteelCrossGenerator().build({ nominal: '1/2', size: 0.046 });
    const expected = { left: [-0.023, 0], right: [0.023, 0], bottom: [0, -0.023], top: [0, 0.023] };
    for (const [id, [x, y]] of Object.entries(expected)) {
      expect(byId(model, id).position.x, id).toBeCloseTo(x, 9);
      expect(byId(model, id).position.y, id).toBeCloseTo(y, 9);
    }
    expect(byId(model, 'bottom').up).toEqual({ x: -1, y: 0, z: 0 });
    expect(codes(new SteelCrossGenerator(), { nominal: '1/2', size: 0.03 })).toEqual(['too_short:size']);
  });
});

describe('коллекторы steel.manifold и steel.manifold-valves', () => {
  const plain = new SteelManifoldGenerator();
  const valves = new SteelValveManifoldGenerator();
  const params = { nominal: '1', outletNominal: '1/2', outlets: 3, length: 0.132, branchLength: 0.036 };

  it('выходы с шагом 36 мм по центру трубы, концы — в и н резьба r1', () => {
    const model = plain.build({ ...params, threadGender: 'external' });
    expect(model.connectors.map((c) => c.id)).toEqual(['left', 'outlet-1', 'outlet-2', 'outlet-3', 'right']);
    expect([1, 2, 3].map((i) => byId(model, `outlet-${i}`).position.x)).toEqual([-0.036, 0, 0.036]);
    expect(byId(model, 'outlet-2')).toMatchObject({ direction: Y, up: X, gender: 'external', nominal: '1/2' });
    expect(byId(model, 'outlet-2').position.y).toBeCloseTo(0.036, 9);
    expect(byId(model, 'left')).toMatchObject({ gender: 'internal', nominal: '1' });
    expect(byId(model, 'right')).toMatchObject({ gender: 'external', nominal: '1' });
    expect(byId(model, 'right').depth).toBeCloseTo(0.015 - 0.0033, 9);
    expect(model.title).toBe('коллектор 1x1/2(н) [3 вых.]');
    expect(plain.build({ ...params, threadGender: 'internal' }).title).toBe('коллектор 1x1/2(в) [3 вых.]');
  });

  it('с кранами: выход выше на 10 мм, ручки нужного цвета', () => {
    const model = valves.build({ ...params, handleColor: 'blue' });
    expect(byId(model, 'outlet-1').position.y).toBeCloseTo(0.046, 9);
    expect(model.materials).toContain('blue');
    expect(model.materials).not.toContain('red');
    expect(model.title).toBe('коллектор с кранами 1x1/2(н) [3 вых.]');
    expect(codes(valves, { ...params, handleColor: 'green' as 'red' })).toEqual(['unknown_option:handleColor']);
  });

  it('число выходов — целое 1…10', () => {
    expect(codes(plain, { ...params, threadGender: 'external', outlets: 0 })).toEqual(['out_of_range:outlets']);
    expect(codes(plain, { ...params, threadGender: 'external', outlets: 2.5 })).toEqual(['not_integer:outlets']);
    expect(codes(plain, { ...params, threadGender: 'external', branchLength: 0.015 })).toEqual(['too_short:branchLength']);
  });
});
