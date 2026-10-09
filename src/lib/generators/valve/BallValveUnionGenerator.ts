import { BaseGenerator } from '../../core/BaseGenerator';
import { connector } from '../../core/connector';
import { ConnectorFrame } from '../../core/ConnectorFrame';
import type { GeneratedModel, ParamSpec, ValidationError } from '../../core/contracts';
import { createMeshModel } from '../../core/MeshModel';
import { MaterialGroupMerger } from '../../geometry/MaterialGroupMerger';
import { sleeves } from '../../geometry/SleeveGeometryBuilder';
import { ParamSchema } from '../../params/ParamSchema';
import { specs } from '../../params/specs';
import { ThreadSizes } from '../../sizes/ThreadSizes';
import { BallValveParts, VALVE_BODY_STEP, VALVE_NUT_SCALE } from './BallValveParts';
import type { UnionValveLayout } from './BallValveParts';

/** Параметры в формате cdm из gl2. */
export interface BallValveUnionParams {
  /** Номинал внутренней резьбы слева и наружной резьбы сгона, например '1/2'. */
  r1: string;
  /** Номинал наружной резьбы справа на кране и накидной гайки сгона, например '3/4'. */
  r2: string;
  /** Длина крана без сгона, м. */
  m1: number;
  /** Длина сгона, м. */
  m2: number;
  /** Длина ручки-бабочки, м. */
  t1: number;
}

/**
 * Шаровой кран с полусгоном (перенос shar_kran_sgon_1): слева внутренняя резьба r1,
 * справа наружная резьба r2, на неё навёрнут сгон с наружной резьбой r1 на конце.
 */
export class BallValveUnionGenerator extends BaseGenerator<BallValveUnionParams, UnionValveLayout> {
  readonly id = 'shar_kran_sgon_1';
  readonly title = 'Кран шаровой с полусгоном';
  readonly paramSpecs: readonly ParamSpec[] = [
    specs.threadNominal('r1', 'Резьба'),
    specs.threadNominal('r2', 'Резьба гайки сгона'),
    specs.length('m1', 'Длина крана', { max: 0.3 }),
    specs.length('m2', 'Длина сгона'),
    specs.length('t1', 'Ручка', { min: 0.01, step: 0.001 }),
  ];

  private readonly parts = new BallValveParts();

  protected override layout(params: BallValveUnionParams): UnionValveLayout {
    const d1 = ThreadSizes.require(params.r1, 'internal');
    return { d1, d2: ThreadSizes.require(params.r2, 'external'), x1: BallValveParts.threadLength(d1) };
  }

  protected override relations(params: BallValveUnionParams, { d1, x1 }: UnionValveLayout): ValidationError[] {
    const errors: ValidationError[] = [];
    // Правая часть корпуса (x_2R) и гладкий участок сгона (x_3R) были бы нулевой или отрицательной длины.
    const minimum = 2 * (VALVE_BODY_STEP + x1 + 0.01 * d1.n * 20);
    if (params.m1 <= minimum) errors.push(ParamSchema.tooShort('m1', minimum));
    const union = BallValveParts.unionPipeLength(params.r1, params.m2);
    if (union <= 0) errors.push(ParamSchema.tooShort('m2', params.m2 - union));
    return errors;
  }

  protected create(params: BallValveUnionParams, { d1, d2, x1 }: UnionValveLayout): GeneratedModel {
    const half = params.m1 / 2;
    const x2 = 0.01 * d1.n * 20;
    const right = half - VALVE_BODY_STEP - x2 - x1;
    const at = (x: number) => ({ x, y: 0, z: 0 });
    // Сгон: гайка r2 на резьбе крана, со сдвигом на 0,1 её длины от начала резьбы.
    const union = this.parts.union(params.r2, params.r1, params.m2, VALVE_BODY_STEP + right + x1 * 0.1);

    const merger = new MaterialGroupMerger();
    merger.add(
      // Слева: гайка и внутренняя резьба
      ...sleeves.build({
        material: 'metal',
        length: x1,
        outerDiameter: d1.n * VALVE_NUT_SCALE,
        innerDiameter: d1.v + 0.001,
        outerSegments: 6,
        center: at(-(half - x1 / 2)),
        materials: { outer: 'metalFlat' },
      }),
      ...sleeves.build({ material: 'metal', length: x1, outerDiameter: d1.n, innerDiameter: d1.v, center: at(-(half - x1 / 2)), materials: { inner: 'thread' } }),
      ...this.parts.body(d1, half - x1, right),
      ...this.parts.stemAndHandle(d1, params.t1),
      // Справа: наружная резьба крана под гайкой сгона
      ...sleeves.build({ material: 'metal', length: x1, outerDiameter: d2.n, innerDiameter: d2.v, center: at(VALVE_BODY_STEP + right + x1 / 2), materials: { outer: 'thread' } }),
      ...union.parts,
    );

    // Слева — торец крана, глубина — резьба. Справа — конец резьбы сгона, глубина — вся его резьба.
    // В gl2 точки стояли в центрах резьбы крана и концевой резьбы сгона.
    const common = { nominal: params.r1, joint: 'thread' } as const;
    return createMeshModel({
      title: `Шаровой кран с полусгоном ${params.r1}`,
      ...merger.merge(),
      connectors: [
        connector('left', ConnectorFrame.left, half, { depth: x1, gender: 'internal', ...common }),
        connector('right', ConnectorFrame.right, union.end, { depth: union.threadLength, gender: 'external', ...common }),
      ],
    });
  }
}
