export type StandParams = Record<string, unknown>;

export interface Preset {
  label: string;
  params: StandParams;
}

/** Наборы параметров генератора; поля панели берутся из его paramSpecs. */
export interface GeneratorPresets {
  generatorId: string;
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

/** Наборы st_nippel из gl2/createObj/start.js: [r1, r2, m1]. */
const STEEL_NIPPLES: [string, string, number][] = [
  ['1/2', '1/2', 0.022],
  ['3/4', '3/4', 0.022],
  ['1', '1', 0.034],
  ['1 1/4', '1 1/4', 0.035],
  ['1 1/2', '1 1/2', 0.038],
  ['2', '2', 0.039],
  ['3/8', '1/4', 0.021],
  ['1/2', '1/4', 0.022],
  ['1/2', '3/8', 0.022],
  ['3/4', '1/2', 0.026],
  ['1', '1/2', 0.034],
  ['1', '3/4', 0.034],
  ['1 1/4', '1/2', 0.035],
  ['1 1/4', '3/4', 0.035],
  ['1 1/4', '1', 0.037],
  ['1 1/2', '1/2', 0.038],
  ['1 1/2', '3/4', 0.038],
  ['1 1/2', '1', 0.04],
  ['1 1/2', '1 1/4', 0.041],
  ['2', '1/2', 0.039],
  ['2', '3/4', 0.041],
  ['2', '1', 0.041],
  ['2', '1 1/4', 0.041],
  ['2', '1 1/2', 0.043],
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
    presets: STEEL_COUPLINGS.map(([r1, r2, m1]) => ({
      label: `${r1} × ${r2}, ${mm(m1)} мм`,
      params: { r1, r2, m1 },
    })),
  },
  {
    generatorId: 'st_nippel_1',
    presets: STEEL_NIPPLES.map(([r1, r2, m1]) => ({
      label: `${r1} × ${r2}, ${mm(m1)} мм`,
      params: { r1, r2, m1 },
    })),
  },
  {
    generatorId: 'pl_ugol_90_1',
    presets: PP_ELBOWS.map(([r1, m1]) => ({ label: `${r1}, ${mm(m1)} мм`, params: { r1, m1 } })),
  },
  {
    generatorId: 'al_radiator_1',
    presets: AL_RADIATOR_HEIGHTS.flatMap((y) =>
      AL_RADIATOR_COUNTS.map((count) => ({
        label: `h${mm(y)}, ${count} шт.`,
        params: { count, size: { x: 0.08, y, z: 0.08 }, r1: '1' },
      })),
    ),
  },
  {
    // Наборы al_zagl_radiator_1 из gl2/createObj/start.js (r2: 0 — как в каталоге gl2).
    generatorId: 'al_zagl_radiator_1',
    presets: [
      { label: 'переходник 1 → 1/2', params: { r1: '1', r2: '1/2', type: 'prh' } },
      { label: 'переходник 1 → 3/4', params: { r1: '1', r2: '3/4', type: 'prh' } },
      { label: 'заглушка 1', params: { r1: '1', r2: 0, type: 'zgl' } },
      { label: 'воздухоотводчик 1', params: { r1: '1', r2: 0, type: 'vsd' } },
    ],
  },
];
