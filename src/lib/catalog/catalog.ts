import type { CatalogEntry } from './entry';
import { EQUIPMENT_CATALOG } from './equipment';
import { MP_CATALOG } from './mp';
import { PP_CATALOG } from './pp';
import { RADIATOR_CATALOG } from './radiator';
import { STEEL_CATALOG } from './steel';
import { VALVE_CATALOG } from './valve';

/**
 * Позиции каталога по генераторам: наборы start.js gl2 в формате библиотеки.
 * Совпадение с исходными наборами через legacy/gl2 проверяет tests/catalog.test.ts.
 */
export const CATALOG: readonly CatalogEntry[] = [
  ...STEEL_CATALOG,
  ...PP_CATALOG,
  ...MP_CATALOG,
  ...RADIATOR_CATALOG,
  ...VALVE_CATALOG,
  ...EQUIPMENT_CATALOG,
];
