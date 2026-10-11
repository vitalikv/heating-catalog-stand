import { entry } from './entry';
import type { CatalogEntry } from './entry';

/** Прямые фильтры VALTEC VT.385/387/388 (каталог 2017, с. 341): L, H для 1/2 — по чертежам, мм. */
const STRAIGHT = [
  ['VT.388', 'internal', 54, 46, 'cap'],
  ['VT.387', 'external-internal', 58, 46, 'cap'],
  ['VT.385', 'internal', 47, 49, 'port'],
] as const;
/** Для 3/4 размеров в каталоге нет: 1/2 × отношение диаметров резьбы 26,8 / 21,3 (условно). */
const SCALE_3_4 = 26.8 / 21.3;

/** Фильтры части 29 вне gl2: прямые сетчатые (120) и промывные (121). */
export const FILTER_CATALOG: CatalogEntry[] = [
  entry('equipment.strainer-straight', [
    ...STRAIGHT.map(([article, ends, length, height, bottom]) => ({
      label: `1/2 (${article})`, params: { nominal: '1/2', ends, length: length / 1000, height: height / 1000, bottom },
    })),
    ...STRAIGHT.map(([article, ends, length, height, bottom]) => ({
      label: `3/4 (${article}, условно)`,
      params: { nominal: '3/4', ends, length: Math.round(length * SCALE_3_4) / 1000, height: Math.round(height * SCALE_3_4) / 1000, bottom },
    })),
  ]),
  entry('equipment.flush-filter', ['1/2', '3/4', '1'].flatMap((nominal) => (['manometer', 'none'] as const).map((gauge) => ({
    label: `${nominal} (VT.389)${gauge === 'manometer' ? ', с манометром' : ', без манометра'}`, params: { nominal, gauge },
  })))),
];
