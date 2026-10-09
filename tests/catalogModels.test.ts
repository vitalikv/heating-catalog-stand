import { Box3, Vector3 } from 'three';
import type { BufferAttribute } from 'three';
import { describe, expect, it } from 'vitest';
import { GeneratorRegistry } from '../src/lib/index';
import { STAND_PRESETS } from '../src/stand/presets';
import { boundsBox } from './modelHelpers';

// Общие проверки всех генераторов на всех наборах стенда; размеры — в тестах генераторов.
const registry = new GeneratorRegistry();
const cases = registry.list().flatMap((generator) =>
  (STAND_PRESETS.find((entry) => entry.generatorId === generator.id)?.presets ?? []).map((preset) => ({
    name: `${generator.id}: ${preset.label}`,
    generator,
    params: preset.params,
  })),
);

describe.each(cases)('$name', ({ generator, params }) => {
  it('буферы без NaN, группы покрывают геометрию, bounds — габарит геометрии', () => {
    const model = generator.build(params);
    const geometry = model.geometry;
    const position = geometry.getAttribute('position');
    expect(geometry.index).toBeNull();
    for (const name of ['position', 'normal', 'uv']) {
      const attribute = geometry.getAttribute(name);
      expect(attribute.count, name).toBe(position.count);
      expect(Array.from(attribute.array).every(Number.isFinite), name).toBe(true);
    }
    expect(geometry.groups.reduce((sum, group) => sum + group.count, 0)).toBe(position.count);
    // Каждой группе — свой ключ материала, без лишних ключей.
    expect(geometry.groups.map((group) => group.materialIndex)).toEqual(model.materials.map((_, i) => i));

    const actual = new Box3().setFromBufferAttribute(position as BufferAttribute);
    expect(actual.min.distanceTo(boundsBox(model.bounds).min)).toBeLessThan(1e-9);
    expect(actual.max.distanceTo(boundsBox(model.bounds).max)).toBeLessThan(1e-9);
    // Результат — простые данные: передаётся из воркера без классов.
    expect(structuredClone({ ...model, geometry: undefined, dispose: undefined })).toEqual({ ...model, geometry: undefined, dispose: undefined });
    model.dispose();
    expect(() => model.dispose()).not.toThrow();
  });

  it('разъёмы: уникальные ID, единичные direction и up, up ⟂ direction, торец на габарите', () => {
    const model = generator.build(params);
    const ids = model.connectors.map((connector) => connector.id);
    expect(new Set(ids).size).toBe(ids.length);
    // Торец лежит на грани габарита или внутри, но не дальше 1 мкм от неё по направлению выхода.
    const bounds = boundsBox(model.bounds).clone().expandByScalar(1e-6);

    for (const connector of model.connectors) {
      const direction = new Vector3().copy(connector.direction);
      const up = new Vector3().copy(connector.up);
      expect(direction.length(), connector.id).toBeCloseTo(1, 9);
      expect(up.length(), connector.id).toBeCloseTo(1, 9);
      expect(direction.dot(up), connector.id).toBeCloseTo(0, 9);
      expect(connector.depth, connector.id).toBeGreaterThan(0);
      expect(bounds.containsPoint(new Vector3().copy(connector.position)), connector.id).toBe(true);
    }
    model.dispose();
  });
});
