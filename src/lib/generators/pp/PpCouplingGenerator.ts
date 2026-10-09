import { BaseGenerator } from '../../core/BaseGenerator';
import { connector } from '../../core/connector';
import { ConnectorFrame } from '../../core/ConnectorFrame';
import type { GeneratedModel, ParamSpec, ValidationError } from '../../core/contracts';
import { createMeshModel } from '../../core/MeshModel';
import { MaterialGroupMerger } from '../../geometry/MaterialGroupMerger';
import { sleeves } from '../../geometry/SleeveGeometryBuilder';
import { ParamSchema } from '../../params/ParamSchema';
import { specs } from '../../params/specs';
import { PpPipeSizes } from '../../sizes/PpPipeSizes';
import type { PartDiameters } from '../../sizes/ThreadSizes';

/** Параметры в формате cdm из gl2. */
export interface PpCouplingParams {
  /** Наружные диаметры ПП-труб слева и справа, мм, строкой. */
  r1: string;
  r2: string;
  /** Длина муфты, м. */
  m1: number;
}

/** Длина раструба — 0,3 наружного диаметра, не меньше 12 мм. */
const MIN_SOCKET_LENGTH = 0.012;

/** Раструбы слева и справа и их длины (x_1, x_2). */
interface CouplingLayout {
  d1: PartDiameters;
  d2: PartDiameters;
  x1: number;
  x2: number;
}

/** Полипропиленовая муфта под пайку, в том числе переходная (перенос pl_mufta_1). */
export class PpCouplingGenerator extends BaseGenerator<PpCouplingParams, CouplingLayout> {
  readonly id = 'pl_mufta_1';
  readonly title = 'Муфта ПП';
  readonly paramSpecs: readonly ParamSpec[] = [
    specs.ppNominal('r1', 'Труба слева, мм'),
    specs.ppNominal('r2', 'Труба справа, мм'),
    specs.length('m1', 'Длина'),
  ];

  protected override layout(params: PpCouplingParams): CouplingLayout {
    const d1 = PpPipeSizes.require(params.r1);
    const d2 = PpPipeSizes.require(params.r2);
    const socketLength = (d: PartDiameters) => Math.max(0.015 * d.n * 20, MIN_SOCKET_LENGTH);
    return { d1, d2, x1: socketLength(d1), x2: socketLength(d2) };
  }

  protected override relations(params: PpCouplingParams, { x1, x2 }: CouplingLayout): ValidationError[] {
    // Гладкий участок нулевой длины считается ошибкой, как у стальной муфты.
    const longest = Math.max(x1, x2);
    return params.m1 / 2 <= longest ? [ParamSchema.tooShort('m1', 2 * longest)] : [];
  }

  protected create(params: PpCouplingParams, { d1, d2, x1, x2 }: CouplingLayout): GeneratedModel {
    const x3L = params.m1 / 2 - x1;
    const x3R = params.m1 / 2 - x2;
    const left = { outerDiameter: d1.n, innerDiameter: d1.v };
    const right = { outerDiameter: d2.n, innerDiameter: d2.v };
    const at = (x: number) => ({ x, y: 0, z: 0 });

    const merger = new MaterialGroupMerger();
    merger.add(
      ...sleeves.build({ material: 'plastic', ...left, length: x1, center: at(-(x3L + x1 / 2)) }),
      ...sleeves.build({ material: 'plastic', ...left, length: x3L, center: at(-x3L / 2) }),
      // Центр: длина n/7, наружный — больший, внутренний — меньший диаметр
      ...sleeves.build({ material: 'plastic', length: Math.max(d1.n, d2.n) / 7, outerDiameter: Math.max(d1.n, d2.n), innerDiameter: Math.min(d1.v, d2.v) }),
      ...sleeves.build({ material: 'plastic', ...right, length: x3R, center: at(x3R / 2) }),
      ...sleeves.build({ material: 'plastic', ...right, length: x2, center: at(x3R + x2 / 2) }),
    );

    // Торцы — концы муфты (±m1/2), глубина — длина раструба. В gl2 точки — в центрах раструбов.
    const common = { joint: 'pp-socket', gender: 'internal' } as const;
    return createMeshModel({
      title: params.r1 === params.r2 ? `Муфта ${params.r1}` : `Муфта ${params.r1}х${params.r2}`,
      ...merger.merge(),
      connectors: [
        connector('left', ConnectorFrame.left, params.m1 / 2, { depth: x1, nominal: params.r1, ...common }),
        connector('right', ConnectorFrame.right, params.m1 / 2, { depth: x2, nominal: params.r2, ...common }),
      ],
    });
  }

  /** Вызывать только для известного номинала. */}
