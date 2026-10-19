import { describe, expect, it } from 'vitest';
import { ASSEMBLY_RECIPES, GeneratorRegistry } from '../src/lib/index';
import released from './fixtures/released-ids.json';

const registry = new GeneratorRegistry();

/**
 * Выпущенные ID и версии (пакет из `released.package`, взяты из его manifest.json): на них
 * ссылаются сохранённые проекты редактора. ID после выпуска не меняется и не удаляется — снятый
 * с производства генератор остаётся для загрузки; версия только растёт. Перевода параметров
 * между версиями пока нет, поэтому рост версии делает старые проекты неоткрываемыми — это
 * осознанный шаг: поднять версию здесь вместе с правилом перевода (план редактора, этап 7).
 * Новый выпуск дописывает сюда новые ID.
 */
describe('выпущенные ID генераторов и рецептов', () => {
  it.each(Object.entries(released.generators))('генератор %s есть, версия не ниже выпущенной', (id, version) => {
    const generator = registry.get(id);
    expect(generator, id).toBeDefined();
    expect(generator!.version).toBeGreaterThanOrEqual(version);
  });

  it.each(Object.entries(released.assemblies))('рецепт %s есть, версия не ниже выпущенной', (id, version) => {
    const recipe = ASSEMBLY_RECIPES.find((item) => item.id === id);
    expect(recipe, id).toBeDefined();
    expect(recipe!.version).toBeGreaterThanOrEqual(version);
  });

  it('версии выпущенных генераторов не менялись: перевода параметров пока нет', () => {
    const changed = Object.entries(released.generators)
      .filter(([id, version]) => registry.get(id) && registry.get(id)!.version !== version)
      .map(([id, version]) => `${id}: ${version} → ${registry.get(id)!.version}`);
    expect(changed).toEqual([]);
  });
});
