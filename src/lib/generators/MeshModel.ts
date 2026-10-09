import { Box3, Group, Mesh } from 'three';
import type { BufferGeometry, Material } from 'three';
import type { Connector, GeneratedModel } from '../contracts';

export interface MeshModelOptions {
  title: string;
  /** Слитая геометрия модели; переходит во владение модели. */
  geometry: BufferGeometry;
  /** Материалы по индексам групп геометрии; общие, модель их не освобождает. */
  materials: Material[];
  connectors: Connector[];
}

/** Модель из одного меша: корень с названием, габарит и dispose() геометрии. */
export class MeshModel {
  static create(options: MeshModelOptions): GeneratedModel {
    const { title, geometry, materials, connectors } = options;
    geometry.computeBoundingBox();
    const bounds = new Box3().copy(geometry.boundingBox!);

    const root = new Group();
    root.name = title;
    root.add(new Mesh(geometry, materials));

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
