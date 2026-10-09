import type { ThreadGender } from '../core/contracts';
import { entry, genderLabel, GENDERS, mm } from './entry';
import type { CatalogEntry } from './entry';

// Позиции — наборы gl2/createObj/start.js.

/** Муфты: [nominalLeft, nominalRight, length]. */
const COUPLINGS: [string, string, number][] = [
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

/** Ниппели: [nominalLeft, nominalRight, length]. */
const NIPPLES: [string, string, number][] = [
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

/** Заглушки (стальные и радиаторные): [nominal, length]. */
const PLUGS: [string, number][] = [
  ['1/2', 0.022],
  ['3/4', 0.022],
  ['1', 0.034],
  ['1 1/4', 0.035],
  ['1 1/2', 0.038],
  ['2', 0.039],
];

/** Полусгоны: [nutNominal, pipeNominal, length]. */
const HALF_UNIONS: [string, string, number][] = [
  ['3/4', '1/2', 0.04],
  ['1', '3/4', 0.045],
  ['1 1/4', '1', 0.052],
];

/** Углы 90°: [threadGender, nominal, armLength]. */
const ELBOWS: [ThreadGender, string, number][] = [
  ['internal', '1/2', 0.023],
  ['internal', '3/4', 0.029],
  ['internal', '1', 0.037],
  ['internal', '1 1/4', 0.046],
  ['internal', '1 1/2', 0.053],
  ['internal', '2', 0.065],
  ['external', '1/2', 0.027],
  ['external', '3/4', 0.034],
  ['external', '1', 0.041],
];

/** Углы 45°: [nominal, armLength]. */
const ELBOWS_45: [string, number][] = [
  ['1/2', 0.018],
  ['3/4', 0.022],
  ['1', 0.028],
];

/** Тройники: [threadGender, nominalLeft, nominalBranch, nominalRight, length, branchLength]. */
const TEES: [ThreadGender, string, string, string, number, number][] = [
  ['internal', '1/2', '1/2', '1/2', 0.046, 0.023],
  ['internal', '3/4', '3/4', '3/4', 0.058, 0.027],
  ['internal', '1', '1', '1', 0.069, 0.035],
  ['internal', '1 1/4', '1 1/4', '1 1/4', 0.08, 0.04],
  ['internal', '1 1/2', '1 1/2', '1 1/2', 0.092, 0.046],
  ['internal', '2', '2', '2', 0.103, 0.052],
  ['external', '1/2', '1/2', '1/2', 0.06, 0.03],
  ['external', '3/4', '3/4', '3/4', 0.075, 0.036],
  ['external', '1', '1', '1', 0.08, 0.04],
  ['internal', '3/4', '1/2', '3/4', 0.056, 0.027],
  ['internal', '1', '1/2', '1', 0.056, 0.03],
  ['internal', '1', '3/4', '1', 0.062, 0.03],
  ['internal', '1 1/4', '1/2', '1 1/4', 0.064, 0.036],
  ['internal', '1 1/4', '3/4', '1 1/4', 0.07, 0.036],
  ['internal', '1 1/4', '1', '1 1/4', 0.076, 0.038],
];

/** Крестовины: [nominal, size]. */
const CROSSES: [string, number][] = [
  ['1/2', 0.046],
  ['3/4', 0.053],
  ['1', 0.069],
  ['1 1/4', 0.083],
];

/**
 * Коллекторы: [nominal, outletNominal, outlets, length]; branchLength = 0.036.
 * В start.js блоки коллекторов выключены (1==2), но наборы в них — каталожные.
 */
const MANIFOLDS: [string, string, number, number][] = [
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
const MANIFOLD_BRANCH = 0.036;

export const STEEL_CATALOG: CatalogEntry[] = [
  entry(
    'steel.coupling',
    COUPLINGS.map(([nominalLeft, nominalRight, length]) => ({
      label: `${nominalLeft} × ${nominalRight}, ${mm(length)} мм`,
      params: { nominalLeft, nominalRight, length },
    })),
  ),
  entry(
    'steel.nipple',
    NIPPLES.map(([nominalLeft, nominalRight, length]) => ({
      label: `${nominalLeft} × ${nominalRight}, ${mm(length)} мм`,
      params: { nominalLeft, nominalRight, length },
    })),
  ),
  entry(
    'steel.plug',
    PLUGS.map(([nominal, length]) => ({ label: `${nominal}, ${mm(length)} мм`, params: { nominal, length } })),
  ),
  entry(
    'steel.half-union',
    HALF_UNIONS.map(([nutNominal, pipeNominal, length]) => ({
      label: `${nutNominal} × ${pipeNominal}, ${mm(length)} мм`,
      params: { nutNominal, pipeNominal, length },
    })),
  ),
  entry(
    'steel.elbow-90',
    ELBOWS.map(([threadGender, nominal, armLength]) => ({
      label: `${nominal}(${genderLabel(threadGender)}), ${mm(armLength)} мм`,
      params: { threadGender, nominal, armLength },
    })),
  ),
  entry(
    'steel.elbow-45',
    ELBOWS_45.map(([nominal, armLength]) => ({ label: `${nominal}, ${mm(armLength)} мм`, params: { nominal, armLength } })),
  ),
  entry(
    'steel.tee',
    TEES.map(([threadGender, nominalLeft, nominalBranch, nominalRight, length, branchLength]) => ({
      label: `${nominalLeft} × ${nominalBranch} × ${nominalRight}(${genderLabel(threadGender)})`,
      params: { threadGender, nominalLeft, nominalBranch, nominalRight, length, branchLength },
    })),
  ),
  entry(
    'steel.cross',
    CROSSES.map(([nominal, size]) => ({ label: `${nominal}, ${mm(size)} мм`, params: { nominal, size } })),
  ),
  entry(
    'steel.manifold',
    GENDERS.flatMap((threadGender) =>
      // Внутренняя резьба выходов — только для 3/4 и 1 × 1/2, как в start.js.
      MANIFOLDS.slice(0, threadGender === 'external' ? MANIFOLDS.length : 6).map(([nominal, outletNominal, outlets, length]) => ({
        label: `${nominal} × ${outletNominal}(${genderLabel(threadGender)}), ${outlets} вых.`,
        params: { threadGender, nominal, outletNominal, outlets, length, branchLength: MANIFOLD_BRANCH },
      })),
    ),
  ),
  entry(
    'steel.manifold-valves',
    (['red', 'blue'] as const).flatMap((handleColor) =>
      // С кранами — без 1 × 3/4 на 4 выхода, как в start.js.
      MANIFOLDS.slice(0, 8).map(([nominal, outletNominal, outlets, length]) => ({
        label: `${nominal} × ${outletNominal}, ${outlets} вых., ${handleColor === 'red' ? 'красные' : 'синие'}`,
        params: { nominal, outletNominal, outlets, length, branchLength: MANIFOLD_BRANCH, handleColor },
      })),
    ),
  ),
];
