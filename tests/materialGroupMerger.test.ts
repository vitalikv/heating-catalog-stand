import { BoxGeometry } from 'three';
import { describe, expect, it } from 'vitest';
import { MaterialGroupMerger } from '../src/lib/geometry/MaterialGroupMerger';
import type { MaterialKey } from '../src/lib/index';

const part = (material: MaterialKey) => {
  const indexed = new BoxGeometry();
  const geometry = indexed.toNonIndexed();
  indexed.dispose();
  return { geometry, material };
};

describe('MaterialGroupMerger', () => {
  it('группы в порядке первого появления ключа, куски одного ключа подряд', () => {
    const merger = new MaterialGroupMerger();
    merger.add(part('thread'), part('metal'), part('thread'), part('red'));
    const { geometry, materials } = merger.merge();
    const box = 36;

    expect(materials).toEqual(['thread', 'metal', 'red']);
    expect(geometry.groups).toEqual([
      { start: 0, count: 2 * box, materialIndex: 0 },
      { start: 2 * box, count: box, materialIndex: 1 },
      { start: 3 * box, count: box, materialIndex: 2 },
    ]);
    geometry.dispose();
  });

  it('пустой список — ошибка', () => {
    expect(() => new MaterialGroupMerger().merge()).toThrow();
  });
});
