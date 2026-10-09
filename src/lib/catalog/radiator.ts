import { entry, mm } from './entry';
import type { CatalogEntry } from './entry';

// Позиции — наборы gl2/createObj/start.js.

/** Высоты алюминиевых радиаторов; в start.js для каждой — 1…10 секций. */
const ALUMINIUM_HEIGHTS = [0.2, 0.35, 0.5, 0.6, 0.7, 0.8];
const ALUMINIUM_SECTIONS = [1, 5, 10];

/** Стальные радиаторы: каждая высота со всеми длинами, глубина 0.07, подключение 1/2. */
const STEEL_HEIGHTS = [0.3, 0.4, 0.5, 0.6, 0.9];
const STEEL_LENGTHS = [0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0, 1.2, 1.4, 1.6, 1.8, 2.0];

export const RADIATOR_CATALOG: CatalogEntry[] = [
  entry(
    'radiator.aluminium',
    ALUMINIUM_HEIGHTS.flatMap((y) =>
      ALUMINIUM_SECTIONS.map((sections) => ({
        label: `h${mm(y)}, ${sections} шт.`,
        params: { sections, dimensions: { x: 0.08, y, z: 0.08 }, nominal: '1' },
      })),
    ),
  ),
  entry('radiator.port-fitting', [
    { label: 'переходник 1 → 1/2', params: { kind: 'adapter', portNominal: '1', outletNominal: '1/2' } },
    { label: 'переходник 1 → 3/4', params: { kind: 'adapter', portNominal: '1', outletNominal: '3/4' } },
    { label: 'заглушка 1', params: { kind: 'plug', portNominal: '1' } },
    { label: 'воздухоотводчик 1', params: { kind: 'vent', portNominal: '1' } },
  ]),
  entry('radiator.vent', [{ label: 'воздухоотводчик 1/2', params: { nominal: '1/2', kind: 'vent' } }]),
  entry(
    'radiator.steel',
    STEEL_HEIGHTS.flatMap((y) =>
      STEEL_LENGTHS.map((x) => ({ label: `h${mm(y)}, ${mm(x)} мм`, params: { dimensions: { x, y, z: 0.07 }, nominal: '1/2' } })),
    ),
  ),
];
