import { BufferGeometry, CylinderGeometry, Path, Shape, ShapeGeometry, Vector2 } from 'three';
import type { Vector3Data } from '../contracts';
import { BoxProjectionUv } from './BoxProjectionUv';
import type { GeometryPart } from './MaterialGroupMerger';

const DEFAULT_SEGMENTS = 32;

/** Индексы материалов частей втулки (ind = [нар., вн., торец1, торец2] в gl2). */
export interface SleeveMaterials {
  outer: number;
  inner: number;
  /** Торец на −X. */
  start: number;
  /** Торец на +X. */
  end: number;
}

export interface SleeveOptions {
  /** Длина вдоль оси X, м. */
  length: number;
  /** Наружный и внутренний диаметры на +X, м (diameter_nr/diameter_vn). */
  outerDiameter: number;
  innerDiameter: number;
  /** Диаметры на −X для конусной втулки (d_n2/d_v2); по умолчанию как на +X. */
  outerDiameterStart?: number;
  innerDiameterStart?: number;
  outerSegments?: number;
  innerSegments?: number;
  /**
   * Поворот вокруг начала координат, рад (rot в gl2): сначала X, потом Y, потом Z,
   * до сдвига в center. UV считаются до поворота, как в gl2.
   */
  rotation?: Vector3Data;
  /** Центр втулки, м. */
  center?: Vector3Data;
  /** По умолчанию все части — материал 0. */
  materials?: Partial<SleeveMaterials>;
}

/**
 * Втулка вдоль X: наружный и внутренний открытые цилиндры и два торцевых
 * кольца (перенос crFormSleeve_1). Возвращает куски для MaterialGroupMerger.
 */
export class SleeveGeometryBuilder {
  build(options: SleeveOptions): GeometryPart[] {
    const outerSegments = options.outerSegments ?? DEFAULT_SEGMENTS;
    const innerSegments = options.innerSegments ?? DEFAULT_SEGMENTS;
    const outerEnd = options.outerDiameter;
    const innerEnd = options.innerDiameter;
    const outerStart = options.outerDiameterStart ?? outerEnd;
    const innerStart = options.innerDiameterStart ?? innerEnd;
    const materials: SleeveMaterials = { outer: 0, inner: 0, start: 0, end: 0, ...options.materials };
    const half = options.length / 2;

    const parts: GeometryPart[] = [
      { geometry: this.tube(outerEnd, outerStart, options.length, outerSegments), materialIndex: materials.outer },
      { geometry: this.tube(innerEnd, innerStart, options.length, innerSegments), materialIndex: materials.inner },
      { geometry: this.ring(outerStart, innerStart, outerSegments, innerSegments, -half), materialIndex: materials.start },
      { geometry: this.ring(outerEnd, innerEnd, outerSegments, innerSegments, half), materialIndex: materials.end },
    ];

    const rotation = options.rotation ?? { x: 0, y: 0, z: 0 };
    const { x, y, z } = options.center ?? { x: 0, y: 0, z: 0 };
    for (const part of parts) {
      part.geometry.rotateX(rotation.x).rotateY(rotation.y).rotateZ(rotation.z);
      part.geometry.translate(x, y, z);
    }
    return parts;
  }

  /** Открытый цилиндр вдоль X (crCild_2): верх CylinderGeometry уходит в +X. */
  private tube(diameterEnd: number, diameterStart: number, length: number, segments: number): BufferGeometry {
    const geometry = new CylinderGeometry(diameterEnd / 2, diameterStart / 2, length, segments, 1, true);
    geometry.rotateZ(-Math.PI / 2);
    // UV считаются до сдвига в центр втулки, как в gl2: фаза резьбы от центра куска.
    return BoxProjectionUv.apply(geometry);
  }

  /** Торцевое кольцо в плоскости YZ (crCircle_2), сдвинутое на offset по X. */
  private ring(outer: number, inner: number, outerSegments: number, innerSegments: number, offset: number): BufferGeometry {
    const shape = new Shape(this.circle(outer / 2, outerSegments));
    if (inner > 0) shape.holes.push(new Path(this.circle(inner / 2, innerSegments)));

    const indexed = new ShapeGeometry(shape);
    indexed.rotateZ(Math.PI / 2);
    indexed.rotateY(Math.PI / 2);
    indexed.translate(offset, 0, 0);

    const geometry = indexed.toNonIndexed();
    indexed.dispose();
    return geometry;
  }

  /** Точки окружности от (0, r) по часовой стрелке (createCircle_2). */
  private circle(radius: number, count: number): Vector2[] {
    const step = (Math.PI * 2) / count;
    return Array.from({ length: count }, (_, i) => new Vector2(Math.sin(step * i) * radius, Math.cos(step * i) * radius));
  }
}
