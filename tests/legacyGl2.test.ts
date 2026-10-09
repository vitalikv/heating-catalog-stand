import { describe, expect, it } from 'vitest';
import { GeneratorRegistry } from '../src/lib/index';
import { fromGl2, GL2_IDS, gl2TargetId } from '../src/lib/legacy/gl2';
import { GL2_PRESETS } from './fixtures/gl2Presets';
import reference from './fixtures/gl2-reference.json';

/** Семейство и деталь латиницей в kebab-case: 'steel.coupling', 'pp.elbow-90'. */
const ID_FORMAT = /^(steel|pp|mp|radiator|valve|equipment)\.[a-z0-9]+(-[a-z0-9]+)*$/;

const targets = Object.entries(GL2_IDS).flatMap(([id, target]) =>
  typeof target === 'string' ? [{ id, target }] : Object.values(target).map((variant) => ({ id, target: variant })),
);

describe('legacy/gl2', () => {
  it('таблица покрывает наборы стенда и эталон, новые ID — ровно реестр', () => {
    const gl2Ids = [...GL2_PRESETS.map((entry) => entry.generatorId), ...(reference as { id: string }[]).map((row) => row.id)];
    expect([...new Set(gl2Ids)].filter((id) => !(id in GL2_IDS))).toEqual([]);
    const registryIds = new GeneratorRegistry().list().map((generator) => generator.id);
    expect([...new Set(targets.map(({ target }) => target))].sort()).toEqual([...registryIds].sort());
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

  it('параметры cdm переводятся по таблице', () => {
    expect(fromGl2('st_mufta_1', { r1: '1/2', r2: '3/4', m1: 0.03 })).toEqual({
      generatorId: 'steel.coupling',
      params: { nominalLeft: '1/2', nominalRight: '3/4', length: 0.03 },
    });
    expect(fromGl2('st_ugol_90_1', { side: 'n', r1: '1', m1: 0.04 }).params).toEqual({ threadGender: 'external', nominal: '1', armLength: 0.04 });
    expect(fromGl2('createTubeWF_1', { type: 'mp', mpSize: '16', length: 1 })).toEqual({ generatorId: 'mp.pipe', params: { nominal: '16', length: 1 } });
    expect(fromGl2('cr_rash_bak_1', { d: 0.245, h1: 0.25, r1: '3/4', name: '6л' }).params).toEqual({ diameter: 0.245, height: 0.25, nominal: '3/4', volume: 6 });
    expect(fromGl2('al_zagl_radiator_1', { type: 'zgl', r1: '1', r2: 0 }).params).toEqual({ kind: 'plug', portNominal: '1' });
    expect(fromGl2('rad_vozduhotvod_1', { r1: '1/2', type: 'other' }).params).toEqual({ nominal: '1/2', kind: 'plug' });
    expect(fromGl2('reg_kran_primoy_1', { r1: '1/2', r2: '3/4', m1: 0.055, m2: 0.02, head: 'termo' }).params.head).toBe('thermostatic');
    expect(fromGl2('shar_kran_v_n_1', { r1: '1/2', m1: 0.05, t1: 0.05 }).params).toEqual({ ends: 'internal-external', nominal: '1/2', length: 0.05, handleLength: 0.05 });
  });

  it('неизвестный ключ cdm — ошибка', () => {
    expect(() => fromGl2('st_mufta_1', { r1: '1/2', r2: '1/2', m1: 0.03, m3: 1 })).toThrow();
  });

  it('каждый набор стенда после перевода проходит схему своего генератора', () => {
    const registry = new GeneratorRegistry();
    for (const entry of GL2_PRESETS) {
      for (const preset of entry.presets) {
        const { generatorId, params } = fromGl2(entry.generatorId, preset.params);
        expect(registry.get(generatorId)!.validate(params), `${entry.generatorId} ${preset.label}`).toEqual([]);
      }
    }
  });
});
