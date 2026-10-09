import { Matrix4, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { ConnectorMating, MpCouplingGenerator, MpPipeGenerator, PpCouplingGenerator, PpPipeGenerator } from '../src/lib/index';
import type { Connector, GeneratedModel, ModelGenerator } from '../src/lib/index';

// В gl2 труба — объект редактора TubeN, эталона gl2Reference нет: габарит, разъёмы и название — здесь.
const pp = new PpPipeGenerator();
const mp = new MpPipeGenerator();
const byId = (model: GeneratedModel, id: string): Connector => model.connectors.find((c) => c.id === id)!;
const codes = <T>(generator: ModelGenerator<T>, params: T) => generator.validate(params).map(({ code, param }) => `${code}:${param}`);

describe('трубы pp.pipe и mp.pipe', () => {
  it('ПП: открытый цилиндр по наружному диаметру, раструбные разъёмы на концах', () => {
    const model = pp.build({ nominal: '25', length: 1.5 });
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
    const model = mp.build({ nominal: '16', length: 0.25 });
    expect(model.bounds.max.y).toBeCloseTo(0.008, 9);
    expect(model.connectors.map((c) => [c.id, c.joint, c.gender, c.nominal])).toEqual([
      ['start', 'mp-press', 'external', '16'],
      ['end', 'mp-press', 'external', '16'],
    ]);
    expect(model.title).toBe('Труба МП 16 (0.25м)');
    model.dispose();
  });

  it('название: длина до 0,01 м, как в gl2', () => {
    expect(pp.build({ nominal: '20', length: 1.234 }).title).toBe('Труба ПП 20 (1.23м)');
  });

  it('номинал — из таблицы своего типа', () => {
    expect(codes(pp, { nominal: '16', length: 1 })).toEqual(['unknown_option:nominal']);
    expect(codes(mp, { nominal: '25', length: 1 })).toEqual(['unknown_option:nominal']);
    expect(codes(mp, { nominal: '26', length: 1 })).toEqual([]);
    expect(codes(pp, { nominal: '20', length: 0 })).toEqual(['out_of_range:length']);
  });

  it('входит в муфту ПП и МП на глубину раструба или гильзы', () => {
    const cases = [
      { fitting: new PpCouplingGenerator().build({ nominalLeft: '20', nominalRight: '20', length: 0.04 }), pipe: pp.build({ nominal: '20', length: 1 }) },
      { fitting: new MpCouplingGenerator().build({ nominalLeft: '16', nominalRight: '16', length: 0.06 }), pipe: mp.build({ nominal: '16', length: 1 }) },
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
