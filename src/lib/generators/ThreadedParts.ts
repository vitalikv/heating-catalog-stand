import { Matrix4, Quaternion, Vector3 } from 'three';
import type { MaterialKey, ThreadGender, Vector3Data } from '../core/contracts';
import type { GeometryPart } from '../geometry/MaterialGroupMerger';
import { sleeves } from '../geometry/SleeveGeometryBuilder';
import { spheres } from '../geometry/SphereGeometryBuilder';
import { ThreadSizes } from '../sizes/ThreadSizes';

/** Обобщённые размеры новых моделей, не размерный ряд конкретного производителя. */
export function threadedSize(nominal: string, gender: ThreadGender) {
  const diameter = ThreadSizes.require(nominal, gender);
  return { ...diameter, depth: Math.min(0.016, Math.max(0.008, diameter.n * 0.4)) };
}

export type ThreadedSize = ReturnType<typeof threadedSize>;

/** Поворачивает заготовку с оси +X и переносит её начало; владение кусками не меняется. */
export function orientParts(parts: GeometryPart[], direction: Vector3Data, origin = { x: 0, y: 0, z: 0 }): GeometryPart[] {
  const rotation = new Quaternion().setFromUnitVectors(new Vector3(1, 0, 0), new Vector3().copy(direction).normalize());
  for (const { geometry } of parts) {
    geometry.applyQuaternion(rotation);
    geometry.translate(origin.x, origin.y, origin.z);
  }
  return parts;
}

/** Наружный диаметр корпуса плеча threadedArm до резьбы. */
export function armBodyDiameter(size: ThreadedSize, gender: ThreadGender): number {
  return gender === 'internal' ? size.n * 1.15 : size.n + 0.004;
}

/**
 * Скругление стыка двух плеч под 90°, как у угла: четверти сферы во внешнем углу.
 * Толстое плечо — с внутренней резьбой, тонкое — с наружной; у основания тонкого конус
 * до диаметра толстого, длиной в перепад диаметров, но не больше coneLimit — стык без ступеньки.
 * Канал скругления — по большему каналу толстого плеча: щель до узкого канала закрывает торец корпуса тонкого.
 */
export function angleCorner(thick: ThreadedSize, thin: ThreadedSize, thickDirection: Vector3Data, thinDirection: Vector3Data,
  coneLimit: number, origin = { x: 0, y: 0, z: 0 }): GeometryPart[] {
  const thickOuter = armBodyDiameter(thick, 'internal');
  const thinOuter = armBodyDiameter(thin, 'external');
  const cone = Math.min(thickOuter - thinOuter, coneLimit);
  // Заготовка: тонкое плечо по +X, толстое по +Y, внешний угол в x < 0, y < 0.
  const quarter = { phiLength: Math.PI / 2, rotation: { x: Math.PI / 2, y: 0, z: 0 } };
  const parts = [
    spheres.build({ material: 'metal', ...quarter, radius: thickOuter / 2 }),
    spheres.build({ material: 'metal', ...quarter, radius: thick.v / 2 }),
    ...sleeves.build({ material: 'metal', length: cone, outerDiameterStart: thickOuter, outerDiameter: thinOuter,
      innerDiameter: thin.v, center: { x: cone / 2, y: 0, z: 0 } }),
  ];
  const x = new Vector3().copy(thinDirection).normalize();
  const y = new Vector3().copy(thickDirection).normalize();
  const basis = new Matrix4().makeBasis(x, y, new Vector3().crossVectors(x, y));
  for (const { geometry } of parts) geometry.applyMatrix4(basis).translate(origin.x, origin.y, origin.z);
  return parts;
}

/** Плечо от начала координат до торца reach с резьбой на конце. */
export function threadedArm(size: ThreadedSize, gender: ThreadGender, reach: number, material: MaterialKey = 'metal'): GeometryPart[] {
  const bodyEnd = reach - size.depth;
  const outer = armBodyDiameter(size, gender);
  return [
    ...sleeves.build({ material, length: bodyEnd, outerDiameter: outer, innerDiameter: size.v,
      center: { x: bodyEnd / 2, y: 0, z: 0 } }),
    ...sleeves.build({ material, length: size.depth, outerDiameter: gender === 'internal' ? outer : size.n,
      innerDiameter: size.v, center: { x: reach - size.depth / 2, y: 0, z: 0 },
      materials: gender === 'internal' ? { inner: 'thread' } : { outer: 'thread' } }),
  ];
}

/** Кольцевая гайка вокруг корпуса или хвостовика; центр на оси +X. */
export function unionNut(size: ThreadedSize, x: number): GeometryPart[] {
  return sleeves.build({ material: 'metal', length: size.depth, outerDiameter: size.n * 1.6,
    innerDiameter: size.n + 0.0005, outerSegments: 6, center: { x, y: 0, z: 0 }, materials: { outer: 'metalFlat' } });
}

/** Головка по +Y; height — положение её основания. */
export function valveHead(height: number, thermostatic: boolean): GeometryPart[] {
  const stem = sleeves.build({ material: 'metal', length: 0.012, outerDiameter: 0.012, innerDiameter: 0,
    center: { x: height + 0.006, y: 0, z: 0 } });
  const start = height + 0.012;
  const cap = thermostatic ? [
    ...sleeves.build({ material: 'metalFlat', length: 0.005, outerDiameter: 0.022, innerDiameter: 0,
      outerSegments: 16, center: { x: start + 0.0025, y: 0, z: 0 } }),
    ...sleeves.build({ material: 'plastic', length: 0.008, outerDiameter: 0.035, innerDiameter: 0,
      center: { x: start + 0.009, y: 0, z: 0 } }),
    ...sleeves.build({ material: 'black', length: 0.001, outerDiameter: 0.034, innerDiameter: 0,
      center: { x: start + 0.0135, y: 0, z: 0 } }),
    ...sleeves.build({ material: 'plasticFlat', length: 0.027, outerDiameter: 0.03, outerDiameterStart: 0.033,
      innerDiameter: 0, outerSegments: 24, center: { x: start + 0.0275, y: 0, z: 0 } }),
    ...sleeves.build({ material: 'plastic', length: 0.004, outerDiameter: 0.027, outerDiameterStart: 0.03,
      innerDiameter: 0, center: { x: start + 0.043, y: 0, z: 0 } }),
  ] : sleeves.build({ material: 'metalFlat', length: 0.016, outerDiameter: 0.021,
    innerDiameter: 0, outerSegments: 6, center: { x: start + 0.008, y: 0, z: 0 } });
  return orientParts([...stem, ...cap], { x: 0, y: 1, z: 0 });
}
