import { Box3, Mesh, Vector3 } from 'three';
import type { BufferGeometry } from 'three';
import { describe, expect, it } from 'vitest';
import { GeneratorRegistry, MaterialLibrary } from '../src/lib/index';
import { STAND_PRESETS } from '../src/stand/presets';

// Общие проверки всех генераторов на всех наборах стенда; размеры — в тестах генераторов.
const registry = new GeneratorRegistry(new MaterialLibrary());
const cases = registry.list().flatMap((generator) =>
  (STAND_PRESETS.find((entry) => entry.generatorId === generator.id)?.presets ?? []).map((preset) => ({
    name: `${generator.id}: ${preset.label}`,
    generator,
    params: preset.params,
  })),
);

describe.each(cases)('$name', ({ generator, params }) => {
  it('буферы без NaN, группы покрывают геометрию, bounds — габарит корня', () => {
    const model = generator.build(params);
    model.root.updateMatrixWorld(true);
    model.root.traverse((object) => {
      if (!(object instanceof Mesh)) return;
      const geometry: BufferGeometry = object.geometry;
      const position = geometry.getAttribute('position');
      expect(geometry.index).toBeNull();
      for (const name of ['position', 'normal', 'uv']) {
        const attribute = geometry.getAttribute(name);
        expect(attribute.count, name).toBe(position.count);
        expect(Array.from(attribute.array).every(Number.isFinite), name).toBe(true);
      }
      expect(geometry.groups.reduce((sum, group) => sum + group.count, 0)).toBe(position.count);
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      for (const group of geometry.groups) expect(materials[group.materialIndex!]).toBeDefined();
    });

    const actual = new Box3().setFromObject(model.root);
    expect(actual.min.distanceTo(model.bounds.min)).toBeLessThan(1e-9);
    expect(actual.max.distanceTo(model.bounds.max)).toBeLessThan(1e-9);
    expect(model.root.name).toBe(model.title);
    model.dispose();
    expect(() => model.dispose()).not.toThrow();
  });

  it('разъёмы: уникальные ID, единичные direction и up, up ⟂ direction, торец на габарите', () => {
    const model = generator.build(params);
    const ids = model.connectors.map((connector) => connector.id);
    expect(new Set(ids).size).toBe(ids.length);
    // Торец лежит на грани габарита или внутри, но не дальше 1 мкм от неё по направлению выхода.
    const bounds = model.bounds.clone().expandByScalar(1e-6);

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
