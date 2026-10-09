import { describe, expect, it } from 'vitest';
import { GeneratorRegistry, ParamSchema } from '../src/lib/index';

const registry = new GeneratorRegistry();

describe('GeneratorRegistry', () => {
  it('ID уникальны, версия — целое от 1', () => {
    const ids = registry.list().map((generator) => generator.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const generator of registry.list()) {
      expect(Number.isInteger(generator.version) && generator.version >= 1, generator.id).toBe(true);
    }
  });

  it.each(registry.list().map((generator) => [generator.id, generator] as const))('%s: каждый ключ схемы есть в defaults, defaults проходят проверку', (_, generator) => {
    // Опечатка в ключе ParamSpec типы не ловят: ключ — строка-путь.
    for (const spec of generator.paramSpecs) {
      if (!ParamSchema.isActive(spec, generator.defaults)) continue;
      expect(ParamSchema.get(generator.defaults, spec.key), spec.key).toBeDefined();
    }
    expect(generator.validate(generator.defaults)).toEqual([]);
    generator.build(generator.defaults).dispose();
  });

  it('get по ID библиотеки отдаёт генератор с типом параметров, по чужому ID — undefined', () => {
    const coupling = registry.get('steel.coupling');
    const model = coupling.build({ nominalLeft: '1/2', nominalRight: '1/2', length: 0.03 });
    expect(model.title).toBe('Муфта 1/2(в)');
    model.dispose();
    expect(registry.get('st_mufta_1' as string)).toBeUndefined();
  });
});
