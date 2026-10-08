/** Диаметры детали в метрах: n — наружный, v — внутренний. */
export interface PartDiameters {
  n: number;
  v: number;
}

/**
 * Сторона резьбы: 'external' — наружная (side: 'n' в gl2),
 * 'internal' — внутренняя, как у муфты (side: 'v').
 */
export type ThreadSide = 'internal' | 'external';

/** Наружный диаметр трубы d и толщина стенки t, мм. */
interface PipeSize {
  d: number;
  t: number;
}

// Источник: gl2/createObj/calculation_2.js, sizeRezba.
const PIPE_SIZES: Readonly<Record<string, PipeSize>> = {
  '1/4': { d: 13.5, t: 2.2 },
  '3/8': { d: 17.0, t: 2.2 },
  '1/2': { d: 21.3, t: 2.7 },
  '3/4': { d: 26.8, t: 2.8 },
  '1': { d: 33.5, t: 3.2 },
  '1 1/4': { d: 42.3, t: 3.2 },
  '1 1/2': { d: 48.0, t: 3.5 },
  '2': { d: 60.0, t: 3.5 },
  '2 1/2': { d: 75.5, t: 4 },
  '3': { d: 88.5, t: 4 },
  '3 1/2': { d: 101.3, t: 4 },
  '4': { d: 114.0, t: 4.5 },
  '5': { d: 140.0, t: 4.5 },
  '6': { d: 165.0, t: 4.5 },
};

/** Диаметры резьбовой детали по дюймовому номиналу (перенос sizeRezba). */
export class ThreadSizes {
  static readonly nominals: readonly string[] = Object.keys(PIPE_SIZES);

  static has(nominal: string): boolean {
    return Object.hasOwn(PIPE_SIZES, nominal);
  }

  /** null для неизвестного номинала; в gl2 в этом случае получались нули. */
  static diameters(nominal: string, side: ThreadSide): PartDiameters | null {
    if (!ThreadSizes.has(nominal)) return null;
    const { d, t } = PIPE_SIZES[nominal];

    const n = side === 'external' ? d - t : d;
    const v = side === 'external' ? d - 2 * t : d - t;

    // Округление до 0,1 мм и перевод в метры — как в источнике.
    return { n: Math.round(n * 10) / 10000, v: Math.round(v * 10) / 10000 };
  }
}
