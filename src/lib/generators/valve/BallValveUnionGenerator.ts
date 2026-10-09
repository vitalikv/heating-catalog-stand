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

export interface BallValveUnionParams {
  /** Номинал внутренней резьбы слева и наружной резьбы сгона, например '1/2'. */
  nominal: string;
  /** Номинал наружной резьбы справа на кране и накидной гайки сгона, например '3/4'. */
  unionNominal: string;
  /** Длина крана без сгона, м. */
  length: number;
  /** Длина сгона, м. */
  unionLength: number;
  /** Длина ручки-бабочки, м. */
  handleLength: number;
}

/**
 * Шаровой кран с полусгоном (перенос shar_kran_sgon_1): слева внутренняя резьба nominal,
 * справа наружная резьба unionNominal, на неё навёрнут сгон с наружной резьбой nominal на конце.
 */
export class BallValveUnionGenerator extends BaseGenerator<BallValveUnionParams, UnionValveLayout> {
  readonly id = 'valve.ball-union';
  readonly version = 1;
  readonly title = 'Кран шаровой с полусгоном';
  readonly paramSpecs: readonly ParamSpec[] = [
    specs.threadNominal('nominal', 'Резьба'),
    specs.threadNominal('unionNominal', 'Резьба гайки сгона'),
    specs.length('length', 'Длина крана', { max: 0.3 }),
    specs.length('unionLength', 'Длина сгона'),
    specs.length('handleLength', 'Ручка', { min: 0.01, step: 0.001 }),
  ];
  readonly defaults: BallValveUnionParams = {
    nominal: '1/2',
    unionNominal: '3/4',
    length: 0.055,
    unionLength: 0.026,
    handleLength: 0.053,
  };

  private readonly parts = new BallValveParts();

  protected override layout(params: BallValveUnionParams): UnionValveLayout {
    const d1 = ThreadSizes.require(params.nominal, 'internal');
    return { d1, d2: ThreadSizes.require(params.unionNominal, 'external'), x1: BallValveParts.threadLength(d1) };
  }

  protected override relations(params: BallValveUnionParams, { d1, x1 }: UnionValveLayout): ValidationError[] {
    const errors: ValidationError[] = [];
    // Правая часть корпуса (x_2R) и гладкий участок сгона (x_3R) были бы нулевой или отрицательной длины.
    const minimum = 2 * (VALVE_BODY_STEP + x1 + 0.01 * d1.n * 20);
    if (params.length <= minimum) errors.push(ParamSchema.tooShort('length', minimum));
    const union = BallValveParts.unionPipeLength(params.nominal, params.unionLength);
    if (union <= 0) errors.push(ParamSchema.tooShort('unionLength', params.unionLength - union));
    return errors;
  }

  protected create(params: BallValveUnionParams, { d1, d2, x1 }: UnionValveLayout): GeneratedModel {
    const half = params.length / 2;
    const x2 = 0.01 * d1.n * 20;
    const right = half - VALVE_BODY_STEP - x2 - x1;
    const at = (x: number) => ({ x, y: 0, z: 0 });
    // Сгон: гайка unionNominal на резьбе крана, со сдвигом на 0,1 её длины от начала резьбы.
    const union = this.parts.union(params.unionNominal, params.nominal, params.unionLength, VALVE_BODY_STEP + right + x1 * 0.1);

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
      ...this.parts.stemAndHandle(d1, params.handleLength),
      // Справа: наружная резьба крана под гайкой сгона
      ...sleeves.build({ material: 'metal', length: x1, outerDiameter: d2.n, innerDiameter: d2.v, center: at(VALVE_BODY_STEP + right + x1 / 2), materials: { outer: 'thread' } }),
      ...union.parts,
    );

    // Слева — торец крана, глубина — резьба. Справа — конец резьбы сгона, глубина — вся его резьба.
    // В gl2 точки стояли в центрах резьбы крана и концевой резьбы сгона.
    const common = { nominal: params.nominal, joint: 'thread' } as const;
    return createMeshModel({
      title: `Шаровой кран с полусгоном ${params.nominal}`,
      ...merger.merge(),
      connectors: [
        connector('left', ConnectorFrame.left, half, { depth: x1, gender: 'internal', ...common }),
        connector('right', ConnectorFrame.right, union.end, { depth: union.threadLength, gender: 'external', ...common }),
      ],
    });
  }
}
