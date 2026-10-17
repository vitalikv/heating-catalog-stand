import type { AssemblyDefinition } from '../Assembly';

/** Исполнение рецепта: ключ для `build` и подпись для каталога («× 4»). */
export interface AssemblyRecipeVariant {
  readonly key: string;
  readonly label: string;
}

/**
 * Производственный рецепт сборки — готовый узел для каталога. id после появления сохранённых
 * проектов не меняется, version растёт, когда меняется состав или положение деталей.
 * Названия деталей в описании (part.name) — часть рецепта: по ним потребитель находит
 * свободные разъёмы узла.
 *
 * Исполнения (variants) — узел одного устройства разного размера, например число выходов
 * коллектора. Без них у рецепта одно исполнение и build зовут без ключа; с ними build без
 * ключа собирает первое, а неизвестный ключ — ошибка.
 */
export interface AssemblyRecipe {
  readonly id: string;
  readonly version: number;
  readonly title: string;
  readonly variants?: readonly AssemblyRecipeVariant[];
  build(variant?: string): AssemblyDefinition;
}
