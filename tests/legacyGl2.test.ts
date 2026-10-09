import { describe, expect, it } from 'vitest';
import { GeneratorRegistry, MaterialLibrary } from '../src/lib/index';
import { fromGl2, GL2_IDS, gl2TargetId } from '../src/lib/legacy/gl2';
import { GL2_PRESETS } from '../src/stand/presets';
import reference from './fixtures/gl2-reference.json';

/** Семейство и деталь латиницей в kebab-case: 'steel.coupling', 'pp.elbow-90'. */
const ID_FORMAT = /^(steel|pp|mp|radiator|valve|equipment)\.[a-z0-9]+(-[a-z0-9]+)*$/;

const targets = Object.entries(GL2_IDS).flatMap(([id, target]) =>
  typeof target === 'string' ? [{ id, target }] : Object.values(target).map((variant) => ({ id, target: variant })),
);

describe('legacy/gl2', () => {
  it('таблица покрывает ID реестра, наборов стенда и эталона', () => {
    const ids = [
      ...new GeneratorRegistry(new MaterialLibrary()).list().map((generator) => generator.id),
      ...GL2_PRESETS.map((entry) => entry.generatorId),
      ...(reference as { id: string }[]).map((row) => row.id),
    ];
    expect([...new Set(ids)].filter((id) => !(id in GL2_IDS))).toEqual([]);
  });

  it('новые ID — в формате семейство.деталь и не совпадают, кроме слитых шаровых кранов', () => {
    for (const { id, target } of targets) expect(target, id).toMatch(ID_FORMAT);
    const sources = new Map<string, string[]>();
    for (const { id, target } of targets) sources.set(target, [...(sources.get(target) ?? []), id]);
    const shared = [...sources].filter(([, ids]) => ids.length > 1);
    expect(shared).toEqual([['valve.ball', ['shar_kran_v_1', 'shar_kran_n_1', 'shar_kran_v_n_1']]]);
  });

  it('труба делится по type, неизвестные ID и type — ошибка', () => {
    expect(gl2TargetId('createTubeWF_1', { type: 'pp' })).toBe('pp.pipe');
    expect(gl2TargetId('createTubeWF_1', { type: 'mp' })).toBe('mp.pipe');
    expect(() => gl2TargetId('createTubeWF_1', { type: 'cu' })).toThrow();
    expect(() => fromGl2('nope_1', {})).toThrow();
  });

  it('до шага 4 ID и параметры не меняются', () => {
    const cdm = { r1: '1/2', r2: '1/2', m1: 0.03 };
    expect(fromGl2('st_mufta_1', cdm)).toEqual({ generatorId: 'st_mufta_1', params: cdm });
  });
});
