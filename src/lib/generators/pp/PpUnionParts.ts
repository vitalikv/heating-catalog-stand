import type { ThreadGender } from '../../core/contracts';
import type { GeometryPart } from '../../geometry/MaterialGroupMerger';
import { sleeves } from '../../geometry/SleeveGeometryBuilder';
import type { PartDiameters } from '../../sizes/ThreadSizes';
import { threadedSize } from '../ThreadedParts';
import type { ThreadedSize } from '../ThreadedParts';

/**
 * Глубина раструба ПП-фитингов VALTEC, мм — B заглушки VTp.790 и разъёмных соединителей VTp.761–763
 * (технический каталог 2017, с. 132, 134). Для номиналов вне таблицы — 0,3 d + 9 мм, условно.
 */
const SOCKET_DEPTH_MM: Readonly<Record<string, number>> = { 20: 15, 25: 16.5, 32: 18.5, 40: 21, 50: 24, 63: 26, 75: 30 };

/** Глубина раструба, м. */
export function ppSocketDepth(nominal: string): number {
  return (SOCKET_DEPTH_MM[nominal] ?? Number(nominal) * 0.3 + 9) / 1000;
}

const span = (from: number, to: number) => ({ length: to - from, center: { x: (from + to) / 2, y: 0, z: 0 } });

/** Раструб под пайку на оси X от from до to: пластик, внутренний диаметр — наружный диаметр трубы. */
export function ppSocket(d: PartDiameters, from: number, to: number): GeometryPart[] {
  return sleeves.build({ material: 'plastic', outerDiameter: d.n, innerDiameter: d.v, ...span(Math.min(from, to), Math.max(from, to)) });
}

/** Пластиковый корпус за раструбом: проход 0,7 диаметра трубы. */
export function ppBody(d: PartDiameters, from: number, to: number): GeometryPart[] {
  return sleeves.build({ material: 'plastic', outerDiameter: d.n, innerDiameter: d.v * 0.7, ...span(Math.min(from, to), Math.max(from, to)) });
}

/** Накидная гайка разъёма: латунь с мелким рифлением по окружности. */
export function ppUnionNut(diameter: number, bore: number, from: number, to: number): GeometryPart[] {
  return sleeves.build({ material: 'metal', outerDiameter: diameter, innerDiameter: bore, outerSegments: 24,
    ...span(Math.min(from, to), Math.max(from, to)), materials: { outer: 'metalFlat' } });
}

/** Латунный резьбовой конец на оси X, торец в end, корпус в сторону start. */
export interface BrassEnd {
  size: ThreadedSize;
  gender: ThreadGender;
  /** Длина по оси, м. */
  length: number;
}

/** Длина резьбового конца: наружная — резьба и 2 мм корпуса; внутренняя — только резьба в шестиграннике. */
export function brassEnd(nominal: string, gender: ThreadGender): BrassEnd {
  const size = threadedSize(nominal, gender);
  return { size, gender, length: size.depth + (gender === 'internal' ? 0 : 0.002) };
}

/**
 * Латунный конец от start до end (end > start): наружная резьба — корпус-шестигранник и резьба;
 * внутренняя — шестигранник с резьбой внутри. Шестигранник — описанный диаметр 1,3 n.
 */
export function brassEndParts(e: BrassEnd, start: number, end: number): GeometryPart[] {
  const hex = { outerDiameter: e.size.n * 1.3, outerSegments: 6 };
  const thread = end - e.size.depth;
  // Корпус-шестигранник перед резьбой — только если на него осталась длина.
  const body = thread - start > 1e-6
    ? sleeves.build({ material: 'metal', ...hex, innerDiameter: e.gender === 'internal' ? e.size.v * 0.8 : e.size.v, ...span(start, thread), materials: { outer: 'metalFlat' } })
    : [];
  if (e.gender === 'internal') {
    return [...body, ...sleeves.build({ material: 'metal', ...hex, innerDiameter: e.size.n, ...span(thread, end), materials: { outer: 'metalFlat', inner: 'thread' } })];
  }
  return [...body, ...sleeves.build({ material: 'metal', outerDiameter: e.size.n, innerDiameter: e.size.v, ...span(thread, end), materials: { outer: 'thread' } })];
}
