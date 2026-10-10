import { BufferGeometry } from 'three';
import { describe, expect, it } from 'vitest';
import { BaseGenerator } from '../src/lib/core/BaseGenerator';
import { GeneratorParamsError } from '../src/lib/index';
import type { GeneratedModel, ParamSpec, ValidationError } from '../src/lib/index';

interface VersionedParams {
  nominal: string;
  connection: string;
  offset: number;
}

/** Генератор версии 2: connection и offset появились во второй версии. */
class VersionedGenerator extends BaseGenerator<VersionedParams, { reach: number }> {
  readonly id = 'test.versioned';
  readonly version = 2;
  readonly title = 'Проверка версий';
  readonly paramSpecs: readonly ParamSpec[] = [
    { kind: 'choice', key: 'nominal', label: 'Резьба', options: ['1/2', '3/4'] },
    { kind: 'choice', key: 'connection', label: 'Подключение', options: ['side', 'bottom'], addedIn: 2 },
    { kind: 'length', key: 'offset', label: 'Отступ', min: 0.01, max: 0.1, step: 0.005, addedIn: 2, when: { key: 'connection', values: ['bottom'] } },
  ];
  readonly defaults: VersionedParams = { nominal: '1/2', connection: 'side', offset: 0.05 };
  readonly created: VersionedParams[] = [];

  protected override layout(params: VersionedParams): { reach: number } {
    return { reach: params.connection === 'bottom' ? params.offset : 0 };
  }

  protected override relations(params: VersionedParams, layout: { reach: number }): ValidationError[] {
    return params.nominal === '3/4' && layout.reach > 0.08 ? [{ code: 'too_long', param: 'offset', message: 'offset' }] : [];
  }

  protected create(params: VersionedParams): GeneratedModel {
    this.created.push(params);
    const geometry = new BufferGeometry();
    const zero = { x: 0, y: 0, z: 0 };
    return { title: this.title, geometry, materials: [], connectors: [], bounds: { min: zero, max: zero }, warnings: [], dispose: () => geometry.dispose() };
  }
}

describe('BaseGenerator: параметры, добавленные в новой версии', () => {
  // Параметры первой версии: в типе новых ключей ещё не было.
  const v1 = { nominal: '3/4' } as VersionedParams;

  it('параметры прежней версии проходят проверку и строятся с умолчаниями', () => {
    const generator = new VersionedGenerator();
    expect(generator.validate(v1)).toEqual([]);
    generator.build(v1).dispose();
    expect(generator.created).toEqual([{ nominal: '3/4', connection: 'side', offset: 0.05 }]);
    expect(v1).toEqual({ nominal: '3/4' });
  });

  it('явное неверное значение нового параметра — ошибка', () => {
    const generator = new VersionedGenerator();
    const params = { nominal: '1/2', connection: 'top' } as VersionedParams;
    expect(generator.validate(params).map(({ code, param }) => `${code}:${param}`)).toEqual(['unknown_option:connection']);
    expect(() => generator.build(params)).toThrow(GeneratorParamsError);
  });

  it('связи проверяются по дополненным параметрам', () => {
    const generator = new VersionedGenerator();
    expect(generator.validate({ nominal: '3/4', connection: 'bottom' } as VersionedParams)).toEqual([]);
    expect(generator.validate({ nominal: '3/4', connection: 'bottom', offset: 0.09 }).map(({ code }) => code)).toEqual(['too_long']);
  });

  it('отсутствующий параметр первой версии остаётся ошибкой', () => {
    const generator = new VersionedGenerator();
    expect(generator.validate({ connection: 'side' } as VersionedParams).map(({ param }) => param)).toEqual(['nominal']);
  });
});
