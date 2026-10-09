import type { BufferGeometry } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { MaterialKey } from '../core/contracts';

/** Кусок геометрии с ключом материала. */
export interface GeometryPart {
  geometry: BufferGeometry;
  material: MaterialKey;
}

/** Слитая геометрия: группа i рисуется материалом materials[i]. */
export interface MergedGeometry {
  geometry: BufferGeometry;
  materials: MaterialKey[];
}

/**
 * Собирает куски в одну геометрию (замена Geometry.merge(..., ind) из gl2).
 * Куски одного материала идут подряд, поэтому на каждый материал одна группа
 * и один вызов отрисовки. Группы идут в порядке первого появления ключа.
 * Все куски должны быть неиндексированными и иметь одинаковый набор атрибутов.
 */
export class MaterialGroupMerger {
  private parts: GeometryPart[] = [];

  add(...parts: GeometryPart[]): void {
    this.parts.push(...parts);
  }

  /** Сливает накопленные куски, освобождает их и очищает список. */
  merge(): MergedGeometry {
    if (this.parts.length === 0) throw new Error('MaterialGroupMerger: нет кусков для слияния');

    const materials = [...new Set(this.parts.map((part) => part.material))];
    // Array.prototype.sort устойчива: порядок кусков внутри материала сохраняется.
    const sorted = [...this.parts].sort((a, b) => materials.indexOf(a.material) - materials.indexOf(b.material));
    this.parts = [];

    const geometry = mergeGeometries(sorted.map((part) => part.geometry));
    if (geometry === null) {
      for (const part of sorted) part.geometry.dispose();
      throw new Error('MaterialGroupMerger: несовместимые атрибуты кусков');
    }

    let start = 0;
    for (const part of sorted) {
      const count = part.geometry.getAttribute('position').count;
      const group = materials.indexOf(part.material);
      const last = geometry.groups.at(-1);
      if (last !== undefined && last.materialIndex === group) {
        last.count += count;
      } else {
        geometry.addGroup(start, count, group);
      }
      start += count;
      part.geometry.dispose();
    }

    return { geometry, materials };
  }
}
