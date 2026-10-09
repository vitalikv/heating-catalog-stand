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
    ['1', '1 1/4', '1 1/2', '2'].map((nominal) => ({ label: nominal, params: { nominal } })),
  ),
  entry(
    'equipment.pump-nut',
    PUMP_NUTS.map(([pumpNominal, pipeNominal]) => ({ label: `${pumpNominal} × ${pipeNominal}`, params: { pumpNominal, pipeNominal } })),
  ),
  entry(
    'equipment.strainer',
    STRAINERS.map(([nominal, length]) => ({ label: `${nominal}, ${mm(length)} мм`, params: { nominal, length } })),
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
