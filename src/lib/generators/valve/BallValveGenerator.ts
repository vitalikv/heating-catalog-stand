import { BaseGenerator } from '../../core/BaseGenerator';
import { connector } from '../../core/connector';
import { ConnectorFrame } from '../../core/ConnectorFrame';
import type { Connector, GeneratedModel, ParamSpec, ThreadGender, ValidationError } from '../../core/contracts';
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

/** Резьба концов крана: обе внутренние, обе наружные, слева внутренняя и справа наружная. */
export type BallValveEnds = 'internal' | 'external' | 'internal-external';

export interface BallValveParams {
  ends: BallValveEnds;
  /** Дюймовый номинал резьбы обоих концов, например '1/2'. */
  nominal: string;
  /** Длина крана, м. */
  length: number;
  /** Длина ручки-бабочки, м. */
  handleLength: number;
}

/** Концы слева и справа и суффикс названия. */
const ENDS: Record<BallValveEnds, { left: ThreadGender; right: ThreadGender; suffix: string }> = {
  internal: { left: 'internal', right: 'internal', suffix: '(в-в)' },
  external: { left: 'external', right: 'external', suffix: '(н-н)' },
  'internal-external': { left: 'internal', right: 'external', suffix: '(в-н)' },
};

/**
 * Шаровой кран с резьбой на обоих концах (перенос shar_kran_v_1, shar_kran_n_1, shar_kran_v_n_1).
 * Три функции gl2 отличаются только концами — здесь это параметр ends. Внутренняя резьба — под
 * шестигранной гайкой той же длины, наружная — снаружи, за гайкой длиной 0,2 n.
 * Шток и ручка — вверх (+Y), часть общего меша.
 */
export class BallValveGenerator extends BaseGenerator<BallValveParams, PartDiameters> {
  readonly id = 'valve.ball';
  readonly version = 1;
  readonly title = 'Кран шаровой';
  readonly paramSpecs: readonly ParamSpec[] = [
    {
      kind: 'choice',
      key: 'ends',
      label: 'Концы',
      options: ['internal', 'external', 'internal-external'],
      optionLabels: { internal: 'в-в', external: 'н-н', 'internal-external': 'в-н' },
    },
    specs.threadNominal('nominal', 'Резьба'),
    specs.length('length', 'Длина', { max: 0.3 }),
    specs.length('handleLength', 'Ручка', { min: 0.01, step: 0.001 }),
  ];
  readonly defaults: BallValveParams = { ends: 'external', nominal: '1/2', length: 0.063, handleLength: 0.053 };

  private readonly parts = new BallValveParts();

  /** Диаметры корпуса: у крана н-н — по наружной резьбе, иначе по внутренней. */
  protected override layout(params: BallValveParams): PartDiameters {
    return ThreadSizes.require(params.nominal, ENDS[params.ends].left);
  }

  protected override relations(params: BallValveParams, d: PartDiameters): ValidationError[] {
    // Правая часть корпуса (x_2R в gl2) была бы нулевой или отрицательной длины.
    const minimum = 2 * (VALVE_BODY_STEP + this.endLength(d, ENDS[params.ends].right));
    return params.length <= minimum ? [ParamSchema.tooShort('length', minimum)] : [];
  }

  protected create(params: BallValveParams, d: PartDiameters): GeneratedModel {
    const variant = ENDS[params.ends];
    const left = variant.left;
    const half = params.length / 2;
    const x1 = BallValveParts.threadLength(d);

    const merger = new MaterialGroupMerger();
    merger.add(
      ...this.end(params.nominal, d, left, -1, half),
      ...this.parts.body(d, half - this.endLength(d, left), half - VALVE_BODY_STEP - this.endLength(d, variant.right)),
      ...this.parts.stemAndHandle(d, params.handleLength),
      ...this.end(params.nominal, d, variant.right, 1, half),
    );

    // Торцы — концы крана (±length/2), глубина — длина резьбы. В gl2 точки — в центрах резьбы.
    const common = { depth: x1, nominal: params.nominal, joint: 'thread' } as const;
    const connectors: Connector[] = [
      connector('left', ConnectorFrame.left, half, { gender: left, ...common }),
      connector('right', ConnectorFrame.right, half, { gender: variant.right, ...common }),
    ];
    return createMeshModel({
      title: `Шаровой кран ${params.nominal}${variant.suffix}`,
      ...merger.merge(),
      connectors,
    });
  }

  /** Длина конца от торца до корпуса: резьба, у наружной — ещё гайка 0,2 n. */
  private endLength(d: PartDiameters, gender: ThreadGender): number {
    return BallValveParts.threadLength(d) + (gender === 'external' ? 0.01 * d.n * 20 : 0);
  }

  /** Конец крана со стороны side (−1 — слева, 1 — справа); гайка — по диаметрам корпуса d. */
  private end(nominal: string, d: PartDiameters, gender: ThreadGender, side: number, half: number): GeometryPart[] {
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
