import { PpPipeSizes, ThreadSizes } from '../lib/index';

export type ParamValue = string | number;
export type StandParams = Record<string, ParamValue>;

/** Поле панели. Длины хранятся в метрах, а в панели показываются в миллиметрах. */
export type ParamField =
  | { key: string; label: string; kind: 'choice'; options: readonly string[] }
  | { key: string; label: string; kind: 'length'; min: number; max: number; step: number };

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
];
