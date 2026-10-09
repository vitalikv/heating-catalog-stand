import type { CatalogEntry } from './entry';
import { EQUIPMENT_CATALOG } from './equipment';
import { MP_CATALOG } from './mp';
import { PP_CATALOG } from './pp';
import { RADIATOR_CATALOG } from './radiator';
import { STEEL_CATALOG } from './steel';
import { VALVE_CATALOG } from './valve';
import { EXTENSION_CATALOG } from './extensions';

/**
 * Позиции каталога: перенесённые наборы gl2 и новые обобщённые модели.
 * tests/catalog.test.ts сверяет перенесённую часть с gl2, extensions — отдельно.
 */
export const CATALOG: readonly CatalogEntry[] = [
  ...STEEL_CATALOG,
  ...PP_CATALOG,
  ...MP_CATALOG,
  ...RADIATOR_CATALOG,
  ...VALVE_CATALOG,
  ...EQUIPMENT_CATALOG,
  ...EXTENSION_CATALOG,
];
