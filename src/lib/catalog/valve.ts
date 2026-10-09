import type { BallValveEnds } from '../generators/valve/BallValveGenerator';
import { entry, mm } from './entry';
import type { CatalogEntry } from './entry';

// Позиции — наборы gl2/createObj/start.js.

/** Краны н-н и в-н: [nominal, length, handleLength]. */
const BALL_VALVES_LONG: [string, number, number][] = [
  ['1/2', 0.063, 0.053],
  ['3/4', 0.07, 0.053],
  ['1', 0.076, 0.06],
  ['1 1/4', 0.085, 0.064],
  ['1 1/2', 0.096, 0.07],
  ['2', 0.111, 0.07],
];

/** Краны в-в: [nominal, length, handleLength]. */
const BALL_VALVES_INTERNAL: [string, number, number][] = [
  ['1/2', 0.0475, 0.053],
  ['3/4', 0.0555, 0.053],
  ['1', 0.0625, 0.06],
  ['1 1/4', 0.0775, 0.064],
  ['1 1/2', 0.087, 0.07],
  ['2', 0.101, 0.07],
];

/** Краны с полусгоном: [nominal, unionNominal, length, unionLength, handleLength]. */
const BALL_VALVE_UNIONS: [string, string, number, number, number][] = [
  ['1/2', '3/4', 0.055, 0.026, 0.053],
  ['3/4', '1', 0.059, 0.03, 0.053],
  ['1', '1 1/4', 0.065, 0.037, 0.06],
  ['1 1/4', '1 1/2', 0.075, 0.045, 0.06],
];

/** Регулирующие краны: [nominal, unionNominal, length, unionLength]; каждый — с колпачком и с терморегулятором. */
const REGULATING_VALVES: [string, string, number, number][] = [
  ['1/2', '3/4', 0.055, 0.02],
  ['3/4', '1', 0.059, 0.022],
];

/** Вид концов — в подписи: позиции разных концов идут одним списком. */
const ballValves = (ends: BallValveEnds, rows: [string, number, number][], endsLabel: string) =>
  rows.map(([nominal, length, handleLength]) => ({
    label: `${nominal}${endsLabel}, ${mm(length)} мм`,
    params: { ends, nominal, length, handleLength },
  }));

export const VALVE_CATALOG: CatalogEntry[] = [
  entry('valve.ball', [
    ...ballValves('external', BALL_VALVES_LONG, '(н-н)'),
    ...ballValves('internal', BALL_VALVES_INTERNAL, '(в-в)'),
    ...ballValves('internal-external', BALL_VALVES_LONG, '(в-н)'),
  ]),
  entry(
    'valve.ball-union',
    BALL_VALVE_UNIONS.map(([nominal, unionNominal, length, unionLength, handleLength]) => ({
      label: `${nominal} × ${unionNominal}`,
      params: { nominal, unionNominal, length, unionLength, handleLength },
    })),
  ),
  entry(
    'valve.regulating',
    (['cap', 'thermostatic'] as const).flatMap((head) =>
      REGULATING_VALVES.map(([nominal, unionNominal, length, unionLength]) => ({
        label: `${nominal} × ${unionNominal}, ${head === 'thermostatic' ? 'терморегулятор' : 'колпачок'}`,
        params: { nominal, unionNominal, length, unionLength, head },
      })),
    ),
  ),
];
