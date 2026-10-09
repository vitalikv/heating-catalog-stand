import type { ThreadGender } from '../core/contracts';
import type { GeneratorId, GeneratorParamsMap } from '../generators/GeneratorRegistry';

/** Позиция каталога: подпись и параметры генератора. */
export interface CatalogItem<P = unknown> {
  label: string;
  params: P;
}

/** Позиции одного генератора; параметры проверяются по типу генератора. */
export type CatalogEntry = {
  [K in GeneratorId]: { generatorId: K; items: CatalogItem<GeneratorParamsMap[K]>[] };
}[GeneratorId];

export function entry<K extends GeneratorId>(generatorId: K, items: CatalogItem<GeneratorParamsMap[K]>[]): CatalogEntry {
  return { generatorId, items } as CatalogEntry;
}

/** Метры → миллиметры для подписей: 0.0475 → 47.5. */
export const mm = (meters: number) => Math.round(meters * 10000) / 10;

/** Позиции с резьбой идут сначала с наружной, потом с внутренней — как в start.js gl2. */
export const GENDERS: readonly ThreadGender[] = ['external', 'internal'];

/** Вид резьбы в подписи: в — внутренняя, н — наружная. */
export const genderLabel = (gender: ThreadGender) => (gender === 'internal' ? 'в' : 'н');
