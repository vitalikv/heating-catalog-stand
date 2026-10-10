import type { GeometryPart } from '../../geometry/MaterialGroupMerger';
import { sleeves } from '../../geometry/SleeveGeometryBuilder';

/** Вставка выхода коллектора: кран-букса, термостатический клапан или настроечный клапан с расходомером. */
export type ManifoldInsertKind = 'shutoff' | 'thermostatic' | 'flowmeter';

/**
 * Высоты над осью коллектора 1", м — VALTEC VTc.594EMNX (каталог 2017, с. 179): I — верх
 * шестигранника вставки, L — верх крана-буксы, M — верх ручки термоклапана, N — верх расходомера.
 * Верх посадочного места M30×1,5 без ручки принят на высоте L — условно.
 */
export const INSERT_HEIGHTS = { base: 0.036, shutoff: 0.0465, seat: 0.0465, handle: 0.0615, flowmeter: 0.0795 };
/** Длина резьбы M30×1,5 посадочного места привода, м — условно. */
export const SEAT_DEPTH = 0.01;

const span = (from: number, to: number) => ({ length: to - from, center: { x: (from + to) / 2, y: 0, z: 0 } });

/**
 * Вставка по +X от поверхности корпуса (radius) до верха; rise — прибавка высот
 * для коллектора 1 1/4" (VTc.594: +5 мм к I, L, M, N). handle — ручка термоклапана;
 * без неё остаётся посадочное место под привод.
 */
export function manifoldInsert(kind: ManifoldInsertKind, radius: number, rise: number, handle: boolean): GeometryPart[] {
  const base = INSERT_HEIGHTS.base + rise;
  const parts = [
    ...sleeves.build({ material: 'metal', ...span(radius - 0.002, base - 0.008), outerDiameter: 0.018, innerDiameter: 0 }),
    ...sleeves.build({ material: 'metal', ...span(base - 0.008, base), outerDiameter: 0.024, innerDiameter: 0,
      outerSegments: 6, materials: { outer: 'metalFlat' } }),
  ];
  if (kind === 'shutoff') {
    const top = INSERT_HEIGHTS.shutoff + rise;
    parts.push(
      ...sleeves.build({ material: 'metal', ...span(base, base + 0.003), outerDiameter: 0.008, innerDiameter: 0 }),
      ...sleeves.build({ material: 'plastic', ...span(base + 0.003, top), outerDiameter: 0.02, innerDiameter: 0 }),
    );
  } else if (kind === 'thermostatic') {
    const seat = INSERT_HEIGHTS.seat + rise;
    parts.push(
      ...sleeves.build({ material: 'metal', ...span(base, seat - SEAT_DEPTH), outerDiameter: 0.026, innerDiameter: 0 }),
      ...sleeves.build({ material: 'metal', ...span(seat - SEAT_DEPTH, seat), outerDiameter: 0.03, innerDiameter: 0,
        materials: { outer: 'thread' } }),
    );
    if (handle) {
      // Ручка надета на посадочное место и закрывает его резьбу.
      const top = INSERT_HEIGHTS.handle + rise;
      parts.push(
        ...sleeves.build({ material: 'plastic', ...span(seat - SEAT_DEPTH, top - 0.002), outerDiameterStart: 0.034, outerDiameter: 0.031,
          innerDiameter: 0, outerSegments: 24, materials: { outer: 'plasticFlat' } }),
        ...sleeves.build({ material: 'plastic', ...span(top - 0.002, top), outerDiameterStart: 0.031, outerDiameter: 0.028, innerDiameter: 0 }),
      );
    }
  } else {
    // Настроечный клапан: красное основание с накаткой, колба шкалы, колпачок.
    const top = INSERT_HEIGHTS.flowmeter + rise;
    parts.push(
      ...sleeves.build({ material: 'red', ...span(base, base + 0.014), outerDiameter: 0.028, innerDiameter: 0,
        outerSegments: 16, materials: { outer: 'redFlat' } }),
      ...sleeves.build({ material: 'plasticGrey', ...span(base + 0.014, top - 0.004), outerDiameter: 0.014, innerDiameter: 0 }),
      ...sleeves.build({ material: 'red', ...span(top - 0.004, top), outerDiameter: 0.016, innerDiameter: 0 }),
    );
  }
  return parts;
}
