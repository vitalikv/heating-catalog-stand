import { entry, genderLabel, GENDERS, mm } from './entry';
import type { CatalogEntry } from './entry';

// Позиции — наборы gl2/createObj/start.js.

/** Углы 90°: [nominal, armLength]. */
const ELBOWS: [string, number][] = [
  ['20', 0.026],
  ['25', 0.03],
  ['32', 0.037],
  ['40', 0.044],
  ['50', 0.053],
  ['63', 0.06],
];

/** Углы 45°: [nominal, armLength]. */
const ELBOWS_45: [string, number][] = [
  ['20', 0.021],
  ['25', 0.024],
  ['32', 0.028],
  ['40', 0.035],
  ['50', 0.038],
  ['63', 0.042],
];

/** Углы с резьбой, для обеих сторон резьбы: [pipeNominal, threadNominal, armLength]. */
const THREAD_ELBOWS: [string, string, number][] = [
  ['20', '1/2', 0.026],
  ['20', '3/4', 0.031],
  ['25', '1/2', 0.03],
  ['25', '3/4', 0.031],
  ['32', '3/4', 0.036],
  ['32', '1', 0.039],
];

/** Муфты: [nominalLeft, nominalRight, length]. */
const COUPLINGS: [string, string, number][] = [
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

/** Переходы на резьбу, для обеих сторон резьбы: [pipeNominal, threadNominal, length]. */
const THREAD_ADAPTERS: [string, string, number][] = [
  ['20', '1/2', 0.036],
  ['20', '3/4', 0.038],
  ['25', '1/2', 0.039],
  ['25', '3/4', 0.041],
  ['32', '3/4', 0.043],
  ['32', '1', 0.049],
];

/** Тройники: [nominal, length]. */
const TEES: [string, number][] = [
  ['20', 0.055],
  ['25', 0.064],
  ['32', 0.08],
  ['40', 0.095],
  ['50', 0.11],
  ['63', 0.125],
];

/** Переходные тройники: [nominalLeft, nominalBranch, nominalRight, length, branchLength]. */
const REDUCING_TEES: [string, string, string, number, number][] = [
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

/** Тройники с резьбой, для обеих сторон резьбы: [pipeNominal, threadNominal, length]. */
const THREAD_TEES: [string, string, number][] = [
  ['20', '1/2', 0.07],
  ['20', '3/4', 0.07],
  ['25', '1/2', 0.075],
  ['25', '3/4', 0.075],
  ['32', '3/4', 0.08],
  ['32', '1', 0.08],
];

/** Крестовины: [nominal, size]. */
const CROSSES: [string, number][] = [
  ['20', 0.052],
  ['25', 0.06],
  ['32', 0.072],
  ['40', 0.089],
  ['50', 0.105],
];

/** Номиналы труб — sizeTubePP из gl2/createObj/calculation_2.js (в gl2 — отрезки 1 м до 50 мм). */
const PIPES = ['20', '25', '32', '40', '50', '63', '75', '90', '110'];

export const PP_CATALOG: CatalogEntry[] = [
  entry(
    'pp.elbow-90',
    ELBOWS.map(([nominal, armLength]) => ({ label: `${nominal}, ${mm(armLength)} мм`, params: { nominal, armLength } })),
  ),
  entry(
    'pp.elbow-45',
    ELBOWS_45.map(([nominal, armLength]) => ({ label: `${nominal}, ${mm(armLength)} мм`, params: { nominal, armLength } })),
  ),
  entry(
    'pp.elbow-90-thread',
    GENDERS.flatMap((threadGender) =>
      THREAD_ELBOWS.map(([pipeNominal, threadNominal, armLength]) => ({
        label: `${pipeNominal} × ${threadNominal}(${genderLabel(threadGender)})`,
        params: { threadGender, pipeNominal, threadNominal, armLength },
      })),
    ),
  ),
  entry(
    'pp.coupling',
    COUPLINGS.map(([nominalLeft, nominalRight, length]) => ({
      label: `${nominalLeft} × ${nominalRight}, ${mm(length)} мм`,
      params: { nominalLeft, nominalRight, length },
    })),
  ),
  entry(
    'pp.thread-adapter',
    GENDERS.flatMap((threadGender) =>
      THREAD_ADAPTERS.map(([pipeNominal, threadNominal, length]) => ({
        label: `${pipeNominal} × ${threadNominal}(${genderLabel(threadGender)})`,
        params: { threadGender, pipeNominal, threadNominal, length },
      })),
    ),
  ),
  entry(
    'pp.tee',
    TEES.map(([nominal, length]) => ({ label: `${nominal}, ${mm(length)} мм`, params: { nominal, length } })),
  ),
  entry(
    'pp.tee-reducing',
    REDUCING_TEES.map(([nominalLeft, nominalBranch, nominalRight, length, branchLength]) => ({
      label: `${nominalLeft} × ${nominalBranch} × ${nominalRight}`,
      params: { nominalLeft, nominalBranch, nominalRight, length, branchLength },
    })),
  ),
  entry(
    'pp.tee-thread',
    GENDERS.flatMap((threadGender) =>
      THREAD_TEES.map(([pipeNominal, threadNominal, length]) => ({
        label: `${pipeNominal} × ${threadNominal}(${genderLabel(threadGender)})`,
        params: { threadGender, pipeNominal, threadNominal, length },
      })),
    ),
  ),
  entry(
    'pp.cross',
    CROSSES.map(([nominal, size]) => ({ label: `${nominal}, ${mm(size)} мм`, params: { nominal, size } })),
  ),
  entry('pp.pipe', [
    ...PIPES.map((nominal) => ({ label: `ПП ${nominal}, 1 м`, params: { nominal, length: 1 } })),
    { label: 'ПП 20, 250 мм', params: { nominal: '20', length: 0.25 } },
  ]),
];
