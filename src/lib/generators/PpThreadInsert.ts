import type { SleeveMaterials } from '../geometry/SleeveGeometryBuilder';
import type { PartDiameters } from '../sizes/ThreadSizes';
import { ThreadSizes } from '../sizes/ThreadSizes';
import type { ThreadSideCode } from './SteelElbowGenerator';

/** Индексы материалов ПП-деталей с резьбой (white_1, white_1_edge, metal_1, rezba_1 в gl2). */
export const PP_THREAD_MATERIALS = { plastic: 0, plasticFlat: 1, metal: 2, thread: 3 } as const;

/** Выступ внутренней резьбовой вставки за торец пластикового корпуса, м. */
const INTERNAL_PROTRUSION = 0.0005;
/** Корпус вокруг вставки толще стенки трубы на 4 мм по диаметру. */
const BODY_EXTRA = 0.004;

/**
 * Металлическая резьбовая вставка ПП-детали (pl_ugol_90_rezba_1, pl_perehod_rezba_1,
 * pl_troinik_rezba_1): корпус из пластика с 12 гранями и латунная втулка с резьбой.
 * Внутренняя резьба — втулка в корпусе, выступает на 0,5 мм; наружная — втулка за корпусом.
 */
export class PpThreadInsert {
  readonly internal: boolean;
  /** Диаметры резьбовой втулки. */
  readonly thread: PartDiameters;
  /** Корпус: внутренний диаметр — наружный диаметр втулки. */
  readonly body: PartDiameters;
  /** Материалы втулки: резьба снаружи или внутри, остальное — металл. */
  readonly materials: Partial<SleeveMaterials>;

  /** pipe — диаметры ПП-раструба; вызывать только для известного номинала резьбы. */
  constructor(side: ThreadSideCode, nominal: string, pipe: PartDiameters) {
    const { metal, thread } = PP_THREAD_MATERIALS;
    this.internal = side === 'v';
    this.thread = ThreadSizes.diameters(nominal, this.internal ? 'internal' : 'external')!;
    const v = this.thread.n;
    this.body = { n: Math.max(v + (pipe.n - pipe.v) + BODY_EXTRA, pipe.n + BODY_EXTRA), v };
    this.materials = this.internal
      ? { outer: metal, inner: thread, start: metal, end: metal }
      : { outer: thread, inner: metal, start: metal, end: metal };
  }

  /** Центр втулки длиной length по центру корпуса той же длины. */
  insertCenter(bodyCenter: number, length: number): number {
    return this.internal ? bodyCenter + INTERNAL_PROTRUSION : bodyCenter + length;
  }

  /** Торец разъёма: край втулки по оси выхода, если корпус кончается в bodyEnd. */
  face(bodyEnd: number, length: number): number {
    return this.internal ? bodyEnd + INTERNAL_PROTRUSION : bodyEnd + length;
  }

  get gender(): 'internal' | 'external' {
    return this.internal ? 'internal' : 'external';
  }

  /** '(в)' или '(н)' для названия. */
  get suffix(): string {
    return this.internal ? '(в)' : '(н)';
  }
}
