import { describe, expect, it } from 'vitest';
import * as lib from '../src/lib/index';

describe('публичный API', () => {
  it('index.ts экспортирует только реестр, материалы, сборку, схему, таблицы и каталог', () => {
    // Классы генераторов, MeshModel, ConnectorFrame, общие части семейств — внутренние (п. 6 плана).
    expect(Object.keys(lib).sort()).toEqual(
      [
        'Assembly',
        'CATALOG',
        'ConnectorMating',
        'createModelObject',
        'GeneratorParamsError',
        'GeneratorRegistry',
        'MaterialLibrary',
        'MpPipeSizes',
        'ParamSchema',
        'PpPipeSizes',
        'ThreadSizes',
      ].sort(),
    );
  });
});
