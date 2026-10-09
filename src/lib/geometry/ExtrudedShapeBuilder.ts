import { ExtrudeGeometry, Shape, Vector2 } from 'three';
import type { BufferGeometry } from 'three';
import type { MaterialKey, Vector3Data } from '../contracts';
import type { GeometryPart } from './MaterialGroupMerger';

export interface ExtrudedShapeOptions {
  /** Контур в плоскости XY, м. */
  points: readonly { x: number; y: number }[];
  /** Толщина выдавливания вдоль +Z, м (w1 в gl2). */
  depth: number;
  /** Поворот вокруг начала координат, рад: сначала X, потом Y, потом Z. */
  rotation?: Vector3Data;
  /** Сдвиг после поворота, м. */
  position?: Vector3Data;
  material: MaterialKey;
}

/** Плоский контур, выдавленный на толщину (перенос arr_form_1). */
export class ExtrudedShapeBuilder {
  build(options: ExtrudedShapeOptions): GeometryPart {
    const shape = new Shape(options.points.map((point) => new Vector2(point.x, point.y)));
    const extruded = new ExtrudeGeometry(shape, { bevelEnabled: false, depth: options.depth });

    const rotation = options.rotation ?? { x: 0, y: 0, z: 0 };
    extruded.rotateX(rotation.x).rotateY(rotation.y).rotateZ(rotation.z);
    const { x, y, z } = options.position ?? { x: 0, y: 0, z: 0 };
    extruded.translate(x, y, z);

    let geometry: BufferGeometry = extruded;
    if (extruded.index !== null) {
      geometry = extruded.toNonIndexed();
      extruded.dispose();
    }
    return { geometry, material: options.material };
  }
}
