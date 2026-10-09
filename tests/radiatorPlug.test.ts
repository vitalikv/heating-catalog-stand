import { describe, expect, it } from 'vitest';
import type { RadiatorPortFittingParams } from '../src/lib/index';
import { RadiatorPortFittingGenerator } from '../src/lib/generators/radiator/RadiatorPortFittingGenerator';
import { boundsBox } from './modelHelpers';

const generator = new RadiatorPortFittingGenerator();

/**
 * Габариты по формулам al_zagl_radiator_1 для r1 = '1' (d = 33.5 мм): буртик Ø d + 3 мм,
 * от −(3/2 + 8) мм до 3/2 + 5 мм (у воздухоотводчика ещё диск 1 мм и «бабочка» 7 мм).
 * Все четыре набора сверены с моделью из gl2 (9 октября 2026).
 */
const CASES: [RadiatorPortFittingParams, number, string][] = [
  [{ kind: 'adapter', portNominal: '1', outletNominal: '1/2' }, 0.0065, 'перех.радиаторный 1/2'],
  [{ kind: 'adapter', portNominal: '1', outletNominal: '3/4' }, 0.0065, 'перех.радиаторный 3/4'],
  [{ kind: 'plug', portNominal: '1' }, 0.0065, 'заглушка радиаторная'],
  [{ kind: 'vent', portNominal: '1' }, 0.0145, 'воздухоотв.радиаторный'],
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
    const adapter = generator.build({ kind: 'adapter', portNominal: '1', outletNominal: '1/2' });
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
    expect(generator.build({ kind: 'plug', portNominal: '1' }).connectors).toHaveLength(1);
  });

  it('выход проверяется только у переходника', () => {
    const codes = (params: RadiatorPortFittingParams) => generator.validate(params).map(({ code, param }) => `${code}:${param}`);
    expect(codes({ kind: 'adapter', portNominal: '1' })).toEqual(['unknown_option:outletNominal']);
    expect(codes({ kind: 'plug', portNominal: '1' })).toEqual([]);
    expect(codes({ kind: 'xxx' as never, portNominal: '1' })).toEqual(['unknown_option:kind']);
  });
});
