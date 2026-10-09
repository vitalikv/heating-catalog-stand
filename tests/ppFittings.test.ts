import { describe, expect, it } from 'vitest';
import type { Connector, GeneratedModel, ModelGenerator } from '../src/lib/index';
import { PpCouplingGenerator } from '../src/lib/generators/pp/PpCouplingGenerator';
import { PpCrossGenerator } from '../src/lib/generators/pp/PpCrossGenerator';
import { PpElbow45Generator } from '../src/lib/generators/pp/PpElbow45Generator';
import { PpReducingTeeGenerator } from '../src/lib/generators/pp/PpReducingTeeGenerator';
import { PpTeeGenerator } from '../src/lib/generators/pp/PpTeeGenerator';
import { PpThreadAdapterGenerator } from '../src/lib/generators/pp/PpThreadAdapterGenerator';
import { PpThreadElbowGenerator } from '../src/lib/generators/pp/PpThreadElbowGenerator';
import { PpThreadTeeGenerator } from '../src/lib/generators/pp/PpThreadTeeGenerator';

// Габариты всех наборов сверяются с gl2 в gl2Reference.test.ts; здесь — разъёмы и проверки параметров.
// Толщина стенки t по таблице sizeTubePP, мм; n = d + 1.4t.
const WALL: Record<string, number> = { '20': 4.2, '25': 5.4, '32': 6.7, '40': 8.3, '50': 10.5, '63': 12.5 };
const ppN = (nominal: string) => Math.round((Number(nominal) + 1.4 * WALL[nominal]) * 10) / 10000;

const byId = (model: GeneratedModel, id: string): Connector => model.connectors.find((c) => c.id === id)!;
const codes = <T>(generator: ModelGenerator<T>, params: T) => generator.validate(params).map(({ code, param }) => `${code}:${param}`);
const socket = { joint: 'pp-socket', gender: 'internal' };

describe('отвод ПП 45° pp.elbow-45', () => {
  it('раструбы на концах плеч, второй — под 45°', () => {
    const model = new PpElbow45Generator().build({ nominal: '25', armLength: 0.024 });
    const left = byId(model, 'left');
    expect(byId(model, 'right')).toMatchObject({ ...socket, depth: 0.015, nominal: '25', position: { x: 0.024, y: 0, z: 0 } });
    expect(left).toMatchObject({ ...socket, depth: 0.015 });
    expect(left.position.x).toBeCloseTo(-0.024 * Math.SQRT1_2, 9);
    expect(left.position.y).toBeCloseTo(0.024 * Math.SQRT1_2, 9);
    expect(model.title).toBe('Отвод_45 25');
    expect(codes(new PpElbow45Generator(), { nominal: '25', armLength: 0.015 })).toEqual(['too_short:armLength']);
  });
});

describe('угол ПП с резьбой pp.elbow-90-thread', () => {
  const generator = new PpThreadElbowGenerator();

  it('внутренняя резьба: втулка выступает на 0,5 мм; наружная — торец за корпусом', () => {
    const inner = generator.build({ threadGender: 'internal', pipeNominal: '20', threadNominal: '1/2', armLength: 0.026 });
    expect(byId(inner, 'right')).toMatchObject({ joint: 'thread', gender: 'internal', nominal: '1/2', depth: 0.015 });
    expect(byId(inner, 'right').position.x).toBeCloseTo(0.0265, 9);
    expect(byId(inner, 'top')).toMatchObject({ ...socket, nominal: '20', position: { x: 0, y: 0.026, z: 0 } });
    expect(inner.title).toBe('Угол 20x1/2(в)');

    const outer = generator.build({ threadGender: 'external', pipeNominal: '20', threadNominal: '1/2', armLength: 0.026 });
    expect(byId(outer, 'right')).toMatchObject({ gender: 'external' });
    expect(byId(outer, 'right').position.x).toBeCloseTo(0.041, 9);
    expect(outer.bounds.max.x).toBeCloseTo(0.041, 6);
  });
});

describe('муфта ПП pp.coupling', () => {
  const generator = new PpCouplingGenerator();

  it('глубина раструба — 0,3 n, не меньше 12 мм', () => {
    const model = generator.build({ nominalLeft: '63', nominalRight: '25', length: 0.065 });
    expect(byId(model, 'left')).toMatchObject({ ...socket, nominal: '63' });
    expect(byId(model, 'left').depth).toBeCloseTo(0.3 * ppN('63'), 9);
    expect(byId(model, 'right').depth).toBeCloseTo(0.012, 9);
    expect(byId(model, 'right').position.x).toBeCloseTo(0.0325, 9);
    expect(model.title).toBe('Муфта 63х25');
    expect(generator.build({ nominalLeft: '20', nominalRight: '20', length: 0.032 }).title).toBe('Муфта 20');
  });

  it('длина не больше двух раструбов — ошибка', () => {
    expect(codes(generator, { nominalLeft: '63', nominalRight: '25', length: 0.6 * ppN('63') })).toEqual(['too_short:length']);
    expect(codes(generator, { nominalLeft: '63', nominalRight: '25', length: 0.6 * ppN('63') + 0.0005 })).toEqual([]);
  });
});

describe('соединитель ПП с резьбой pp.thread-adapter', () => {
  it('слева раструб, справа резьба', () => {
    const generator = new PpThreadAdapterGenerator();
    const inner = generator.build({ threadGender: 'internal', pipeNominal: '25', threadNominal: '3/4', length: 0.041 });
    expect(byId(inner, 'left')).toMatchObject({ ...socket, nominal: '25' });
    expect(byId(inner, 'right')).toMatchObject({ joint: 'thread', gender: 'internal', nominal: '3/4' });
    expect(byId(inner, 'right').position.x).toBeCloseTo(0.0205 + 0.0005, 9);
    // Внутренняя резьба 3/4: n = d = 26.8 мм, длина 0.3 n = 8 мм — меньше минимума 12 мм.
    expect(byId(inner, 'right').depth).toBeCloseTo(0.012, 9);
    expect(inner.title).toBe('Соединитель 25х3/4(в)');

    const outer = generator.build({ threadGender: 'external', pipeNominal: '25', threadNominal: '3/4', length: 0.041 });
    const thread = Math.max(0.3 * 0.024, 0.012);
    expect(byId(outer, 'right').position.x).toBeCloseTo(0.0205 + thread, 9);
  });
});

describe('тройники ПП', () => {
  it('pl_troinik_1: отвод высотой m1/2', () => {
    const model = new PpTeeGenerator().build({ nominal: '32', length: 0.08 });
    expect(model.connectors.map((c) => c.id)).toEqual(['left', 'top', 'right']);
    expect(byId(model, 'top').position.y).toBeCloseTo(0.04, 9);
    expect(byId(model, 'left').position.x).toBeCloseTo(-0.04, 9);
    expect(model.title).toBe('Тройник 32');
  });

  it('pl_troinik_2: торец отвода на m2 + dc/2, раструбы 20 мм', () => {
    const model = new PpReducingTeeGenerator().build({ nominalLeft: '40', nominalBranch: '25', nominalRight: '40', length: 0.075, branchLength: 0.016 });
    expect(byId(model, 'top')).toMatchObject({ ...socket, nominal: '25', depth: 0.02 });
    expect(byId(model, 'top').position.y).toBeCloseTo(0.016 + ppN('40') / 2, 9);
    expect(model.title).toBe('Тройник 40x25x40');
    expect(codes(new PpReducingTeeGenerator(), { nominalLeft: '40', nominalBranch: '25', nominalRight: '40', length: 0.04, branchLength: 0.016 })).toEqual(['too_short:length']);
  });

  it('pl_troinik_rezba_1: резьба на отводе', () => {
    const model = new PpThreadTeeGenerator().build({ threadGender: 'external', pipeNominal: '20', threadNominal: '3/4', length: 0.07 });
    expect(byId(model, 'top')).toMatchObject({ joint: 'thread', gender: 'external', nominal: '3/4', depth: 0.015 });
    expect(byId(model, 'top').position.y).toBeCloseTo(0.035 + 0.015, 9);
    expect(byId(model, 'right')).toMatchObject({ ...socket, nominal: '20' });
    expect(model.title).toBe('Тройник 20x3/4(н)x20');
  });
});

describe('крестовина ПП pp.cross', () => {
  it('четыре раструба', () => {
    const model = new PpCrossGenerator().build({ nominal: '20', size: 0.052 });
    expect(model.connectors.map((c) => c.id)).toEqual(['left', 'right', 'bottom', 'top']);
    expect(byId(model, 'bottom').position.y).toBeCloseTo(-0.026, 9);
    expect(model.title).toBe('Крестовина 20');
  });
});
