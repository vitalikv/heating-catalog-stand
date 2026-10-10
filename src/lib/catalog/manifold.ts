import { entry } from './entry';
import type { CatalogEntry } from './entry';

/** Число выходов коллекторных блоков VALTEC: 3–12 для 1", 4–12 для 1 1/4" (каталог 2017, с. 184). */
const OUTLETS: Readonly<Record<string, readonly number[]>> = {
  '1': [3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
  '1 1/4': [4, 5, 6, 7, 8, 9, 10, 11, 12],
};

/** Гребёнки блока VTc.596EMNX: магистраль — внутренняя резьба, выходы — евроконус 3/4. */
const block = { outletEnd: 'eurocone', outletNominal: '1/2', mainEnd: 'internal', endPorts: 'vent-drain' } as const;

const variants = [
  // 67: подающая гребёнка с расходомерами (на обратную их не ставят).
  { name: 'подающий с расходомерами', inserts: 'flowmeter', head: 'handle' },
  // 68: обратная гребёнка с термоклапанами — с ручками или под сервоприводы 69.
  { name: 'обратный с термоклапанами', inserts: 'thermostatic', head: 'handle' },
  { name: 'обратный под приводы', inserts: 'thermostatic', head: 'none' },
] as const;

/** Коллекторы тёплого пола (позиции 67–68, генератор 102) и сервопривод 69 — вне gl2. */
export const MANIFOLD_CATALOG: CatalogEntry[] = [
  entry('manifold.brass', [
    ...variants.flatMap(({ name, inserts, head }) => Object.entries(OUTLETS).flatMap(([nominal, counts]) => counts.map((outlets) => ({
      label: `${name} ${nominal}" × ${outlets} (VTc.596)`,
      params: { ...block, nominal, outlets, inserts, head },
    })))),
    { label: 'с кранами-буксами 1" × 4 (условно)', params: { ...block, nominal: '1', outlets: 4, inserts: 'shutoff', head: 'handle' } },
    { label: 'без вставок, резьба 1/2(н), 1" × 4 (условно)',
      params: { ...block, nominal: '1', outlets: 4, outletEnd: 'thread', inserts: 'none', head: 'handle', mainEnd: 'external', endPorts: 'none' } },
  ]),
  entry('valve.thermoelectric-actuator', [
    { label: 'M30×1,5, закрыт (VT.TE 3040)', params: { state: 'closed' } },
    { label: 'M30×1,5, открыт (VT.TE 3040)', params: { state: 'open' } },
  ]),
];
