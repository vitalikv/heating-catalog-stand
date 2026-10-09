import { Box3, Vector3 } from 'three';
import type { BoundsData, GeneratedModel } from '../src/lib/index';

/** Габарит модели как Box3. */
export function boundsBox(bounds: BoundsData): Box3 {
  return new Box3(new Vector3().copy(bounds.min), new Vector3().copy(bounds.max));
}

/** Число треугольников неиндексированной геометрии модели. */
export function triangleCount(model: GeneratedModel): number {
  return model.geometry.getAttribute('position').count / 3;
}
