import { BaseGenerator } from '../../core/BaseGenerator';
import { connector } from '../../core/connector';
import { ConnectorFrame } from '../../core/ConnectorFrame';
import type { Connector, GeneratedModel, ParamSpec, ValidationError } from '../../core/contracts';
import { createMeshModel } from '../../core/MeshModel';
import { MaterialGroupMerger } from '../../geometry/MaterialGroupMerger';
import type { GeometryPart } from '../../geometry/MaterialGroupMerger';
import { sleeves } from '../../geometry/SleeveGeometryBuilder';
import type { SleeveShape } from '../../geometry/SleeveGeometryBuilder';
import { ParamSchema } from '../../params/ParamSchema';
import { specs } from '../../params/specs';
import { ThreadSizes } from '../../sizes/ThreadSizes';
import type { PartDiameters } from '../../sizes/ThreadSizes';
import { BallValveParts, VALVE_BODY_STEP, VALVE_NUT_SCALE } from './BallValveParts';

/** Концы крана: в-в, н-н, в-н (shar_kran_v_1, shar_kran_n_1, shar_kran_v_n_1). */
export type BallValveEnds = 'v' | 'n' | 'v_n';

/** Параметры в формате cdm из gl2. */
export interface BallValveParams {
  /** Дюймовый номинал резьбы обоих концов, например '1/2'. */
  r1: string;
  /** Длина крана, м. */
  m1: number;
  /** Длина ручки-бабочки, м. */
  t1: number;
}

const VARIANTS: Record<BallValveEnds, { id: string; title: string; suffix: string; right: 'internal' | 'external' }> = {
  v: { id: 'shar_kran_v_1', title: 'Кран шаровой (в-в)', suffix: '(в-в)', right: 'internal' },
  n: { id: 'shar_kran_n_1', title: 'Кран шаровой (н-н)', suffix: '(н-н)', right: 'external' },
  v_n: { id: 'shar_kran_v_n_1', title: 'Кран шаровой (в-н)', suffix: '(в-н)', right: 'external' },
};

/**
 * Шаровой кран с резьбой на обоих концах (перенос shar_kran_v_1, shar_kran_n_1, shar_kran_v_n_1).
 * Один класс на три функции gl2: они отличаются только концами. Внутренняя резьба — под
 * шестигранной гайкой той же длины, наружная — снаружи, за гайкой длиной 0,2 n.
 * Шток и ручка — вверх (+Y), часть общего меша.
 */
export class BallValveGenerator extends BaseGenerator<BallValveParams, PartDiameters> {
  readonly id: string;
  readonly title: string;
  readonly paramSpecs: readonly ParamSpec[] = [
    specs.threadNominal('r1', 'Резьба'),
    specs.length('m1', 'Длина', { max: 0.3 }),
    specs.length('t1', 'Ручка', { min: 0.01, step: 0.001 }),
  ];

  private readonly parts = new BallValveParts();

  constructor(private readonly ends: BallValveEnds) {
    super();
    this.id = VARIANTS[ends].id;
    this.title = VARIANTS[ends].title;
  }

  /** Диаметры корпуса: у крана н-н — по наружной резьбе, иначе по внутренней. */
  protected override layout(params: BallValveParams): PartDiameters {
    return ThreadSizes.require(params.r1, this.ends === 'n' ? 'external' : 'internal');
  }

  protected override relations(params: BallValveParams, d: PartDiameters): ValidationError[] {
    // Правая часть корпуса (x_2R в gl2) была бы нулевой или отрицательной длины.
    const minimum = 2 * (VALVE_BODY_STEP + this.endLength(d, VARIANTS[this.ends].right));
    return params.m1 <= minimum ? [ParamSchema.tooShort('m1', minimum)] : [];
  }

  protected create(params: BallValveParams, d: PartDiameters): GeneratedModel {
    const variant = VARIANTS[this.ends];
    const left = this.ends === 'n' ? 'external' : 'internal';
    const half = params.m1 / 2;
    const x1 = BallValveParts.threadLength(d);

    const merger = new MaterialGroupMerger();
    merger.add(
      ...this.end(params.r1, d, left, -1, half),
      ...this.parts.body(d, half - this.endLength(d, left), half - VALVE_BODY_STEP - this.endLength(d, variant.right)),
      ...this.parts.stemAndHandle(d, params.t1),
      ...this.end(params.r1, d, variant.right, 1, half),
    );

    // Торцы — концы крана (±m1/2), глубина — длина резьбы. В gl2 точки — в центрах резьбы.
    const common = { depth: x1, nominal: params.r1, joint: 'thread' } as const;
    const connectors: Connector[] = [
      connector('left', ConnectorFrame.left, half, { gender: left, ...common }),
      connector('right', ConnectorFrame.right, half, { gender: variant.right, ...common }),
    ];
    return createMeshModel({
      title: `Шаровой кран ${params.r1}${variant.suffix}`,
      ...merger.merge(),
      connectors,
    });
  }

  /** Длина конца от торца до корпуса: резьба, у наружной — ещё гайка 0,2 n. */
  private endLength(d: PartDiameters, gender: 'internal' | 'external'): number {
    return BallValveParts.threadLength(d) + (gender === 'external' ? 0.01 * d.n * 20 : 0);
  }

  /** Конец крана со стороны side (−1 — слева, 1 — справа); гайка — по диаметрам корпуса d. */
  private end(nominal: string, d: PartDiameters, gender: 'internal' | 'external', side: number, half: number): GeometryPart[] {
    const x1 = BallValveParts.threadLength(d);
    const at = (x: number) => ({ x: side * x, y: 0, z: 0 });
    const nut = { outerDiameter: d.n * VALVE_NUT_SCALE, innerDiameter: d.v + 0.001, outerSegments: 6, materials: { outer: 'metalFlat' } } satisfies Partial<SleeveShape>;

    if (gender === 'internal') {
      return [
        ...sleeves.build({ material: 'metal', ...nut, length: x1, center: at(half - x1 / 2) }),
        ...sleeves.build({ material: 'metal', length: x1, outerDiameter: d.n, innerDiameter: d.v, center: at(half - x1 / 2), materials: { inner: 'thread' } }),
      ];
    }
    const x2 = 0.01 * d.n * 20;
    const external = ThreadSizes.require(nominal, 'external');
    return [
      ...sleeves.build({ material: 'metal', length: x1, outerDiameter: external.n, innerDiameter: external.v, center: at(half - x1 / 2), materials: { outer: 'thread' } }),
      ...sleeves.build({ material: 'metal', ...nut, length: x2, center: at(half - x1 - x2 / 2) }),
    ];
  }
}
