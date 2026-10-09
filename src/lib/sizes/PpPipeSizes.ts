import type { PartDiameters } from './ThreadSizes';

// Источник: gl2/createObj/calculation_2.js, sizeTubePP. Толщина стенки фитинга t, мм;
// номинал — наружный диаметр трубы d, мм.
const WALL_MM: Readonly<Record<string, number>> = {
  '20': 4.2,
  '25': 5.4,
  '32': 6.7,
  '40': 8.3,
  '50': 10.5,
  '63': 12.5,
  '75': 15.0,
  '90': 18.3,
  '110': 20.8,
};

/** Диаметры полипропиленового фитинга под пайку (перенос sizeTubePP). */
export class PpPipeSizes {
  static readonly nominals: readonly string[] = Object.keys(WALL_MM);

  static has(nominal: string): boolean {
    return Object.hasOwn(WALL_MM, nominal);
  }

  /** n = d + 1.4t, v = d (труба входит в раструб); null для неизвестного номинала. */
  static diameters(nominal: string): PartDiameters | null {
    if (!PpPipeSizes.has(nominal)) return null;
    const d = Number(nominal);
    const t = WALL_MM[nominal];

    // Округление до 0,1 мм и перевод в метры — как в источнике.
    return { n: Math.round((d + t * 1.4) * 10) / 10000, v: Math.round(d * 10) / 10000 };
  }

  /** Как diameters(), но для неизвестного номинала — исключение: после проверки схемы это ошибка в коде. */
  static require(nominal: string): PartDiameters {
    const diameters = PpPipeSizes.diameters(nominal);
    if (!diameters) throw new Error(`PpPipeSizes: неизвестный номинал '${nominal}'`);
    return diameters;
  }
}
