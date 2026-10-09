import type { GeneratedModel, ModelGenerator, ParamSpec, ValidationError } from '../contracts';
import { GeneratorParamsError } from '../GeneratorParamsError';
import { ExtrudedShapeBuilder } from '../geometry/ExtrudedShapeBuilder';
import { MaterialGroupMerger } from '../geometry/MaterialGroupMerger';
import { SleeveGeometryBuilder } from '../geometry/SleeveGeometryBuilder';
import type { MaterialLibrary } from '../materials/MaterialLibrary';
import { ParamSchema } from '../params/ParamSchema';
import { ThreadSizes } from '../sizes/ThreadSizes';
import { BallValveParts, VALVE_BODY_STEP, VALVE_NUT_SCALE } from './BallValveParts';
import { ConnectorFrame } from './ConnectorFrame';
import { MeshModel } from './MeshModel';

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
export class BallValveUnionGenerator implements ModelGenerator<BallValveUnionParams> {
  readonly id = 'shar_kran_sgon_1';
  readonly title = 'Кран шаровой с полусгоном';
  readonly paramSpecs: readonly ParamSpec[] = [
    { kind: 'choice', key: 'r1', label: 'Резьба', options: ThreadSizes.nominals },
    { kind: 'choice', key: 'r2', label: 'Резьба гайки сгона', options: ThreadSizes.nominals },
    { kind: 'length', key: 'm1', label: 'Длина крана', min: 0.001, max: 0.3, step: 0.0005 },
    { kind: 'length', key: 'm2', label: 'Длина сгона', min: 0.001, max: 0.2, step: 0.0005 },
    { kind: 'length', key: 't1', label: 'Ручка', min: 0.01, max: 0.2, step: 0.001 },
  ];

  private readonly sleeves = new SleeveGeometryBuilder();
  private readonly parts = new BallValveParts(this.sleeves, new ExtrudedShapeBuilder());

  constructor(private readonly materials: MaterialLibrary) {}

  validate(params: BallValveUnionParams): ValidationError[] {
    const errors = ParamSchema.validate(this.paramSpecs, params);
    if (errors.length === 0) {
      // Правая часть корпуса (x_2R) и гладкий участок сгона (x_3R) были бы нулевой или отрицательной длины.
      const d = ThreadSizes.diameters(params.r1, 'internal')!;
      const minimum = 2 * (VALVE_BODY_STEP + BallValveParts.threadLength(d) + 0.01 * d.n * 20);
      if (params.m1 <= minimum) errors.push(ParamSchema.tooShort('m1', minimum));
      const union = BallValveParts.unionPipeLength(params.r1, params.m2);
      if (union <= 0) errors.push(ParamSchema.tooShort('m2', params.m2 - union));
    }
    return errors;
  }

  build(params: BallValveUnionParams): GeneratedModel {
    const errors = this.validate(params);
    if (errors.length > 0) throw new GeneratorParamsError(this.id, errors);
    const d1 = ThreadSizes.diameters(params.r1, 'internal')!;
    const d2 = ThreadSizes.diameters(params.r2, 'external')!;
    const half = params.m1 / 2;
    const x1 = BallValveParts.threadLength(d1);
    const x2 = 0.01 * d1.n * 20;
    const right = half - VALVE_BODY_STEP - x2 - x1;
    const at = (x: number) => ({ x, y: 0, z: 0 });
    // Сгон: гайка r2 на резьбе крана, со сдвигом на 0,1 её длины от начала резьбы.
    const union = this.parts.union(params.r2, params.r1, params.m2, VALVE_BODY_STEP + right + x1 * 0.1);

    const merger = new MaterialGroupMerger();
    merger.add(
      // Слева: гайка и внутренняя резьба
      ...this.sleeves.build({
        material: 'metal',
        length: x1,
        outerDiameter: d1.n * VALVE_NUT_SCALE,
        innerDiameter: d1.v + 0.001,
        outerSegments: 6,
        center: at(-(half - x1 / 2)),
        materials: { outer: 'metalFlat' },
      }),
      ...this.sleeves.build({ material: 'metal', length: x1, outerDiameter: d1.n, innerDiameter: d1.v, center: at(-(half - x1 / 2)), materials: { inner: 'thread' } }),
      ...this.parts.body(d1, half - x1, right),
      ...this.parts.stemAndHandle(d1, params.t1),
      // Справа: наружная резьба крана под гайкой сгона
      ...this.sleeves.build({ material: 'metal', length: x1, outerDiameter: d2.n, innerDiameter: d2.v, center: at(VALVE_BODY_STEP + right + x1 / 2), materials: { outer: 'thread' } }),
      ...union.parts,
    );

    // Слева — торец крана, глубина — резьба. Справа — конец резьбы сгона, глубина — вся его резьба.
    // В gl2 точки стояли в центрах резьбы крана и концевой резьбы сгона.
    const common = { nominal: params.r1, joint: 'thread' } as const;
    return MeshModel.create({
      title: `Шаровой кран с полусгоном ${params.r1}`,
      ...merger.merge(),
      connectors: [
        { id: 'left', position: at(-half), ...ConnectorFrame.left, depth: x1, gender: 'internal', ...common },
        { id: 'right', position: at(union.end), ...ConnectorFrame.right, depth: union.threadLength, gender: 'external', ...common },
      ],
    }, this.materials);
  }
}
