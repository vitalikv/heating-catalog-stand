import { entry, mm } from './entry';
import type { CatalogEntry } from './entry';

// Позиции — наборы gl2/createObj/start.js; блоки насоса и гайки там выключены (1==2),
// наборы в них каталожные.

/** Гайки насоса: [pumpNominal, pipeNominal]. */
const PUMP_NUTS: [string, string][] = [
  ['1', '3/4'],
  ['1 1/4', '3/4'],
  ['1 1/4', '1'],
  ['1 1/2', '1'],
  ['1 1/2', '1 1/4'],
  ['2', '1'],
  ['2', '1 1/4'],
  ['2', '1 1/2'],
];

/** Косые фильтры: [nominal, length]. */
const STRAINERS: [string, number][] = [
  ['1/2', 0.053],
  ['3/4', 0.065],
  ['1', 0.077],
  ['1 1/4', 0.091],
  ['1 1/2', 0.106],
  ['2', 0.126],
];

/** Расширительные баки: [diameter, height, volume — литры]. */
const EXPANSION_TANKS: [number, number, number][] = [
  [0.245, 0.25, 6],
  [0.245, 0.28, 8],
  [0.245, 0.33, 10],
  [0.285, 0.325, 12],
  [0.285, 0.395, 18],
  [0.325, 0.42, 24],
];

export const EQUIPMENT_CATALOG: CatalogEntry[] = [
  entry(
    'equipment.pump',
    [
      ...['1', '1 1/4', '1 1/2', '2'].map((nominal) => ({ label: nominal, params: { nominal } })),
      // Версия 2: VALTEC VRS (технический каталог 2017, с. 674–678) — DN25 с G1 1/2, DN32 с G2,
      // монтажная длина 130 или 180 мм; мотор x/8 — крупнее.
      ...([['25/4', '1 1/2', 130], ['25/6', '1 1/2', 130], ['25/4', '1 1/2', 180], ['25/6', '1 1/2', 180], ['25/8', '1 1/2', 180],
        ['32/4', '2', 180], ['32/6', '2', 180], ['32/8', '2', 180]] as const).map(([model, nominal, length]) => ({
        label: `VRS ${model}-${length}`,
        params: { nominal, installLength: length / 1000, housing: 'vrs', motor: model.endsWith('/8') ? 'large' : 'small', terminalBox: 'left' } as const,
      })),
    ],
  ),
  entry(
    'equipment.pump-nut',
    PUMP_NUTS.map(([pumpNominal, pipeNominal]) => ({ label: `${pumpNominal} × ${pipeNominal}`, params: { pumpNominal, pipeNominal } })),
  ),
  entry(
    'equipment.strainer',
    [
      ...STRAINERS.map(([nominal, length]) => ({ label: `${nominal}, ${mm(length)} мм`, params: { nominal, length } })),
      // Версия 2: концы VALTEC VT.190 (Н–Н) и VT.191 (Н–В), только 1/2 (каталог 2017, с. 339);
      // позиции gl2 совпадают с VT.192 (В–В).
      { label: '1/2, 59 мм (VT.190, н-н)', params: { nominal: '1/2', length: 0.059, ends: 'external' } },
      { label: '1/2, 56 мм (VT.191, н-в)', params: { nominal: '1/2', length: 0.056, ends: 'external-internal' } },
    ],
  ),
  entry(
    'equipment.expansion-tank',
    EXPANSION_TANKS.map(([diameter, height, volume]) => ({
      label: `${volume}л: Ø${mm(diameter)} × ${mm(height)} мм`,
      params: { diameter, height, nominal: '3/4', volume },
    })),
  ),
  entry(
    'equipment.boiler',
    (['back', 'bottom', 'top-bottom', 'left-right'] as const).map((connection) => ({
      label: connection,
      params: { dimensions: { x: 0.4, y: 0.73, z: 0.3 }, nominal: '3/4', connection },
    })),
  ),
  entry('equipment.safety-group', [{ label: '1', params: { dimensions: { x: 0.18, y: 0.05, z: 0.05 }, nominal: '1' } }]),
];
