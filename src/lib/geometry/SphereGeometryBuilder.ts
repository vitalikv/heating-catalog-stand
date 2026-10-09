import { SphereGeometry } from 'three';
import type { MaterialKey, Vector3Data } from '../contracts';
import type { GeometryPart } from './MaterialGroupMerger';

const DEFAULT_SEGMENTS = 32;

export interface SphereOptions {
  radius: number;
  /** Угол долготы, рад (cutRad в gl2); 2π — полная сфера. */
  phiLength?: number;
  /** Поворот вокруг центра, рад: сначала X, потом Y, потом Z. */
  rotation?: Vector3Data;
  center?: Vector3Data;
  material: MaterialKey;
}

/**
 * Сфера или её сектор (перенос crSphere_2): SphereGeometry(radius, 32, 32, 0, phiLength).
 * UV — родные UV сферы, как в gl2.
 */
export class SphereGeometryBuilder {
  build(options: SphereOptions): GeometryPart {
    const indexed = new SphereGeometry(options.radius, DEFAULT_SEGMENTS, DEFAULT_SEGMENTS, 0, options.phiLength ?? Math.PI * 2);
    const rotation = options.rotation ?? { x: 0, y: 0, z: 0 };
    indexed.rotateX(rotation.x).rotateY(rotation.y).rotateZ(rotation.z);

    const { x, y, z } = options.center ?? { x: 0, y: 0, z: 0 };
    indexed.translate(x, y, z);

    const geometry = indexed.toNonIndexed();
    indexed.dispose();
    return { geometry, material: options.material };
  }
}
