import type { ThreadGender } from '../core/contracts';
import { entry, genderLabel, GENDERS, mm } from './entry';
import type { CatalogEntry } from './entry';

// Позиции — наборы gl2/createObj/start.js.

/** Углы: [nominal, armLength]. */
const ELBOWS: [string, number][] = [
  ['16', 0.042],
  ['20', 0.044],
  ['26', 0.049],
  ['32', 0.052],
  ['40', 0.063],
];

/** Углы с резьбой, для обеих сторон резьбы: [pipeNominal, threadNominal, armLength, threadArmLength]. */
const THREAD_ELBOWS: [string, string, number, number][] = [
  ['16', '1/2', 0.042, 0.028],
  ['16', '3/4', 0.043, 0.03],
  ['20', '1/2', 0.044, 0.029],
  ['20', '3/4', 0.044, 0.032],
  ['26', '3/4', 0.049, 0.034],
  ['26', '1', 0.049, 0.037],
  ['32', '1', 0.051, 0.039],
];

/** Соединители: [nominalLeft, nominalRight, length]. */
const COUPLINGS: [string, string, number][] = [
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

/** Переходы на резьбу, для обеих сторон резьбы: [pipeNominal, threadNominal, length]. */
const THREAD_ADAPTERS: [string, string, number][] = [
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

/** Тройники: [nominalLeft, nominalBranch, nominalRight, length, branchLength]. */
const TEES: [string, string, string, number, number][] = [
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

/**
 * Тройники с резьбой: [threadGender, nominalLeft, threadNominal, nominalRight, length, branchLength];
 * 1 1/4 и 40 — только с внутренней резьбой.
 */
const THREAD_TEES: [ThreadGender, string, string, string, number, number][] = [
  ...GENDERS.flatMap((gender): [ThreadGender, string, string, string, number, number][] => [
    [gender, '16', '1/2', '16', 0.083, 0.028],
    [gender, '20', '1/2', '20', 0.088, 0.029],
    [gender, '20', '3/4', '20', 0.088, 0.032],
    [gender, '26', '1/2', '26', 0.097, 0.032],
    [gender, '26', '3/4', '26', 0.097, 0.034],
    [gender, '26', '1', '26', 0.097, 0.037],
    [gender, '32', '3/4', '32', 0.104, 0.035],
    [gender, '32', '1', '32', 0.104, 0.039],
  ]),
  ['internal', '32', '1 1/4', '32', 0.122, 0.046],
  ['internal', '40', '1', '40', 0.124, 0.046],
];

/** Номиналы труб — sizeTubeMP из gl2/createObj/calculation_2.js. */
const PIPES = ['16', '20', '26', '32', '40'];

export const MP_CATALOG: CatalogEntry[] = [
  entry(
    'mp.elbow',
    ELBOWS.map(([nominal, armLength]) => ({ label: `${nominal}, ${mm(armLength)} мм`, params: { nominal, armLength } })),
  ),
  entry(
    'mp.elbow-thread',
    GENDERS.flatMap((threadGender) =>
      THREAD_ELBOWS.map(([pipeNominal, threadNominal, armLength, threadArmLength]) => ({
        label: `${pipeNominal} × ${threadNominal}(${genderLabel(threadGender)})`,
        params: { threadGender, pipeNominal, threadNominal, armLength, threadArmLength },
      })),
    ),
  ),
  entry(
    'mp.coupling',
    COUPLINGS.map(([nominalLeft, nominalRight, length]) => ({
      label: `${nominalLeft} × ${nominalRight}, ${mm(length)} мм`,
      params: { nominalLeft, nominalRight, length },
    })),
  ),
  entry(
    'mp.thread-adapter',
    GENDERS.flatMap((threadGender) =>
      THREAD_ADAPTERS.map(([pipeNominal, threadNominal, length]) => ({
        label: `${pipeNominal} × ${threadNominal}(${genderLabel(threadGender)})`,
        params: { threadGender, pipeNominal, threadNominal, length },
      })),
    ),
  ),
  entry(
    'mp.tee',
    TEES.map(([nominalLeft, nominalBranch, nominalRight, length, branchLength]) => ({
      label: `${nominalLeft} × ${nominalBranch} × ${nominalRight}`,
      params: { nominalLeft, nominalBranch, nominalRight, length, branchLength },
    })),
  ),
  entry(
    'mp.tee-thread',
    THREAD_TEES.map(([threadGender, nominalLeft, threadNominal, nominalRight, length, branchLength]) => ({
      label: `${nominalLeft} × ${threadNominal}(${genderLabel(threadGender)}) × ${nominalRight}`,
      params: { threadGender, nominalLeft, threadNominal, nominalRight, length, branchLength },
    })),
  ),
  entry('mp.pipe', [
    ...PIPES.map((nominal) => ({ label: `МП ${nominal}, 1 м`, params: { nominal, length: 1 } })),
    { label: 'МП 16, 250 мм', params: { nominal: '16', length: 0.25 } },
  ]),
];
