import { describe, expect, it } from 'vitest';
import { CATALOG, GeneratorRegistry, ParamSchema } from '../src/lib/index';
import { fromGl2 } from '../src/lib/legacy/gl2';
import { GL2_PRESETS } from './fixtures/gl2Presets';
import { EXTENSION_CATALOG } from '../src/lib/catalog/extensions';

describe('каталог', () => {
  it('подписи позиций генератора уникальны: панель выбирает позицию по подписи', () => {
    for (const entry of CATALOG) {
      const labels = entry.items.map((item) => item.label);
      expect(new Set(labels).size, entry.generatorId).toBe(labels.length);
    }
  });

  it('у каждого генератора одна запись', () => {
    const ids = CATALOG.map((entry) => entry.generatorId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('совпадает с наборами start.js gl2 после fromGl2: те же позиции, подписи и порядок', () => {
    const registry = new GeneratorRegistry();
    const converted = new Map<string, { label: string; params: unknown }[]>();
    for (const entry of GL2_PRESETS) {
      for (const { label, params } of entry.presets) {
        const { generatorId, params: libraryParams } = fromGl2(entry.generatorId, params);
        converted.set(generatorId, [...(converted.get(generatorId) ?? []), { label, params: libraryParams }]);
      }
    }
    const additions = new Set(EXTENSION_CATALOG.map((entry) => entry.generatorId));
    const catalog = new Map<string, unknown>();
    for (const entry of CATALOG.filter((entry) => !additions.has(entry.generatorId))) {
      // Позиции gl2 — первыми; после них — новые исполнения версии (ParamSpec.addedIn).
      const gl2Count = converted.get(entry.generatorId)?.length ?? 0;
      catalog.set(entry.generatorId, entry.items.slice(0, gl2Count));
      const added = registry.get(entry.generatorId)!.paramSpecs.filter((spec) => spec.addedIn !== undefined);
      for (const item of entry.items.slice(gl2Count)) {
        const versioned = added.some((spec) => ParamSchema.get(item.params, spec.key) !== undefined);
        expect(versioned, `${entry.generatorId} ${item.label}: позиция вне gl2 без параметров новой версии`).toBe(true);
      }
    }
    expect(Object.fromEntries(catalog)).toEqual(Object.fromEntries(converted));
    for (const id of additions) expect(converted.has(id), id).toBe(false);
  });
});
