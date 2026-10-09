import { describe, expect, it } from 'vitest';
import { CATALOG } from '../src/lib/index';
import { fromGl2 } from '../src/lib/legacy/gl2';
import { GL2_PRESETS } from './fixtures/gl2Presets';

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
    const converted = new Map<string, { label: string; params: unknown }[]>();
    for (const entry of GL2_PRESETS) {
      for (const { label, params } of entry.presets) {
        const { generatorId, params: libraryParams } = fromGl2(entry.generatorId, params);
        converted.set(generatorId, [...(converted.get(generatorId) ?? []), { label, params: libraryParams }]);
      }
    }
    const catalog = new Map<string, unknown>(CATALOG.map((entry) => [entry.generatorId, entry.items]));
    expect(Object.fromEntries(catalog)).toEqual(Object.fromEntries(converted));
  });
});
