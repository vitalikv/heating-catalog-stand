import { describe, expect, it } from 'vitest';
import { RadiatorPlugGenerator } from '../src/lib/index';
import type { RadiatorPlugParams } from '../src/lib/index';
import { boundsBox } from './modelHelpers';

const generator = new RadiatorPlugGenerator();

/**
 * Габариты по формулам al_zagl_radiator_1 для r1 = '1' (d = 33.5 мм): буртик Ø d + 3 мм,
 * от −(3/2 + 8) мм до 3/2 + 5 мм (у воздухоотводчика ещё диск 1 мм и «бабочка» 7 мм).
 * Все четыре набора сверены с моделью из gl2 (9 октября 2026).
 */
const CASES: [RadiatorPlugParams, number, string][] = [
  [{ type: 'prh', r1: '1', r2: '1/2' }, 0.0065, 'перех.радиаторный 1/2'],
  [{ type: 'prh', r1: '1', r2: '3/4' }, 0.0065, 'перех.радиаторный 3/4'],
  [{ type: 'zgl', r1: '1', r2: 0 }, 0.0065, 'заглушка радиаторная'],
  [{ type: 'vsd', r1: '1', r2: 0 }, 0.0145, 'воздухоотв.радиаторный'],
];

describe.each(CASES)('радиаторный %o', (params, maxX, title) => {
  it('строится без NaN, габариты и название', () => {
    expect(generator.validate(params)).toEqual([]);
    const model = generator.build(params);
    const geometry = model.geometry;
    for (const name of ['position', 'normal', 'uv']) {
      expect(Array.from(geometry.getAttribute(name).array).every(Number.isFinite)).toBe(true);
    }
    expect(boundsBox(model.bounds).min.toArray().map((v) => Math.round(v * 1e6) / 1e6)).toEqual([-0.0095, -0.01825, -0.01825]);
    expect(boundsBox(model.bounds).max.toArray().map((v) => Math.round(v * 1e6) / 1e6)).toEqual([maxX, 0.01825, 0.01825]);
    expect(model.title).toBe(title);
    model.dispose();
  });

  it('сторона в радиатор — radiator-thread, наружная', () => {
    const model = generator.build(params);
    expect(model.connectors[0].position.x).toBeCloseTo(-0.0095, 9);
    expect(model.connectors[0]).toMatchObject({
      id: 'radiator',
      direction: { x: -1, y: 0, z: 0 },
      depth: 0.008,
      nominal: '1',
      joint: 'radiator-thread',
      gender: 'external',
    });
    model.dispose();
  });
});

describe('радиаторный переходник', () => {
  it('у переходника выход — трубная внутренняя резьба, у заглушки выхода нет', () => {
    const adapter = generator.build({ type: 'prh', r1: '1', r2: '1/2' });
    expect(adapter.connectors[1].position.x).toBeCloseTo(0.0065, 9);
    expect(adapter.connectors[1]).toMatchObject({
      id: 'outlet',
      direction: { x: 1, y: 0, z: 0 },
      depth: 0.005,
      nominal: '1/2',
      joint: 'thread',
      gender: 'internal',
    });
    // В gl2 у переходника 920 треугольников.
    expect(adapter.geometry.getAttribute('position').count / 3).toBe(920);
    expect(generator.build({ type: 'zgl', r1: '1' }).connectors).toHaveLength(1);
  });

  it('r2 проверяется только у переходника', () => {
    const codes = (params: RadiatorPlugParams) => generator.validate(params).map(({ code, param }) => `${code}:${param}`);
    expect(codes({ type: 'prh', r1: '1', r2: 0 })).toEqual(['unknown_option:r2']);
    expect(codes({ type: 'zgl', r1: '1', r2: 0 })).toEqual([]);
    expect(codes({ type: 'xxx' as never, r1: '1' })).toEqual(['unknown_option:type']);
  });
});
