import { entry } from './entry';
import type { CatalogEntry } from './entry';

/**
 * Показывающие приборы части 18 по номенклатуре VALTEC (фото-каталог, с. 248–249, 290–292):
 * диаметр корпуса и резьба — по каталогу, глубина корпуса и погружная часть — условно.
 * VT.TM40.D и VT.TM40.T (G1/8) не добавлены: номинала 1/8 нет в таблице резьб.
 */
const GAUGES = [
  ['VT.TM40.VC', 'manometer', 40, 'top', '1/4'],
  ['VT.TM50.D', 'manometer', 50, 'bottom', '1/4'],
  ['VT.TM50.T', 'manometer', 50, 'back', '1/4'],
  ['TM-310P', 'manometer', 63, 'bottom', '1/4'],
  ['TM-310T', 'manometer', 63, 'back', '1/4'],
  ['TM-510P', 'manometer', 100, 'bottom', '1/2'],
  ['ТМТБ-31Р', 'thermomanometer', 80, 'bottom', '1/2'],
  ['ТМТБ-31Т', 'thermomanometer', 80, 'back', '1/2'],
  ['ТМТБ-41Р', 'thermomanometer', 100, 'bottom', '1/2'],
  ['ТМТБ-41Т', 'thermomanometer', 100, 'back', '1/2'],
  ['БТ-31', 'thermometer', 63, 'back', '1/2'],
  ['БТ-51', 'thermometer', 100, 'back', '1/2'],
] as const;
const KIND_LABELS = { manometer: 'манометр', thermometer: 'термометр', thermomanometer: 'термоманометр' } as const;
const CONNECTION_LABELS = { bottom: 'снизу', back: 'по оси', top: 'сверху' } as const;

export const INSTRUMENT_CATALOG: CatalogEntry[] = [
  entry('equipment.gauge', GAUGES.map(([article, kind, diameter, connection, nominal]) => ({
    label: `${article}: ${KIND_LABELS[kind]} Ø${diameter}, ${CONNECTION_LABELS[connection]}, G${nominal}`,
    params: { kind, diameter, connection, nominal, probe: diameter >= 100 ? 0.1 : 0.05 },
  }))),
];
