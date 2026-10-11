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
  // Комплектующие КИП (часть 23), технический каталог 2017, с. 656–659; гильзы VTr.551 — фото-каталог, с. 234.
  entry('equipment.thermowell', [
    { label: 'OR.551: G1/2, 60 мм, гнездо 10,5', params: { nominal: '1/2', length: 0.06, socket: 10.5 } },
    { label: 'VTr.551: G1/2, 64 мм, гнездо 12', params: { nominal: '1/2', length: 0.064, socket: 12 } },
    { label: 'VTr.551: G1/2, 90 мм, гнездо 12', params: { nominal: '1/2', length: 0.09, socket: 12 } },
  ]),
  entry('equipment.siphon-tube', ([['1/4', 0.157], ['3/8', 0.164], ['1/2', 0.167]] as const).map(([nominal, length]) => ({
    label: `OR.1809: G${nominal}, H ${Math.round(length * 1000)} мм`, params: { nominal, length, loopDiameter: 0.062 },
  }))),
  // Краны для манометра VT.806 (вход Н) и VT.807 (вход В): A по таблице, ручка — под B = 37 мм.
  entry('valve.gauge-tap', ([['external', '1/2', 0.075], ['external', '3/8', 0.073], ['external', '1/4', 0.073],
    ['internal', '1/2', 0.067], ['internal', '3/8', 0.065], ['internal', '1/4', 0.065]] as const).map(([inlet, gaugeNominal, length]) => ({
    label: `${inlet === 'external' ? 'VT.806' : 'VT.807'}: 1/2(${inlet === 'external' ? 'н' : 'в'}) × гайка ${gaugeNominal}`,
    params: { inlet, gaugeNominal, length, handleLength: 0.036 },
  }))),
];
