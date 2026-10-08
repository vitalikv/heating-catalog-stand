import type { BufferGeometry } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/** Кусок геометрии с индексом материала в массиве материалов меша. */
export interface GeometryPart {
  geometry: BufferGeometry;
  materialIndex: number;
}

/**
 * Собирает куски в одну геометрию (замена Geometry.merge(..., ind) из gl2).
 * Куски одного материала идут подряд, поэтому на каждый материал одна группа
 * и один вызов отрисовки. Все куски должны быть неиндексированными
 * и иметь одинаковый набор атрибутов.
 */
export class MaterialGroupMerger {
  private parts: GeometryPart[] = [];

  add(...parts: GeometryPart[]): void {
    this.parts.push(...parts);
  }

  /** Сливает накопленные куски, освобождает их и очищает список. */
  merge(): BufferGeometry {
    if (this.parts.length === 0) throw new Error('MaterialGroupMerger: нет кусков для слияния');

    // Array.prototype.sort устойчива: порядок кусков внутри материала сохраняется.
    const sorted = [...this.parts].sort((a, b) => a.materialIndex - b.materialIndex);
    this.parts = [];

    const merged = mergeGeometries(sorted.map((part) => part.geometry));
    if (merged === null) {
      for (const part of sorted) part.geometry.dispose();
      throw new Error('MaterialGroupMerger: несовместимые атрибуты кусков');
    }

    let start = 0;
    for (const part of sorted) {
      const count = part.geometry.getAttribute('position').count;
      const last = merged.groups.at(-1);
      if (last !== undefined && last.materialIndex === part.materialIndex) {
        last.count += count;
      } else {
        merged.addGroup(start, count, part.materialIndex);
      }
      start += count;
      part.geometry.dispose();
    }

    return merged;
  }
}
