import { Box3, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { Assembly, ConnectorMating, GeneratorRegistry } from '../src/lib/index';
import type { Connector, GeneratedModel, GeneratorId } from '../src/lib/index';
import { doubleWallOutlet } from '../src/stand/assemblies';

const registry = new GeneratorRegistry();
const port = (model: GeneratedModel, id: string): Connector => {
  const found = model.connectors.find((c) => c.id === id);
  if (!found) throw new Error(`нет порта ${id}`);
  return found;
};
const build = (id: GeneratorId, params: object = {}) => {
  const generator = registry.get(id);
  return generator.build({ ...(generator.defaults as object), ...params } as never);
};

describe('МП: водорозетки, пластина, накидная гайка (часть 05b)', () => {
  it.each([
    ['press', 'internal', 'mp-press'],
    ['press', 'external', 'mp-press'],
    ['compression', 'internal', 'mp-compression'],
  ] as const)('35: водорозетка %s × резьба %s — A до торца трубы, B от плоскости ушек до торца резьбы', (pipeEnd, threadGender, joint) => {
    const model = build('mp.wall-outlet', { pipeEnd, threadGender, pipeArm: pipeEnd === 'press' ? 0.047 : 0.035, height: 0.04 });
    const thread = port(model, 'thread');
    const pipe = port(model, 'pipe');
    expect(thread).toMatchObject({ nominal: '1/2', joint: 'thread', gender: threadGender, direction: { x: 0, y: 1, z: 0 } });
    expect(pipe).toMatchObject({ nominal: '16', joint, gender: 'internal', direction: { x: 1, y: 0, z: 0 } });
    expect(pipe.position.x).toBeCloseTo(pipeEnd === 'press' ? 0.047 : 0.035, 9);
    // Плоскость ушек — низ габарита; от неё до торца резьбы — B.
    expect(thread.position.y - model.bounds.min.y).toBeCloseTo(0.04, 6);
    const tube = build('mp.pipe', { nominal: '16', length: 0.1 });
    expect(ConnectorMating.check(pipe, port(tube, 'start')).compatible).toBe(true);
    model.dispose(); tube.dispose();
  });

  it('35: обжим для трубы 40 не выпускается — incompatible; короткие плечи — ошибки', () => {
    const generator = registry.get('mp.wall-outlet');
    expect(generator.validate({ ...generator.defaults, pipeNominal: '40', pipeEnd: 'compression' }).map((e) => e.code)).toEqual(['incompatible']);
    expect(generator.validate({ ...generator.defaults, pipeArm: 0.01, height: 0.01 }).map((e) => e.param)).toEqual(['pipeArm', 'height']);
  });

  it('117: пластина VTm.224 — 186 × 35 × 2 мм, лицо y = 0, разъёмов нет', () => {
    const model = build('mp.outlet-plate');
    expect(model.bounds.max.x - model.bounds.min.x).toBeCloseTo(0.186, 6);
    expect(model.bounds.max.z - model.bounds.min.z).toBeCloseTo(0.035, 6);
    expect(model.bounds.max.y).toBeCloseTo(0, 9);
    expect(model.bounds.min.y).toBeCloseTo(-0.002, 9);
    expect(model.connectors).toEqual([]);
    model.dispose();
  });

  it('82: соединитель VTm.222 — пресс слева, накидная гайка справа, длина A', () => {
    const model = build('mp.nut-adapter', { pipeNominal: '20', threadNominal: '3/4', length: 0.052 });
    expect(port(model, 'pipe')).toMatchObject({ nominal: '20', joint: 'mp-press', gender: 'internal', position: { x: -0.026, y: 0, z: 0 } });
    expect(port(model, 'nut')).toMatchObject({ nominal: '3/4', joint: 'thread', gender: 'internal', position: { x: 0.026, y: 0, z: 0 } });
    // Гайка 1 1/2 насоса не та — а ниппель 3/4 садится.
    const nipple = build('steel.nipple', { nominalLeft: '3/4', nominalRight: '3/4', length: 0.026 });
    expect(ConnectorMating.check(port(model, 'nut'), port(nipple, 'left')).compatible).toBe(true);
    model.dispose(); nipple.dispose();
  });

  it.each(['75', '112.5', '150'] as const)('36: двойная водорозетка %s мм — ушки на лице пластины, межцентровое, трубы стыкуются', (spacing) => {
    const assembly = new Assembly(registry, doubleWallOutlet(spacing));
    expect(assembly.errors).toEqual([]);
    expect(assembly.joints.every(({ check }) => check.compatible)).toBe(true);
    const world = (name: string, id: string) => {
      const part = assembly.parts.find((p) => p.name === name)!;
      return new Vector3().copy(port(part.model, id).position).applyMatrix4(part.matrix);
    };
    expect(world('водорозетка 2', 'thread').x - world('водорозетка 1', 'thread').x).toBeCloseTo(Number(spacing) / 1000, 9);
    for (const name of ['водорозетка 1', 'водорозетка 2']) {
      const part = assembly.parts.find((p) => p.name === name)!;
      const box = new Box3(new Vector3().copy(part.model.bounds.min), new Vector3().copy(part.model.bounds.max)).applyMatrix4(part.matrix);
      // Плоскость ушек — на лице пластины y = 0 (допуск 0,1 мм), резьба — от стены.
      expect(Math.abs(box.min.y), name).toBeLessThan(0.0001);
      expect(world(name, 'thread').y).toBeGreaterThan(0.02);
    }
    assembly.dispose();
  });
});
