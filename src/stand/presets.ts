import { PpPipeSizes, ThreadSizes } from '../lib/index';

export type StandParams = Record<string, unknown>;

/**
 * Поле панели; key — путь в параметрах, например 'size.y'.
 * Длины хранятся в метрах, а в панели показываются в миллиметрах.
 */
export type ParamField =
  | { key: string; label: string; kind: 'choice'; options: readonly string[] }
  | { key: string; label: string; kind: 'length'; min: number; max: number; step: number }
  | { key: string; label: string; kind: 'integer'; min: number; max: number };

export interface Preset {
  label: string;
  params: StandParams;
}

export interface GeneratorPresets {
  generatorId: string;
  fields: ParamField[];
  presets: Preset[];
}

/** Наборы st_mufta из gl2/createObj/start.js: [r1, r2, m1]. */
const STEEL_COUPLINGS: [string, string, number][] = [
  ['1/2', '1/2', 0.03],
  ['3/4', '3/4', 0.033],
  ['1', '1', 0.035],
  ['1 1/4', '1 1/4', 0.047],
  ['1 1/2', '1 1/2', 0.052],
  ['2', '2', 0.06],
  ['1/2', '3/8', 0.028],
  ['3/4', '1/2', 0.032],
  ['1', '1/2', 0.034],
  ['1', '3/4', 0.039],
  ['1 1/4', '1/2', 0.041],
  ['1 1/4', '3/4', 0.041],
  ['1 1/4', '1', 0.042],
  ['1 1/2', '1 1/4', 0.043],
  ['2', '1', 0.048],
  ['2', '1 1/4', 0.048],
  ['2', '1 1/2', 0.048],
];

/** Наборы pl_ugol_90 из gl2/createObj/start.js: [r1, m1]. */
const PP_ELBOWS: [string, number][] = [
  ['20', 0.026],
  ['25', 0.03],
  ['32', 0.037],
  ['40', 0.044],
  ['50', 0.053],
  ['63', 0.06],
];

/** Высоты al_radiator_1 из gl2/createObj/start.js; там count = 1…10 для каждой. */
const AL_RADIATOR_HEIGHTS = [0.2, 0.35, 0.5, 0.6, 0.7, 0.8];
const AL_RADIATOR_COUNTS = [1, 5, 10];

const mm = (meters: number) => Math.round(meters * 10000) / 10;

export const STAND_PRESETS: GeneratorPresets[] = [
  {
    generatorId: 'st_mufta_1',
    fields: [
      { key: 'r1', label: 'Резьба слева', kind: 'choice', options: ThreadSizes.nominals },
      { key: 'r2', label: 'Резьба справа', kind: 'choice', options: ThreadSizes.nominals },
      { key: 'm1', label: 'Длина, мм', kind: 'length', min: 1, max: 200, step: 0.5 },
    ],
    presets: STEEL_COUPLINGS.map(([r1, r2, m1]) => ({
      label: `${r1} × ${r2}, ${mm(m1)} мм`,
      params: { r1, r2, m1 },
    })),
  },
  {
    generatorId: 'pl_ugol_90_1',
    fields: [
      { key: 'r1', label: 'Труба, мм', kind: 'choice', options: PpPipeSizes.nominals },
      { key: 'm1', label: 'Длина плеча, мм', kind: 'length', min: 1, max: 200, step: 0.5 },
    ],
    presets: PP_ELBOWS.map(([r1, m1]) => ({ label: `${r1}, ${mm(m1)} мм`, params: { r1, m1 } })),
  },
  {
    generatorId: 'al_radiator_1',
    fields: [
      { key: 'count', label: 'Секций', kind: 'integer', min: 1, max: 10 },
      { key: 'size.y', label: 'Высота, мм', kind: 'length', min: 100, max: 1000, step: 5 },
      { key: 'size.x', label: 'Ширина секции, мм', kind: 'length', min: 41, max: 120, step: 1 },
      { key: 'r1', label: 'Резьба', kind: 'choice', options: ThreadSizes.nominals },
    ],
    presets: AL_RADIATOR_HEIGHTS.flatMap((y) =>
      AL_RADIATOR_COUNTS.map((count) => ({
        label: `h${mm(y)}, ${count} шт.`,
        params: { count, size: { x: 0.08, y, z: 0.08 }, r1: '1' },
      })),
    ),
  },
];
