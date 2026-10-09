import { describe, expect, it } from 'vitest';
import {
  BoilerGenerator,
  CirculationPumpGenerator,
  ExpansionTankGenerator,
  MaterialLibrary,
  PumpNutGenerator,
  SafetyGroupGenerator,
  StrainerGenerator,
} from '../src/lib/index';
import type { Connector, GeneratedModel, ModelGenerator } from '../src/lib/index';

// Габариты всех наборов сверяются с gl2 в gl2Reference.test.ts; здесь — разъёмы и проверки параметров.
// Наружный диаметр резьбы по sizeRezba, м: внутренняя — d, наружная — d − t.
const materials = new MaterialLibrary();
const byId = (model: GeneratedModel, id: string): Connector => model.connectors.find((c) => c.id === id)!;
const codes = <T>(generator: ModelGenerator<T>, params: T) => generator.validate(params).map(({ code, param }) => `${code}:${param}`);
const expectPosition = (connector: Connector, x: number, y: number, z: number) => {
  expect(connector.position.x, `${connector.id}.x`).toBeCloseTo(x, 9);
  expect(connector.position.y, `${connector.id}.y`).toBeCloseTo(y, 9);
  expect(connector.position.z, `${connector.id}.z`).toBeCloseTo(z, 9);
};

describe('циркуляционный насос cr_zr_nasos_1', () => {
  it('патрубки с наружной резьбой по оси X у задней стенки мотора', () => {
    const model = new CirculationPumpGenerator(materials).build({ r1: '1' });
    // Ось корпуса: −z1/2 − z3 + 0.005; торцы — концы патрубков 0.09 + 0.005.
    expectPosition(byId(model, 'left'), -0.095, 0, -0.0625);
    expectPosition(byId(model, 'right'), 0.095, 0, -0.0625);
    expect(byId(model, 'left')).toMatchObject({ depth: 0.01, nominal: '1', joint: 'thread', gender: 'external', direction: { x: -1, y: 0, z: 0 } });
    expect(model.title).toBe('цирк. насос 1');
  });
});

describe('гайка для насоса cr_gaika_nasos_1', () => {
  it('две внутренние резьбы, длина гайки 0,3 n, не меньше 12 мм', () => {
    const model = new PumpNutGenerator(materials).build({ r1: '1 1/4', r2: '1' });
    const pump = byId(model, 'pump');
    expect(pump).toMatchObject({ nominal: '1 1/4', joint: 'thread', gender: 'internal' });
    expect(pump.depth).toBeCloseTo(0.015 * 0.0423 * 20, 9);
    expectPosition(pump, -0.015 * 0.0423 * 20, 0, 0);
    expect(byId(model, 'pipe')).toMatchObject({ nominal: '1', depth: 0.012, position: { x: 0.012, y: 0, z: 0 } });
    expect(model.title).toBe('Гайка для насоса 1 1/4(в)х1(в)');
  });

  it('ответная к патрубку насоса', () => {
    const pump = byId(new CirculationPumpGenerator(materials).build({ r1: '1 1/4' }), 'right');
    const nut = byId(new PumpNutGenerator(materials).build({ r1: '1 1/4', r2: '1' }), 'pump');
    expect([pump.joint, pump.nominal]).toEqual([nut.joint, nut.nominal]);
    expect(pump.gender).not.toBe(nut.gender);
  });
});

describe('фильтр косой filtr_kosoy_1', () => {
  const generator = new StrainerGenerator(materials);

  it('внутренняя резьба на концах, торцы на ±m1/2', () => {
    const model = generator.build({ r1: '3/4', m1: 0.065 });
    expectPosition(byId(model, 'left'), -0.0325, 0, 0);
    expectPosition(byId(model, 'right'), 0.0325, 0, 0);
    expect(byId(model, 'right')).toMatchObject({ depth: 0.012, nominal: '3/4', joint: 'thread', gender: 'internal' });
    expect(model.title).toBe('Фильтр косой 3/4(в-в)');
  });

  it('корпус между резьбами нулевой длины — ошибка', () => {
    expect(codes(generator, { r1: '3/4', m1: 0.024 })).toEqual(['too_short:m1']);
  });
});

describe('расширительный бак cr_rash_bak_1', () => {
  const generator = new ExpansionTankGenerator(materials);

  it('штуцер с наружной резьбой вниз под нижним днищем', () => {
    const model = generator.build({ d: 0.245, h1: 0.25, r1: '3/4', name: '6л' });
    // Низ днища −h2/2 − d/4; втулка заходит на 5 мм, дальше 10 мм втулки и 15 мм резьбы.
    const bottom = byId(model, 'bottom');
    expectPosition(bottom, 0, -(0.25 - 0.1225) / 2 - 0.245 / 4 + 0.005 - 0.025, 0);
    expect(bottom).toMatchObject({ depth: 0.015, nominal: '3/4', joint: 'thread', gender: 'external', direction: { x: 0, y: -1, z: 0 } });
    expect(model.title).toBe('Расш.бак 6л');
  });

  it('высота не больше радиуса — ошибка', () => {
    expect(codes(generator, { d: 0.245, h1: 0.12, r1: '3/4', name: '6л' })).toEqual(['too_short:h1']);
  });
});

describe('котёл cr_kotel_1', () => {
  const generator = new BoilerGenerator(materials);
  const size = { x: 0.4, y: 0.73, z: 0.3 };
  // 3/4 наружная: n = 26.8 − 2.8 = 24 мм; удлинитель и резьба — по 0,4 n.
  const x1 = 0.0096;

  it('четыре расположения патрубков с наружной резьбой', () => {
    const bottom = generator.build({ size, r1: '3/4', type: 'bottom' });
    expectPosition(byId(bottom, 'bottom-left'), -0.08, -(0.365 + 2 * x1), -0.09);
    expectPosition(byId(bottom, 'bottom-right'), 0.08, -(0.365 + 2 * x1), -0.09);
    expect(bottom.title).toBe('Котел (разъемы снизу)');

    const back = generator.build({ size, r1: '3/4', type: 'back' });
    expectPosition(byId(back, 'back-left'), -0.08, -0.315, -(0.15 + 2 * x1));
    expect(byId(back, 'back-right').direction).toEqual({ x: 0, y: 0, z: -1 });

    const topBottom = generator.build({ size, r1: '3/4', type: 'top-bottom' });
    expectPosition(byId(topBottom, 'top'), 0, 0.365 + 2 * x1, -0.09);
    expectPosition(byId(topBottom, 'bottom'), 0, -(0.365 + 2 * x1), -0.09);

    const sides = generator.build({ size, r1: '3/4', type: 'left-right' });
    expectPosition(byId(sides, 'left'), -(0.2 + 2 * x1), -0.315, -0.09);
    expect(byId(sides, 'right')).toMatchObject({ nominal: '3/4', joint: 'thread', gender: 'external' });
    expect(byId(sides, 'right').depth).toBeCloseTo(x1, 9);
    expect(sides.title).toBe('Котел (разъемы слева-справа)');
  });

  it('неизвестное расположение — ошибка', () => {
    expect(codes(generator, { size, r1: '3/4', type: 'front' as 'back' })).toEqual(['unknown_option:type']);
  });
});

describe('группа безопасности gr_bez_1', () => {
  it('один разъём — гайка с внутренней резьбой снизу', () => {
    const model = new SafetyGroupGenerator(materials).build({ size: { x: 0.18, y: 0.05, z: 0.05 }, r1: '1' });
    expect(model.connectors).toHaveLength(1);
    // 1 внутренняя: n = 33.5 мм, высота гайки 0,4 n.
    const bottom = byId(model, 'bottom');
    expectPosition(bottom, 0, -(0.025 + 0.0134), 0);
    expect(bottom).toMatchObject({ nominal: '1', joint: 'thread', gender: 'internal' });
    expect(bottom.depth).toBeCloseTo(0.0134, 9);
    expect(model.title).toBe('Группа безопасности');
  });
});
