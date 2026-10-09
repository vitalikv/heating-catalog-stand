import { describe, expect, it } from 'vitest';
import {
  ConnectorMating,
  MpCouplingGenerator,
  MpElbowGenerator,
  MpPipeSizes,
  MpTeeGenerator,
  MpThreadAdapterGenerator,
  MpThreadElbowGenerator,
  MpThreadTeeGenerator,
} from '../src/lib/index';
import type { Connector, GeneratedModel, ModelGenerator } from '../src/lib/index';

// Габариты всех наборов сверяются с gl2 в gl2Reference.test.ts; здесь — разъёмы и проверки параметров.
/** n = d + 0.7 мм (sizeTubeMP: t = 0.5, n = d + 1.4t). */
const mpN = (nominal: string) => Math.round((Number(nominal) + 0.7) * 10) / 10000;
/** Пресс-гильза: 0,9 n, не меньше 25 мм. */
const press = (nominal: string) => Math.max(0.9 * mpN(nominal), 0.025);

const byId = (model: GeneratedModel, id: string): Connector => model.connectors.find((c) => c.id === id)!;
const codes = <T>(generator: ModelGenerator<T>, params: T) => generator.validate(params).map(({ code, param }) => `${code}:${param}`);
const pressJoint = { joint: 'mp-press', gender: 'internal' };

describe('MpPipeSizes', () => {
  it('диаметры по sizeTubeMP', () => {
    expect(MpPipeSizes.nominals).toEqual(['16', '20', '26', '32', '40']);
    expect(MpPipeSizes.diameters('16')).toEqual({ n: 0.0167, v: 0.016 });
    expect(MpPipeSizes.diameters('40')).toEqual({ n: 0.0407, v: 0.04 });
    expect(MpPipeSizes.diameters('25')).toBeNull();
  });
});

describe('угол mp.elbow', () => {
  it('пресс-концы на концах плеч, глубина — длина гильзы', () => {
    for (const [r1, m1] of [['16', 0.042], ['40', 0.063]] as const) {
      const model = new MpElbowGenerator().build({ nominal: r1, armLength: m1 });
      expect(byId(model, 'right')).toMatchObject({ ...pressJoint, nominal: r1, position: { x: m1, y: 0, z: 0 } });
      expect(byId(model, 'right').depth).toBeCloseTo(press(r1), 9);
      expect(byId(model, 'top').position.y).toBeCloseTo(m1, 9);
      expect(model.title).toBe(`Угол ${r1}`);
    }
    expect(codes(new MpElbowGenerator(), { nominal: '16', armLength: 0.025 })).toEqual(['too_short:armLength']);
  });
});

describe('угол с резьбой mp.elbow-thread', () => {
  it('вправо — резьба за гайкой 7 мм, вверх — пресс', () => {
    const model = new MpThreadElbowGenerator().build({ threadGender: 'internal', pipeNominal: '20', threadNominal: '3/4', armLength: 0.044, threadArmLength: 0.032 });
    expect(byId(model, 'right')).toMatchObject({ joint: 'thread', gender: 'internal', nominal: '3/4', depth: 0.015 });
    expect(byId(model, 'right').position.x).toBeCloseTo(0.032 + 0.007, 9);
    expect(byId(model, 'top')).toMatchObject({ ...pressJoint, nominal: '20' });
    expect(model.title).toBe('Угол 20x3/4(в)');
  });
});

describe('соединители mp.coupling и mp.thread-adapter', () => {
  it('переходной соединитель: свои гильзы с двух сторон', () => {
    const model = new MpCouplingGenerator().build({ nominalLeft: '32', nominalRight: '16', length: 0.062 });
    expect(byId(model, 'left')).toMatchObject({ ...pressJoint, nominal: '32' });
    expect(byId(model, 'left').depth).toBeCloseTo(press('32'), 9);
    expect(byId(model, 'right').depth).toBeCloseTo(press('16'), 9);
    expect(byId(model, 'right').position.x).toBeCloseTo(0.031, 9);
    expect(model.title).toBe('Соединитель 32x16');
    expect(new MpCouplingGenerator().build({ nominalLeft: '20', nominalRight: '20', length: 0.06 }).title).toBe('Соединитель 20');
  });

  it('с резьбой: гильза укорачивается, если до неё меньше 1 мм трубы', () => {
    const generator = new MpThreadAdapterGenerator();
    // 40: 0,9 n = 36,6 мм > m1/2 − 1 мм = 29 мм.
    const short = generator.build({ threadGender: 'external', pipeNominal: '40', threadNominal: '1', length: 0.06 });
    expect(byId(short, 'left').depth).toBeCloseTo(0.029, 9);
    expect(byId(short, 'right')).toMatchObject({ joint: 'thread', gender: 'external', nominal: '1', depth: 0.015 });
    expect(byId(short, 'right').position.x).toBeCloseTo(0.03, 9);
    // 16: гильза не короче 20 мм.
    expect(byId(generator.build({ threadGender: 'internal', pipeNominal: '16', threadNominal: '1/2', length: 0.048 }), 'left').depth).toBeCloseTo(0.02, 9);
    expect(short.title).toBe('Соединитель 40x1(н)');
    // Шестигранник между буртиком 2,5 мм и резьбой 15 мм: нужно m1 > 35 мм.
    expect(codes(generator, { threadGender: 'internal', pipeNominal: '16', threadNominal: '1/2', length: 0.0349 })).toEqual(['too_short:length']);
    expect(codes(generator, { threadGender: 'internal', pipeNominal: '16', threadNominal: '1/2', length: 0.0355 })).toEqual([]);
  });
});

describe('тройники mp.tee и mp.tee-thread', () => {
  it('под пресс со всех сторон', () => {
    const model = new MpTeeGenerator().build({ nominalLeft: '26', nominalBranch: '16', nominalRight: '20', length: 0.096, branchLength: 0.047 });
    expect(model.connectors.map((c) => [c.id, c.nominal])).toEqual([['left', '26'], ['top', '16'], ['right', '20']]);
    expect(byId(model, 'top').position.y).toBeCloseTo(0.047, 9);
    expect(byId(model, 'top').depth).toBeCloseTo(press('16'), 9);
    expect(model.title).toBe('Тройник 26x16x20');
  });

  it('резьба на отводе: торец на m2, глубина 12 мм', () => {
    const model = new MpThreadTeeGenerator().build({ threadGender: 'internal', nominalLeft: '32', threadNominal: '1 1/4', nominalRight: '32', length: 0.122, branchLength: 0.046 });
    expect(byId(model, 'top')).toMatchObject({ joint: 'thread', gender: 'internal', nominal: '1 1/4', depth: 0.012 });
    expect(byId(model, 'top').position.y).toBeCloseTo(0.046, 9);
    expect(model.title).toBe('Тройник 32x1 1/4(в)x32');
  });
});

describe('способ соединения mp-press', () => {
  it('пресс-концы не стыкуются друг с другом и с резьбой', () => {
    const coupling = new MpCouplingGenerator().build({ nominalLeft: '20', nominalRight: '20', length: 0.06 });
    const adapter = new MpThreadAdapterGenerator().build({ threadGender: 'external', pipeNominal: '20', threadNominal: '1/2', length: 0.048 });
    expect(ConnectorMating.check(byId(coupling, 'right'), byId(adapter, 'left'))).toMatchObject({ compatible: false, reason: 'gender' });
    expect(ConnectorMating.check(byId(coupling, 'right'), byId(adapter, 'right'))).toMatchObject({ compatible: false, reason: 'joint' });
  });
});
