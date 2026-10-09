import { Matrix4, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { ConnectorMating, MaterialLibrary, MpCouplingGenerator, PipeGenerator, PpCouplingGenerator } from '../src/lib/index';
import type { Connector, GeneratedModel } from '../src/lib/index';

// В gl2 труба — объект редактора TubeN, эталона gl2Reference нет: габарит, разъёмы и название — здесь.
const materials = new MaterialLibrary();
const generator = new PipeGenerator(materials);
const byId = (model: GeneratedModel, id: string): Connector => model.connectors.find((c) => c.id === id)!;
const codes = (params: Parameters<PipeGenerator['validate']>[0]) => generator.validate(params).map(({ code, param }) => `${code}:${param}`);

describe('труба createTubeWF_1', () => {
  it('ПП: открытый цилиндр по наружному диаметру, раструбные разъёмы на концах', () => {
    const model = generator.build({ type: 'pp', ppSize: '25', length: 1.5 });
    expect(model.bounds.min.x).toBeCloseTo(-0.75, 9);
    expect(model.bounds.max.x).toBeCloseTo(0.75, 9);
    expect(model.bounds.max.y).toBeCloseTo(0.0125, 9);
    expect(model.bounds.max.z).toBeCloseTo(0.0125, 9);
    const common = { joint: 'pp-socket', gender: 'external', nominal: '25', depth: 0.75 };
    expect(byId(model, 'start')).toMatchObject({ ...common, position: { x: -0.75, y: 0, z: 0 }, direction: { x: -1, y: 0, z: 0 } });
    expect(byId(model, 'end')).toMatchObject({ ...common, position: { x: 0.75, y: 0, z: 0 }, direction: { x: 1, y: 0, z: 0 } });
    expect(model.title).toBe('Труба ПП 25 (1.5м)');
    model.dispose();
  });

  it('МП: та же геометрия, пресс-разъёмы, номинал по sizeTubeMP', () => {
    const model = generator.build({ type: 'mp', mpSize: '16', length: 0.25 });
    expect(model.bounds.max.y).toBeCloseTo(0.008, 9);
    expect(model.connectors.map((c) => [c.id, c.joint, c.gender, c.nominal])).toEqual([
      ['start', 'mp-press', 'external', '16'],
      ['end', 'mp-press', 'external', '16'],
    ]);
    expect(model.title).toBe('Труба МП 16 (0.25м)');
    model.dispose();
  });

  it('название: длина до 0,01 м, как в gl2', () => {
    expect(generator.build({ type: 'pp', ppSize: '20', length: 1.234 }).title).toBe('Труба ПП 20 (1.23м)');
  });

  it('номинал — из таблицы своего типа; второй номинал не проверяется', () => {
    expect(codes({ type: 'pp', ppSize: '16', length: 1 })).toEqual(['unknown_option:ppSize']);
    expect(codes({ type: 'mp', mpSize: '25', length: 1 })).toEqual(['unknown_option:mpSize']);
    expect(codes({ type: 'mp', mpSize: '26', ppSize: 'что угодно', length: 1 })).toEqual([]);
    expect(codes({ type: 'pp', ppSize: '20', length: 0 })).toEqual(['out_of_range:length']);
  });

  it('входит в муфту ПП и МП на глубину раструба или гильзы', () => {
    const cases = [
      { fitting: new PpCouplingGenerator(materials).build({ r1: '20', r2: '20', m1: 0.04 }), pipe: generator.build({ type: 'pp', ppSize: '20', length: 1 }) },
      { fitting: new MpCouplingGenerator(materials).build({ r1: '16', r3: '16', m1: 0.06 }), pipe: generator.build({ type: 'mp', mpSize: '16', length: 1 }) },
    ];
    for (const { fitting, pipe } of cases) {
      const socket = byId(fitting, 'right');
      const end = byId(pipe, 'start');
      const check = ConnectorMating.check(socket, end);
      expect(check).toEqual({ compatible: true, engagement: socket.depth });
      const matrix = ConnectorMating.place(socket, new Matrix4(), end);
      const placed = new Vector3().copy(end.position).applyMatrix4(matrix);
      expect(placed.x).toBeCloseTo(socket.position.x - socket.depth, 9);
      fitting.dispose();
      pipe.dispose();
    }
  });
});
