import type { BufferGeometry } from 'three';
import type { Connector, GeneratedModel, MaterialKey } from '../contracts';

export interface MeshModelOptions {
  title: string;
  /** Слитая геометрия модели; переходит во владение модели. */
  geometry: BufferGeometry;
  /** Материалы по индексам групп геометрии (MaterialGroupMerger.merge()). */
  materials: readonly MaterialKey[];
  connectors: Connector[];
}

/** Модель из слитой геометрии: габарит по геометрии и dispose() геометрии. */
export class MeshModel {
  static create(options: MeshModelOptions): GeneratedModel {
    const { title, geometry, materials, connectors } = options;
    geometry.computeBoundingBox();
    const { min, max } = geometry.boundingBox!;

    let disposed = false;
    return {
      title,
      geometry,
      materials,
      connectors,
      bounds: { min: { x: min.x, y: min.y, z: min.z }, max: { x: max.x, y: max.y, z: max.z } },
      warnings: [],
      dispose: () => {
        if (disposed) return;
        disposed = true;
        geometry.dispose();
      },
    };
  }
}
