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

/**
 * Версия 2 по VALTEC Base, технический каталог 2017, с. 272: сгон и ручка — как у позиций gl2 (VT.227).
 * VT.226 (наружная резьба крана): длина подобрана под общую длину В (83 и 90 мм).
 * [nominal, unionNominal, length, unionLength, handleLength].
 */
const BALL_VALVE_UNIONS_EXTERNAL: [string, string, number, number, number][] = [
  ['1/2', '3/4', 0.0633, 0.026, 0.053],
  ['3/4', '1', 0.0648, 0.03, 0.053],
];

/**
 * VT.228 (угловой): длина — под размер В (71, 86, 102 мм) от левой стенки корпуса до конца сгона,
 * inletLength — Г (31; 35,5; 42 мм). [nominal, unionNominal, length, unionLength, handleLength, inletLength].
 */
const BALL_VALVE_UNIONS_ANGLE: [string, string, number, number, number, number][] = [
  ['1/2', '3/4', 0.0664, 0.026, 0.053, 0.031],
  ['3/4', '1', 0.0797, 0.03, 0.053, 0.0355],
  ['1', '1 1/4', 0.0892, 0.037, 0.06, 0.042],
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
    // Версия 2 (часть 23), технический каталог 2017: VT.808 (с. 310) — длина A, ручка C = 69 мм;
    // VT.247 (с. 301) — длина B, рычаг C от оси штока (C − B/2), гнездо датчика M10×1.
    ...([['1/2', 0.0475], ['3/4', 0.0555]] as const).map(([nominal, length]) => ({
      label: `${nominal}(в-в) с термометром (VT.808)`,
      params: { ends: 'internal' as const, nominal, length, handleLength: 0.045, handle: 'thermometer' as const },
    })),
    ...([['1/2', 0.047, 0.0905], ['3/4', 0.057, 0.0885], ['1', 0.067, 0.1045]] as const).map(([nominal, length, handleLength]) => ({
      label: `${nominal}(в-в) с гнездом датчика M10×1 (VT.247)`,
      params: { ends: 'internal' as const, nominal, length, handleLength, handle: 'lever' as const, sensorPort: 'M10x1' as const },
    })),
  ]),
  entry(
    'valve.ball-union',
    BALL_VALVE_UNIONS.map(([nominal, unionNominal, length, unionLength, handleLength]) => ({
      label: `${nominal} × ${unionNominal}`,
      params: { nominal, unionNominal, length, unionLength, handleLength },
    })).concat(
      BALL_VALVE_UNIONS_EXTERNAL.map(([nominal, unionNominal, length, unionLength, handleLength]) => ({
        label: `${nominal}(н) × ${unionNominal}, VT.226`,
        params: { nominal, unionNominal, length, unionLength, handleLength, valveEnd: 'external' as const },
      })),
      BALL_VALVE_UNIONS_ANGLE.map(([nominal, unionNominal, length, unionLength, handleLength, inletLength]) => ({
        label: `угловой ${nominal} × ${unionNominal}, VT.228`,
        params: { nominal, unionNominal, length, unionLength, handleLength, configuration: 'angle' as const, inletLength },
      })),
    ),
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
