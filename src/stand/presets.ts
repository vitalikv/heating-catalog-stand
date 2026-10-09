import { fromGl2 } from '../lib/legacy/gl2';

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

/** Наборы st_zagl_nr из gl2/createObj/start.js (стальные и радиаторные заглушки): [r1, m1]. */
const STEEL_PLUGS: [string, number][] = [
  ['1/2', 0.022],
  ['3/4', 0.022],
  ['1', 0.034],
  ['1 1/4', 0.035],
  ['1 1/2', 0.038],
  ['2', 0.039],
];

/** Наборы st_pol_sgon_1: [r1 гайки, r2 патрубка, m1]. */
const STEEL_HALF_UNIONS: [string, string, number][] = [
  ['3/4', '1/2', 0.04],
  ['1', '3/4', 0.045],
  ['1 1/4', '1', 0.052],
];

/** Наборы st_ugol_90_1: [side, r1, m1]. */
const STEEL_ELBOWS: [string, string, number][] = [
  ['v', '1/2', 0.023],
  ['v', '3/4', 0.029],
  ['v', '1', 0.037],
  ['v', '1 1/4', 0.046],
  ['v', '1 1/2', 0.053],
  ['v', '2', 0.065],
  ['n', '1/2', 0.027],
  ['n', '3/4', 0.034],
  ['n', '1', 0.041],
];

/** Наборы st_ugol_45_1: [r1, m1]. */
const STEEL_ELBOWS_45: [string, number][] = [
  ['1/2', 0.018],
  ['3/4', 0.022],
  ['1', 0.028],
];

/** Наборы st_troinik_1: [side, r1, r2, r3, m1, m2]. */
const STEEL_TEES: [string, string, string, string, number, number][] = [
  ['v', '1/2', '1/2', '1/2', 0.046, 0.023],
  ['v', '3/4', '3/4', '3/4', 0.058, 0.027],
  ['v', '1', '1', '1', 0.069, 0.035],
  ['v', '1 1/4', '1 1/4', '1 1/4', 0.08, 0.04],
  ['v', '1 1/2', '1 1/2', '1 1/2', 0.092, 0.046],
  ['v', '2', '2', '2', 0.103, 0.052],
  ['n', '1/2', '1/2', '1/2', 0.06, 0.03],
  ['n', '3/4', '3/4', '3/4', 0.075, 0.036],
  ['n', '1', '1', '1', 0.08, 0.04],
  ['v', '3/4', '1/2', '3/4', 0.056, 0.027],
  ['v', '1', '1/2', '1', 0.056, 0.03],
  ['v', '1', '3/4', '1', 0.062, 0.03],
  ['v', '1 1/4', '1/2', '1 1/4', 0.064, 0.036],
  ['v', '1 1/4', '3/4', '1 1/4', 0.07, 0.036],
  ['v', '1 1/4', '1', '1 1/4', 0.076, 0.038],
];

/** Наборы st_krestovina_1: [r1, m1]. */
const STEEL_CROSSES: [string, number][] = [
  ['1/2', 0.046],
  ['3/4', 0.053],
  ['1', 0.069],
  ['1 1/4', 0.083],
];

/**
 * Наборы коллекторов из gl2/createObj/start.js: [r1, r2, count, m1]; m2 = 0.036.
 * В start.js блоки коллекторов выключены (1==2), но наборы в них — каталожные.
 */
const COLLECTORS: [string, string, number, number][] = [
  ['3/4', '1/2', 2, 0.095],
  ['3/4', '1/2', 3, 0.132],
  ['3/4', '1/2', 4, 0.169],
  ['1', '1/2', 2, 0.095],
  ['1', '1/2', 3, 0.132],
  ['1', '1/2', 4, 0.169],
  ['1', '3/4', 2, 0.095],
  ['1', '3/4', 3, 0.132],
  ['1', '3/4', 4, 0.169],
];
const COLLECTOR_OUTLET = 0.036;

/** Наборы pl_ugol_90 из gl2/createObj/start.js: [r1, m1]. */
const PP_ELBOWS: [string, number][] = [
  ['20', 0.026],
  ['25', 0.03],
  ['32', 0.037],
  ['40', 0.044],
  ['50', 0.053],
  ['63', 0.06],
];

/** Наборы pl_ugol_45_1: [r1, m1]. */
const PP_ELBOWS_45: [string, number][] = [
  ['20', 0.021],
  ['25', 0.024],
  ['32', 0.028],
  ['40', 0.035],
  ['50', 0.038],
  ['63', 0.042],
];

/** Наборы pl_ugol_90_rezba_1 для обеих сторон резьбы: [r1, r2, m1]. */
const PP_THREAD_ELBOWS: [string, string, number][] = [
  ['20', '1/2', 0.026],
  ['20', '3/4', 0.031],
  ['25', '1/2', 0.03],
  ['25', '3/4', 0.031],
  ['32', '3/4', 0.036],
  ['32', '1', 0.039],
];

/** Наборы pl_mufta_1: [r1, r2, m1]. */
const PP_COUPLINGS: [string, string, number][] = [
  ['25', '20', 0.039],
  ['32', '20', 0.043],
  ['32', '25', 0.045],
  ['40', '20', 0.044],
  ['40', '25', 0.045],
  ['40', '32', 0.048],
  ['50', '20', 0.055],
  ['50', '25', 0.055],
  ['50', '32', 0.056],
  ['50', '40', 0.056],
  ['63', '25', 0.065],
  ['63', '32', 0.065],
  ['63', '40', 0.065],
  ['63', '50', 0.067],
  ['20', '20', 0.032],
  ['25', '25', 0.035],
  ['32', '32', 0.039],
  ['40', '40', 0.046],
  ['50', '50', 0.052],
  ['63', '63', 0.06],
];

/** Наборы pl_perehod_rezba_1 для обеих сторон резьбы: [r1, r2, m1]. */
const PP_THREAD_ADAPTERS: [string, string, number][] = [
  ['20', '1/2', 0.036],
  ['20', '3/4', 0.038],
  ['25', '1/2', 0.039],
  ['25', '3/4', 0.041],
  ['32', '3/4', 0.043],
  ['32', '1', 0.049],
];

/** Наборы pl_troinik_1: [r1, m1]. */
const PP_TEES: [string, number][] = [
  ['20', 0.055],
  ['25', 0.064],
  ['32', 0.08],
  ['40', 0.095],
  ['50', 0.11],
  ['63', 0.125],
];

/** Наборы pl_troinik_2: [r1, r2, r3, m1, m2]. */
const PP_REDUCING_TEES: [string, string, string, number, number][] = [
  ['25', '20', '20', 0.055, 0.015],
  ['25', '20', '25', 0.055, 0.015],
  ['32', '20', '20', 0.06, 0.015],
  ['32', '20', '25', 0.06, 0.015],
  ['32', '20', '32', 0.06, 0.015],
  ['32', '25', '20', 0.065, 0.016],
  ['32', '25', '25', 0.065, 0.016],
  ['32', '25', '32', 0.065, 0.015],
  ['40', '20', '40', 0.075, 0.015],
  ['40', '25', '40', 0.075, 0.016],
  ['40', '32', '40', 0.075, 0.018],
  ['50', '20', '50', 0.102, 0.015],
  ['50', '25', '50', 0.102, 0.016],
  ['50', '32', '50', 0.102, 0.018],
  ['50', '40', '50', 0.102, 0.021],
];

/** Наборы pl_troinik_rezba_1 для обеих сторон резьбы: [r1, r2, m1]. */
const PP_THREAD_TEES: [string, string, number][] = [
  ['20', '1/2', 0.07],
  ['20', '3/4', 0.07],
  ['25', '1/2', 0.075],
  ['25', '3/4', 0.075],
  ['32', '3/4', 0.08],
  ['32', '1', 0.08],
];

/** Наборы pl_krestovina_1: [r1, m1]. */
const PP_CROSSES: [string, number][] = [
  ['20', 0.052],
  ['25', 0.06],
  ['32', 0.072],
  ['40', 0.089],
  ['50', 0.105],
];

/** Наборы mpl_ugol_1: [r1, m1]. */
const MP_ELBOWS: [string, number][] = [
  ['16', 0.042],
  ['20', 0.044],
  ['26', 0.049],
  ['32', 0.052],
  ['40', 0.063],
];

/** Наборы mpl_ugol_rezba_1 для обеих сторон резьбы: [r1, r2, m1, m2]. */
const MP_THREAD_ELBOWS: [string, string, number, number][] = [
  ['16', '1/2', 0.042, 0.028],
  ['16', '3/4', 0.043, 0.03],
  ['20', '1/2', 0.044, 0.029],
  ['20', '3/4', 0.044, 0.032],
  ['26', '3/4', 0.049, 0.034],
  ['26', '1', 0.049, 0.037],
  ['32', '1', 0.051, 0.039],
];

/** Наборы mpl_perehod_1: [r1, r3, m1]. */
const MP_COUPLINGS: [string, string, number][] = [
  ['16', '16', 0.06],
  ['20', '20', 0.06],
  ['26', '26', 0.062],
  ['32', '32', 0.063],
  ['40', '40', 0.079],
  ['20', '16', 0.06],
  ['26', '16', 0.061],
  ['26', '20', 0.061],
  ['32', '16', 0.062],
  ['32', '20', 0.062],
  ['32', '26', 0.063],
];

/** Наборы mpl_perehod_rezba_1 для обеих сторон резьбы: [r1, r2, m1]. */
const MP_THREAD_ADAPTERS: [string, string, number][] = [
  ['16', '1/2', 0.048],
  ['16', '3/4', 0.049],
  ['20', '1/2', 0.048],
  ['20', '3/4', 0.049],
  ['26', '3/4', 0.05],
  ['26', '1', 0.052],
  ['32', '1', 0.052],
  ['32', '1 1/4', 0.057],
  ['40', '1', 0.06],
  ['40', '1 1/4', 0.06],
];

/** Наборы mpl_troinik_1: [r1, r2, r3, m1, m2]. */
const MP_TEES: [string, string, string, number, number][] = [
  ['16', '20', '16', 0.088, 0.044],
  ['16', '16', '20', 0.088, 0.044],
  ['20', '16', '20', 0.088, 0.044],
  ['16', '20', '20', 0.088, 0.044],
  ['20', '26', '20', 0.096, 0.049],
  ['26', '16', '26', 0.097, 0.046],
  ['26', '16', '20', 0.096, 0.047],
  ['26', '20', '20', 0.097, 0.048],
  ['26', '26', '20', 0.097, 0.048],
  ['26', '20', '16', 0.097, 0.048],
  ['26', '20', '26', 0.097, 0.048],
  ['32', '16', '32', 0.104, 0.051],
  ['32', '20', '32', 0.104, 0.051],
  ['32', '26', '26', 0.104, 0.052],
  ['32', '26', '32', 0.104, 0.052],
  ['32', '32', '26', 0.104, 0.052],
  ['32', '32', '20', 0.104, 0.052],
  ['32', '20', '26', 0.104, 0.051],
  ['26', '32', '26', 0.104, 0.052],
  ['16', '16', '16', 0.083, 0.083 / 2],
  ['20', '20', '20', 0.088, 0.088 / 2],
  ['26', '26', '26', 0.097, 0.097 / 2],
  ['32', '32', '32', 0.112, 0.112 / 2],
];

/** Наборы mpl_troinik_rezba_1: [side, r1, r2, r3, m1, m2]; 1 1/4 и 40 — только с внутренней резьбой. */
const MP_THREAD_TEES: [string, string, string, string, number, number][] = [
  ...(['n', 'v'] as const).flatMap((side): [string, string, string, string, number, number][] => [
    [side, '16', '1/2', '16', 0.083, 0.028],
    [side, '20', '1/2', '20', 0.088, 0.029],
    [side, '20', '3/4', '20', 0.088, 0.032],
    [side, '26', '1/2', '26', 0.097, 0.032],
    [side, '26', '3/4', '26', 0.097, 0.034],
    [side, '26', '1', '26', 0.097, 0.037],
    [side, '32', '3/4', '32', 0.104, 0.035],
    [side, '32', '1', '32', 0.104, 0.039],
  ]),
  ['v', '32', '1 1/4', '32', 0.122, 0.046],
  ['v', '40', '1', '40', 0.124, 0.046],
];

/** Наборы shar_kran_n_1 и shar_kran_v_n_1: [r1, m1, t1]. */
const BALL_VALVES_LONG: [string, number, number][] = [
  ['1/2', 0.063, 0.053],
  ['3/4', 0.07, 0.053],
  ['1', 0.076, 0.06],
  ['1 1/4', 0.085, 0.064],
  ['1 1/2', 0.096, 0.07],
  ['2', 0.111, 0.07],
];

/** Наборы shar_kran_v_1: [r1, m1, t1]. */
const BALL_VALVES_INTERNAL: [string, number, number][] = [
  ['1/2', 0.0475, 0.053],
  ['3/4', 0.0555, 0.053],
  ['1', 0.0625, 0.06],
  ['1 1/4', 0.0775, 0.064],
  ['1 1/2', 0.087, 0.07],
  ['2', 0.101, 0.07],
];

/** Наборы shar_kran_sgon_1: [r1, r2, m1, m2, t1]. */
const BALL_VALVE_UNIONS: [string, string, number, number, number][] = [
  ['1/2', '3/4', 0.055, 0.026, 0.053],
  ['3/4', '1', 0.059, 0.03, 0.053],
  ['1', '1 1/4', 0.065, 0.037, 0.06],
  ['1 1/4', '1 1/2', 0.075, 0.045, 0.06],
];

/** Наборы reg_kran_primoy_1: [r1, r2, m1, m2]; в start.js каждый — с колпачком и с termoreg: true. */
const REGULATING_VALVES: [string, string, number, number][] = [
  ['1/2', '3/4', 0.055, 0.02],
  ['3/4', '1', 0.059, 0.022],
];

/** ends — вид концов в подписи: у трёх функций gl2 теперь один генератор valve.ball. */
const valvePresets = (rows: [string, number, number][], ends: string) =>
  rows.map(([r1, m1, t1]) => ({ label: `${r1}${ends}, ${mm(m1)} мм`, params: { r1, m1, t1 } }));

/** Наборы с резьбой в start.js идут сначала с наружной ('n'), потом с внутренней ('v'). */
const SIDES = ['n', 'v'] as const;
const sideLabel = (side: string) => (side === 'v' ? 'в' : 'н');

/** Высоты al_radiator_1 из gl2/createObj/start.js; там count = 1…10 для каждой. */
const AL_RADIATOR_HEIGHTS = [0.2, 0.35, 0.5, 0.6, 0.7, 0.8];
const AL_RADIATOR_COUNTS = [1, 5, 10];

/** st_radiator_1 из gl2/createObj/start.js: каждая высота со всеми длинами, z = 0.07, r1 = 1/2. */
const ST_RADIATOR_HEIGHTS = [0.3, 0.4, 0.5, 0.6, 0.9];
const ST_RADIATOR_LENGTHS = [0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0, 1.2, 1.4, 1.6, 1.8, 2.0];

const mm = (meters: number) => Math.round(meters * 10000) / 10;

/** Наборы cr_gaika_nasos_1: [r1, r2]; m1 в start.js на геометрию не влияет. */
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

/** Наборы filtr_kosoy_1: [r1, m1]. */
const STRAINERS: [string, number][] = [
  ['1/2', 0.053],
  ['3/4', 0.065],
  ['1', 0.077],
  ['1 1/4', 0.091],
  ['1 1/2', 0.106],
  ['2', 0.126],
];

/** Наборы cr_rash_bak_1: [d, h1, name]. */
const EXPANSION_TANKS: [number, number, string][] = [
  [0.245, 0.25, '6л'],
  [0.245, 0.28, '8л'],
  [0.245, 0.33, '10л'],
  [0.285, 0.325, '12л'],
  [0.285, 0.395, '18л'],
  [0.325, 0.42, '24л'],
];

/** Номиналы труб: sizeTubePP и sizeTubeMP из gl2/createObj/calculation_2.js. */
const PP_PIPES = ['20', '25', '32', '40', '50', '63', '75', '90', '110'];
const MP_PIPES = ['16', '20', '26', '32', '40'];

/**
 * Наборы в формате gl2: ID функции и cdm, как в start.js. Источник для сверки с gl2
 * (scripts/gl2-compare.mjs); стенд и тесты берут STAND_PRESETS.
 */
export const GL2_PRESETS: GeneratorPresets[] = [
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
    generatorId: 'st_zagl_nr',
    presets: STEEL_PLUGS.map(([r1, m1]) => ({ label: `${r1}, ${mm(m1)} мм`, params: { r1, m1 } })),
  },
  {
    generatorId: 'st_pol_sgon_1',
    presets: STEEL_HALF_UNIONS.map(([r1, r2, m1]) => ({ label: `${r1} × ${r2}, ${mm(m1)} мм`, params: { r1, r2, m1 } })),
  },
  {
    generatorId: 'st_ugol_90_1',
    presets: STEEL_ELBOWS.map(([side, r1, m1]) => ({ label: `${r1}(${side === 'v' ? 'в' : 'н'}), ${mm(m1)} мм`, params: { side, r1, m1 } })),
  },
  {
    generatorId: 'st_ugol_45_1',
    presets: STEEL_ELBOWS_45.map(([r1, m1]) => ({ label: `${r1}, ${mm(m1)} мм`, params: { r1, m1 } })),
  },
  {
    generatorId: 'st_troinik_1',
    presets: STEEL_TEES.map(([side, r1, r2, r3, m1, m2]) => ({
      label: `${r1} × ${r2} × ${r3}(${side === 'v' ? 'в' : 'н'})`,
      params: { side, r1, r2, r3, m1, m2 },
    })),
  },
  {
    generatorId: 'st_krestovina_1',
    presets: STEEL_CROSSES.map(([r1, m1]) => ({ label: `${r1}, ${mm(m1)} мм`, params: { r1, m1 } })),
  },
  {
    generatorId: 'st_collector_1',
    presets: (['n', 'v'] as const).flatMap((side) =>
      // Внутренняя резьба выходов — только для r1 = 3/4 и 1 × 1/2, как в start.js.
      COLLECTORS.slice(0, side === 'n' ? COLLECTORS.length : 6).map(([r1, r2, count, m1]) => ({
        label: `${r1} × ${r2}(${side === 'v' ? 'в' : 'н'}), ${count} вых.`,
        params: { side, r1, r2, count, m1, m2: COLLECTOR_OUTLET },
      })),
    ),
  },
  {
    generatorId: 'st_collector_2',
    presets: (['red', 'blue'] as const).flatMap((color) =>
      // С кранами — без 1 × 3/4 на 4 выхода, как в start.js.
      COLLECTORS.slice(0, 8).map(([r1, r2, count, m1]) => ({
        label: `${r1} × ${r2}, ${count} вых., ${color === 'red' ? 'красные' : 'синие'}`,
        params: { r1, r2, count, m1, m2: COLLECTOR_OUTLET, color },
      })),
    ),
  },
  {
    generatorId: 'pl_ugol_90_1',
    presets: PP_ELBOWS.map(([r1, m1]) => ({ label: `${r1}, ${mm(m1)} мм`, params: { r1, m1 } })),
  },
  {
    generatorId: 'pl_ugol_45_1',
    presets: PP_ELBOWS_45.map(([r1, m1]) => ({ label: `${r1}, ${mm(m1)} мм`, params: { r1, m1 } })),
  },
  {
    generatorId: 'pl_ugol_90_rezba_1',
    presets: SIDES.flatMap((side) =>
      PP_THREAD_ELBOWS.map(([r1, r2, m1]) => ({ label: `${r1} × ${r2}(${sideLabel(side)})`, params: { side, r1, r2, m1 } })),
    ),
  },
  {
    generatorId: 'pl_mufta_1',
    presets: PP_COUPLINGS.map(([r1, r2, m1]) => ({ label: `${r1} × ${r2}, ${mm(m1)} мм`, params: { r1, r2, m1 } })),
  },
  {
    generatorId: 'pl_perehod_rezba_1',
    presets: SIDES.flatMap((side) =>
      PP_THREAD_ADAPTERS.map(([r1, r2, m1]) => ({ label: `${r1} × ${r2}(${sideLabel(side)})`, params: { side, r1, r2, m1 } })),
    ),
  },
  {
    generatorId: 'pl_troinik_1',
    presets: PP_TEES.map(([r1, m1]) => ({ label: `${r1}, ${mm(m1)} мм`, params: { r1, m1 } })),
  },
  {
    generatorId: 'pl_troinik_2',
    presets: PP_REDUCING_TEES.map(([r1, r2, r3, m1, m2]) => ({ label: `${r1} × ${r2} × ${r3}`, params: { r1, r2, r3, m1, m2 } })),
  },
  {
    generatorId: 'pl_troinik_rezba_1',
    presets: SIDES.flatMap((side) =>
      PP_THREAD_TEES.map(([r1, r2, m1]) => ({ label: `${r1} × ${r2}(${sideLabel(side)})`, params: { side, r1, r2, m1 } })),
    ),
  },
  {
    generatorId: 'pl_krestovina_1',
    presets: PP_CROSSES.map(([r1, m1]) => ({ label: `${r1}, ${mm(m1)} мм`, params: { r1, m1 } })),
  },
  {
    generatorId: 'mpl_ugol_1',
    presets: MP_ELBOWS.map(([r1, m1]) => ({ label: `${r1}, ${mm(m1)} мм`, params: { r1, m1 } })),
  },
  {
    generatorId: 'mpl_ugol_rezba_1',
    presets: SIDES.flatMap((side) =>
      MP_THREAD_ELBOWS.map(([r1, r2, m1, m2]) => ({ label: `${r1} × ${r2}(${sideLabel(side)})`, params: { side, r1, r2, m1, m2 } })),
    ),
  },
  {
    generatorId: 'mpl_perehod_1',
    presets: MP_COUPLINGS.map(([r1, r3, m1]) => ({ label: `${r1} × ${r3}, ${mm(m1)} мм`, params: { r1, r3, m1 } })),
  },
  {
    generatorId: 'mpl_perehod_rezba_1',
    presets: SIDES.flatMap((side) =>
      MP_THREAD_ADAPTERS.map(([r1, r2, m1]) => ({ label: `${r1} × ${r2}(${sideLabel(side)})`, params: { side, r1, r2, m1 } })),
    ),
  },
  {
    generatorId: 'mpl_troinik_1',
    presets: MP_TEES.map(([r1, r2, r3, m1, m2]) => ({ label: `${r1} × ${r2} × ${r3}`, params: { r1, r2, r3, m1, m2 } })),
  },
  {
    generatorId: 'mpl_troinik_rezba_1',
    presets: MP_THREAD_TEES.map(([side, r1, r2, r3, m1, m2]) => ({
      label: `${r1} × ${r2}(${sideLabel(side)}) × ${r3}`,
      params: { side, r1, r2, r3, m1, m2 },
    })),
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
  { generatorId: 'shar_kran_n_1', presets: valvePresets(BALL_VALVES_LONG, '(н-н)') },
  { generatorId: 'shar_kran_v_1', presets: valvePresets(BALL_VALVES_INTERNAL, '(в-в)') },
  { generatorId: 'shar_kran_v_n_1', presets: valvePresets(BALL_VALVES_LONG, '(в-н)') },
  {
    generatorId: 'shar_kran_sgon_1',
    presets: BALL_VALVE_UNIONS.map(([r1, r2, m1, m2, t1]) => ({ label: `${r1} × ${r2}`, params: { r1, r2, m1, m2, t1 } })),
  },
  {
    generatorId: 'reg_kran_primoy_1',
    presets: (['cap', 'termo'] as const).flatMap((head) =>
      REGULATING_VALVES.map(([r1, r2, m1, m2]) => ({
        label: `${r1} × ${r2}, ${head === 'termo' ? 'терморегулятор' : 'колпачок'}`,
        params: { r1, r2, m1, m2, head },
      })),
    ),
  },
  {
    generatorId: 'rad_vozduhotvod_1',
    presets: [{ label: 'воздухоотводчик 1/2', params: { r1: '1/2', type: 'vsd' } }],
  },
  {
    generatorId: 'st_radiator_1',
    presets: ST_RADIATOR_HEIGHTS.flatMap((y) =>
      ST_RADIATOR_LENGTHS.map((x) => ({ label: `h${mm(y)}, ${mm(x)} мм`, params: { size: { x, y, z: 0.07 }, r1: '1/2' } })),
    ),
  },
  {
    // В gl2 — отрезки 1 м диаметром 16–50 мм; здесь — все номиналы sizeTubePP и sizeTubeMP.
    generatorId: 'createTubeWF_1',
    presets: [
      ...PP_PIPES.map((ppSize) => ({ label: `ПП ${ppSize}, 1 м`, params: { type: 'pp', ppSize, length: 1 } })),
      ...MP_PIPES.map((mpSize) => ({ label: `МП ${mpSize}, 1 м`, params: { type: 'mp', mpSize, length: 1 } })),
      { label: 'ПП 20, 250 мм', params: { type: 'pp', ppSize: '20', length: 0.25 } },
      { label: 'МП 16, 250 мм', params: { type: 'mp', mpSize: '16', length: 0.25 } },
    ],
  },
  {
    // Блоки насоса и гайки в start.js выключены (1==2), наборы каталожные — как у коллекторов.
    generatorId: 'cr_zr_nasos_1',
    presets: ['1', '1 1/4', '1 1/2', '2'].map((r1) => ({ label: r1, params: { r1 } })),
  },
  {
    generatorId: 'cr_gaika_nasos_1',
    presets: PUMP_NUTS.map(([r1, r2]) => ({ label: `${r1} × ${r2}`, params: { r1, r2 } })),
  },
  {
    generatorId: 'filtr_kosoy_1',
    presets: STRAINERS.map(([r1, m1]) => ({ label: `${r1}, ${mm(m1)} мм`, params: { r1, m1 } })),
  },
  {
    generatorId: 'cr_rash_bak_1',
    presets: EXPANSION_TANKS.map(([d, h1, name]) => ({ label: `${name}: Ø${mm(d)} × ${mm(h1)} мм`, params: { d, h1, r1: '3/4', name } })),
  },
  {
    generatorId: 'cr_kotel_1',
    presets: (['back', 'bottom', 'top-bottom', 'left-right'] as const).map((type) => ({
      label: type,
      params: { size: { x: 0.4, y: 0.73, z: 0.3 }, r1: '3/4', type },
    })),
  },
  {
    generatorId: 'gr_bez_1',
    presets: [{ label: '1', params: { size: { x: 0.18, y: 0.05, z: 0.05 }, r1: '1' } }],
  },
];

/** Наборы в формате библиотеки: GL2_PRESETS через fromGl2, по генераторам в порядке появления. */
export const STAND_PRESETS: GeneratorPresets[] = (() => {
  const byGenerator = new Map<string, Preset[]>();
  for (const entry of GL2_PRESETS) {
    for (const { label, params } of entry.presets) {
      const converted = fromGl2(entry.generatorId, params);
      const presets = byGenerator.get(converted.generatorId) ?? [];
      presets.push({ label, params: converted.params });
      byGenerator.set(converted.generatorId, presets);
    }
  }
  return [...byGenerator].map(([generatorId, presets]) => ({ generatorId, presets }));
})();
