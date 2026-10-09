import { Box3, Group, Mesh } from 'three';
import type { BufferGeometry } from 'three';
import type { Connector, GeneratedModel, MaterialKey } from '../contracts';
import type { MaterialLibrary } from '../materials/MaterialLibrary';

export interface MeshModelOptions {
  title: string;
  /** Слитая геометрия модели; переходит во владение модели. */
  geometry: BufferGeometry;
  /** Материалы по индексам групп геометрии (MaterialGroupMerger.merge()). */
  materials: readonly MaterialKey[];
  connectors: Connector[];
}

/** Модель из одного меша: корень с названием, габарит и dispose() геометрии. */
export class MeshModel {
  /** Материалы library общие, модель их не освобождает. */
  static create(options: MeshModelOptions, library: MaterialLibrary): GeneratedModel {
    const { title, geometry, materials, connectors } = options;
    geometry.computeBoundingBox();
    const bounds = new Box3().copy(geometry.boundingBox!);

    const root = new Group();
    root.name = title;
    root.add(new Mesh(geometry, materials.map((key) => library.get(key))));

    let disposed = false;
    return {
      root,
      title,
      connectors,
      bounds,
      warnings: [],
      dispose: () => {
        if (disposed) return;
        disposed = true;
        geometry.dispose();
      },
    };
  }
}
