import type { ThreadGender } from '../../core/contracts';
import type { SleeveMaterials } from '../../geometry/SleeveGeometryBuilder';
import { ThreadSizes } from '../../sizes/ThreadSizes';
import type { PartDiameters } from '../../sizes/ThreadSizes';

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
  /** Материалы втулки (material: 'metal'): резьба снаружи или внутри. */
  readonly materials: Partial<SleeveMaterials>;

  /** pipe — диаметры ПП-раструба; вызывать только для известного номинала резьбы. */
  constructor(gender: ThreadGender, nominal: string, pipe: PartDiameters) {
    this.internal = gender === 'internal';
    this.thread = ThreadSizes.require(nominal, gender);
    const v = this.thread.n;
    this.body = { n: Math.max(v + (pipe.n - pipe.v) + BODY_EXTRA, pipe.n + BODY_EXTRA), v };
    this.materials = this.internal
      ? { inner: 'thread' }
      : { outer: 'thread' };
  }

  /** Центр втулки длиной length по центру корпуса той же длины. */
  insertCenter(bodyCenter: number, length: number): number {
    return this.internal ? bodyCenter + INTERNAL_PROTRUSION : bodyCenter + length;
  }

  /** Торец разъёма: край втулки по оси выхода, если корпус кончается в bodyEnd. */
  face(bodyEnd: number, length: number): number {
    return this.internal ? bodyEnd + INTERNAL_PROTRUSION : bodyEnd + length;
  }

  get gender(): ThreadGender {
    return this.internal ? 'internal' : 'external';
  }

  /** '(в)' или '(н)' для названия. */
  get suffix(): string {
    return this.internal ? '(в)' : '(н)';
  }
}
