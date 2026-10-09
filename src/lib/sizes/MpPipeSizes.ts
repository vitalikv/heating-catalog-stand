import type { PartDiameters } from './ThreadSizes';

// Источник: gl2/createObj/calculation_2.js, sizeTubeMP. Номинал — наружный диаметр
// металлопластиковой трубы d, мм; толщина t = 0.5 мм одна для всех.
const NOMINALS: readonly string[] = ['16', '20', '26', '32', '40'];
const WALL_MM = 0.5;

/** Диаметры металлопластикового фитинга под пресс (перенос sizeTubeMP). */
export class MpPipeSizes {
  static readonly nominals: readonly string[] = NOMINALS;

  static has(nominal: string): boolean {
    return NOMINALS.includes(nominal);
  }

  /** n = d + 1.4t, v = d; null для неизвестного номинала. */
  static diameters(nominal: string): PartDiameters | null {
    if (!MpPipeSizes.has(nominal)) return null;
    const d = Number(nominal);

    // Округление до 0,1 мм и перевод в метры — как в источнике.
    return { n: Math.round((d + WALL_MM * 1.4) * 10) / 10000, v: Math.round(d * 10) / 10000 };
  }

  /** Как diameters(), но для неизвестного номинала — исключение: после проверки схемы это ошибка в коде. */
  static require(nominal: string): PartDiameters {
    const diameters = MpPipeSizes.diameters(nominal);
    if (!diameters) throw new Error(`MpPipeSizes: неизвестный номинал '${nominal}'`);
    return diameters;
  }
}
