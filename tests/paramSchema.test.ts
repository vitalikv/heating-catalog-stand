import { describe, expect, it } from 'vitest';
import { GeneratorRegistry, ParamSchema } from '../src/lib/index';
import type { ParamSpec } from '../src/lib/index';
import { STAND_PRESETS } from '../src/stand/presets';

describe('ParamSchema', () => {
  const specs: ParamSpec[] = [
    { kind: 'choice', key: 'r1', label: 'Резьба', options: ['1/2', '1'] },
    { kind: 'length', key: 'size.y', label: 'Высота', min: 0.1, max: 1, step: 0.005 },
    { kind: 'integer', key: 'count', label: 'Секций', min: 1, max: 10 },
  ];
  const codes = (params: unknown) => ParamSchema.validate(specs, params).map(({ code, param }) => `${code}:${param}`);

  it('get и set по пути', () => {
    const params: Record<string, unknown> = { size: { x: 1 } };
    ParamSchema.set(params, 'size.y', 2);
    ParamSchema.set(params, 'a.b.c', 3);
    expect(params).toEqual({ size: { x: 1, y: 2 }, a: { b: { c: 3 } } });
    expect(ParamSchema.get(params, 'size.y')).toBe(2);
    expect(ParamSchema.get(params, 'size.y.z')).toBeUndefined();
    expect(ParamSchema.get(null, 'x')).toBeUndefined();
  });

  it('проверка по видам параметров', () => {
    expect(codes({ r1: '1', size: { y: 0.5 }, count: 3 })).toEqual([]);
    // Границы включительно.
    expect(codes({ r1: '1', size: { y: 0.1 }, count: 10 })).toEqual([]);
    expect(codes({ r1: '3/4', size: { y: 1.5 }, count: 0 })).toEqual(['unknown_option:r1', 'out_of_range:size.y', 'out_of_range:count']);
    expect(codes({ r1: 1, size: { y: '0.5' }, count: 2.5 })).toEqual(['unknown_option:r1', 'not_a_number:size.y', 'not_integer:count']);
    expect(codes({})).toEqual(['unknown_option:r1', 'not_a_number:size.y', 'not_a_number:count']);
  });

  it('сообщения длин в миллиметрах', () => {
    const [error] = ParamSchema.validate([specs[1]], { size: { y: 1.5 } });
    expect(error.message).toBe('Высота: 1500 мм — вне диапазона 100…1000 мм');
  });
});

describe('схемы генераторов и наборы стенда', () => {
  const registry = new GeneratorRegistry();

  it('у каждого генератора есть наборы, и все они проходят его схему', () => {
    for (const generator of registry.list()) {
      const entry = STAND_PRESETS.find((presets) => presets.generatorId === generator.id);
      expect(entry, generator.id).toBeDefined();
      for (const preset of entry!.presets) {
        expect(generator.validate(preset.params), `${generator.id} ${preset.label}`).toEqual([]);
      }
    }
  });

  it('ключи схемы уникальны, границы длин согласованы с шагом', () => {
    for (const generator of registry.list()) {
      const keys = generator.paramSpecs.map((spec) => spec.key);
      expect(new Set(keys).size, generator.id).toBe(keys.length);
      for (const spec of generator.paramSpecs) {
        if (spec.kind === 'length' || spec.kind === 'integer') expect(spec.min, spec.key).toBeLessThan(spec.max);
        if (spec.kind === 'length') expect(spec.step, spec.key).toBeGreaterThan(0);
      }
    }
  });
});
