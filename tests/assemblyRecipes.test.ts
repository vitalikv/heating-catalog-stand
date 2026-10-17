import { describe, expect, it } from 'vitest';
import { Assembly } from '../src/lib/assembly/Assembly';
import { ASSEMBLY_RECIPES } from '../src/lib/assembly/recipes/recipes';
import { GeneratorRegistry } from '../src/lib/generators/GeneratorRegistry';

const registry = new GeneratorRegistry();

describe('производственные рецепты сборок', () => {
  it('ID уникальны, вида assembly.*, версии — целые от 1', () => {
    const ids = ASSEMBLY_RECIPES.map((recipe) => recipe.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const recipe of ASSEMBLY_RECIPES) {
      expect(recipe.id).toMatch(/^assembly\.[a-z0-9-]+$/);
      expect(Number.isInteger(recipe.version) && recipe.version >= 1).toBe(true);
    }
  });

  // Каждое исполнение каждого рецепта; у рецепта без исполнений — одно, без ключа.
  const builds = ASSEMBLY_RECIPES.flatMap((recipe) => (recipe.variants ?? [undefined])
    .map((variant) => [`${recipe.id}${variant ? ` ${variant.label}` : ''}`, recipe, variant?.key] as const));

  it.each(builds)('%s собирается без ошибок и одной связанной группой', (_, recipe, key) => {
    const definition = recipe.build(key);
    const names = definition.parts.map((part) => part.name);
    expect(new Set(names).size).toBe(names.length);

    const assembly = new Assembly(registry, definition);
    expect(assembly.errors).toEqual([]);
    expect(assembly.parts).toHaveLength(definition.parts.length);
    expect(assembly.joints.filter(({ check }) => !check.compatible).map(({ label }) => label)).toEqual([]);
    expect(assembly.closures.filter(({ closed }) => !closed).map(({ label }) => label)).toEqual([]);
    assembly.dispose();
    // Узел в редакторе держится соединениями: деталь без стыка с остальными от него отвалится.
    const linked = new Set([definition.parts[0].name]);
    for (let grew = true; grew;) {
      grew = false;
      for (const part of definition.parts) {
        if (part.attach && linked.has(part.attach.to) && !linked.has(part.name)) {
          linked.add(part.name);
          grew = true;
        }
      }
    }
    expect(names.filter((name) => !linked.has(name))).toEqual([]);
  });

  it('исполнения: ключи уникальны, без ключа — первое, чужой ключ — ошибка', () => {
    for (const recipe of ASSEMBLY_RECIPES.filter((item) => item.variants)) {
      const keys = recipe.variants!.map((variant) => variant.key);
      expect(new Set(keys).size).toBe(keys.length);
      expect(recipe.build().label).toBe(recipe.build(keys[0]).label);
      expect(() => recipe.build('нет такого')).toThrow();
    }
  });

  it('build() каждый раз отдаёт новое описание: правка результата не меняет рецепт', () => {
    for (const recipe of ASSEMBLY_RECIPES) {
      const first = recipe.build();
      first.parts.length = 0;
      expect(recipe.build().parts.length).toBeGreaterThan(0);
    }
  });
});
