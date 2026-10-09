import { describe, expect, it } from 'vitest';
import {
  BoilerGenerator,
  CirculationPumpGenerator,
  ExpansionTankGenerator,
  PumpNutGenerator,
  SafetyGroupGenerator,
  StrainerGenerator,
} from '../src/lib/index';
import type { Connector, GeneratedModel, ModelGenerator } from '../src/lib/index';

// Габариты всех наборов сверяются с gl2 в gl2Reference.test.ts; здесь — разъёмы и проверки параметров.
// Наружный диаметр резьбы по sizeRezba, м: внутренняя — d, наружная — d − t.
const byId = (model: GeneratedModel, id: string): Connector => model.connectors.find((c) => c.id === id)!;
const codes = <T>(generator: ModelGenerator<T>, params: T) => generator.validate(params).map(({ code, param }) => `${code}:${param}`);
const expectPosition = (connector: Connector, x: number, y: number, z: number) => {
  expect(connector.position.x, `${connector.id}.x`).toBeCloseTo(x, 9);
  expect(connector.position.y, `${connector.id}.y`).toBeCloseTo(y, 9);
  expect(connector.position.z, `${connector.id}.z`).toBeCloseTo(z, 9);
};

describe('циркуляционный насос equipment.pump', () => {
  it('патрубки с наружной резьбой по оси X у задней стенки мотора', () => {
    const model = new CirculationPumpGenerator().build({ nominal: '1' });
    // Ось корпуса: −z1/2 − z3 + 0.005; торцы — концы патрубков 0.09 + 0.005.
    expectPosition(byId(model, 'left'), -0.095, 0, -0.0625);
    expectPosition(byId(model, 'right'), 0.095, 0, -0.0625);
    expect(byId(model, 'left')).toMatchObject({ depth: 0.01, nominal: '1', joint: 'thread', gender: 'external', direction: { x: -1, y: 0, z: 0 } });
    expect(model.title).toBe('цирк. насос 1');
  });
});

describe('гайка для насоса equipment.pump-nut', () => {
  it('две внутренние резьбы, длина гайки 0,3 n, не меньше 12 мм', () => {
    const model = new PumpNutGenerator().build({ pumpNominal: '1 1/4', pipeNominal: '1' });
    const pump = byId(model, 'pump');
    expect(pump).toMatchObject({ nominal: '1 1/4', joint: 'thread', gender: 'internal' });
    expect(pump.depth).toBeCloseTo(0.015 * 0.0423 * 20, 9);
    expectPosition(pump, -0.015 * 0.0423 * 20, 0, 0);
    expect(byId(model, 'pipe')).toMatchObject({ nominal: '1', depth: 0.012, position: { x: 0.012, y: 0, z: 0 } });
    expect(model.title).toBe('Гайка для насоса 1 1/4(в)х1(в)');
  });

  it('ответная к патрубку насоса', () => {
    const pump = byId(new CirculationPumpGenerator().build({ nominal: '1 1/4' }), 'right');
    const nut = byId(new PumpNutGenerator().build({ pumpNominal: '1 1/4', pipeNominal: '1' }), 'pump');
    expect([pump.joint, pump.nominal]).toEqual([nut.joint, nut.nominal]);
    expect(pump.gender).not.toBe(nut.gender);
  });
});

describe('фильтр косой equipment.strainer', () => {
  const generator = new StrainerGenerator();

  it('внутренняя резьба на концах, торцы на ±m1/2', () => {
    const model = generator.build({ nominal: '3/4', length: 0.065 });
    expectPosition(byId(model, 'left'), -0.0325, 0, 0);
    expectPosition(byId(model, 'right'), 0.0325, 0, 0);
    expect(byId(model, 'right')).toMatchObject({ depth: 0.012, nominal: '3/4', joint: 'thread', gender: 'internal' });
    expect(model.title).toBe('Фильтр косой 3/4(в-в)');
  });

  it('корпус между резьбами нулевой длины — ошибка', () => {
    expect(codes(generator, { nominal: '3/4', length: 0.024 })).toEqual(['too_short:length']);
  });
});

describe('расширительный бак equipment.expansion-tank', () => {
  const generator = new ExpansionTankGenerator();

  it('штуцер с наружной резьбой вниз под нижним днищем', () => {
    const model = generator.build({ diameter: 0.245, height: 0.25, nominal: '3/4', volume: 6 });
    // Низ днища −h2/2 − d/4; втулка заходит на 5 мм, дальше 10 мм втулки и 15 мм резьбы.
    const bottom = byId(model, 'bottom');
    expectPosition(bottom, 0, -(0.25 - 0.1225) / 2 - 0.245 / 4 + 0.005 - 0.025, 0);
    expect(bottom).toMatchObject({ depth: 0.015, nominal: '3/4', joint: 'thread', gender: 'external', direction: { x: 0, y: -1, z: 0 } });
    expect(model.title).toBe('Расш.бак 6л');
  });

  it('высота не больше радиуса — ошибка', () => {
    expect(codes(generator, { diameter: 0.245, height: 0.12, nominal: '3/4', volume: 6 })).toEqual(['too_short:height']);
  });
});

describe('котёл equipment.boiler', () => {
  const generator = new BoilerGenerator();
  const size = { x: 0.4, y: 0.73, z: 0.3 };
  // 3/4 наружная: n = 26.8 − 2.8 = 24 мм; удлинитель и резьба — по 0,4 n.
  const x1 = 0.0096;

  it('четыре расположения патрубков с наружной резьбой', () => {
    const bottom = generator.build({ dimensions: size, nominal: '3/4', connection: 'bottom' });
    expectPosition(byId(bottom, 'bottom-left'), -0.08, -(0.365 + 2 * x1), -0.09);
    expectPosition(byId(bottom, 'bottom-right'), 0.08, -(0.365 + 2 * x1), -0.09);
    expect(bottom.title).toBe('Котел (разъемы снизу)');

    const back = generator.build({ dimensions: size, nominal: '3/4', connection: 'back' });
    expectPosition(byId(back, 'back-left'), -0.08, -0.315, -(0.15 + 2 * x1));
    expect(byId(back, 'back-right').direction).toEqual({ x: 0, y: 0, z: -1 });

    const topBottom = generator.build({ dimensions: size, nominal: '3/4', connection: 'top-bottom' });
    expectPosition(byId(topBottom, 'top'), 0, 0.365 + 2 * x1, -0.09);
    expectPosition(byId(topBottom, 'bottom'), 0, -(0.365 + 2 * x1), -0.09);

    const sides = generator.build({ dimensions: size, nominal: '3/4', connection: 'left-right' });
    expectPosition(byId(sides, 'left'), -(0.2 + 2 * x1), -0.315, -0.09);
    expect(byId(sides, 'right')).toMatchObject({ nominal: '3/4', joint: 'thread', gender: 'external' });
    expect(byId(sides, 'right').depth).toBeCloseTo(x1, 9);
    expect(sides.title).toBe('Котел (разъемы слева-справа)');
  });

  it('неизвестное расположение — ошибка', () => {
    expect(codes(generator, { dimensions: size, nominal: '3/4', connection: 'front' as 'back' })).toEqual(['unknown_option:connection']);
  });
});

describe('группа безопасности equipment.safety-group', () => {
  it('один разъём — гайка с внутренней резьбой снизу', () => {
    const model = new SafetyGroupGenerator().build({ dimensions: { x: 0.18, y: 0.05, z: 0.05 }, nominal: '1' });
    expect(model.connectors).toHaveLength(1);
    // 1 внутренняя: n = 33.5 мм, высота гайки 0,4 n.
    const bottom = byId(model, 'bottom');
    expectPosition(bottom, 0, -(0.025 + 0.0134), 0);
    expect(bottom).toMatchObject({ nominal: '1', joint: 'thread', gender: 'internal' });
    expect(bottom.depth).toBeCloseTo(0.0134, 9);
    expect(model.title).toBe('Группа безопасности');
  });
});
