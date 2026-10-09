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

export interface PpCouplingParams {
  /** Наружные диаметры ПП-труб слева и справа, мм, строкой. */
  nominalLeft: string;
  nominalRight: string;
  /** Длина муфты, м. */
  length: number;
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
  readonly id = 'pp.coupling';
  readonly version = 1;
  readonly title = 'Муфта ПП';
  readonly paramSpecs: readonly ParamSpec[] = [
    specs.ppNominal('nominalLeft', 'Труба слева, мм'),
    specs.ppNominal('nominalRight', 'Труба справа, мм'),
    specs.length('length', 'Длина'),
  ];
  readonly defaults: PpCouplingParams = { nominalLeft: '25', nominalRight: '20', length: 0.039 };

  protected override layout(params: PpCouplingParams): CouplingLayout {
    const d1 = PpPipeSizes.require(params.nominalLeft);
    const d2 = PpPipeSizes.require(params.nominalRight);
    const socketLength = (d: PartDiameters) => Math.max(0.015 * d.n * 20, MIN_SOCKET_LENGTH);
    return { d1, d2, x1: socketLength(d1), x2: socketLength(d2) };
  }

  protected override relations(params: PpCouplingParams, { x1, x2 }: CouplingLayout): ValidationError[] {
    // Гладкий участок нулевой длины считается ошибкой, как у стальной муфты.
    const longest = Math.max(x1, x2);
    return params.length / 2 <= longest ? [ParamSchema.tooShort('length', 2 * longest)] : [];
  }

  protected create(params: PpCouplingParams, { d1, d2, x1, x2 }: CouplingLayout): GeneratedModel {
    const x3L = params.length / 2 - x1;
    const x3R = params.length / 2 - x2;
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

    // Торцы — концы муфты (±length/2), глубина — длина раструба. В gl2 точки — в центрах раструбов.
    const common = { joint: 'pp-socket', gender: 'internal' } as const;
    return createMeshModel({
      title: params.nominalLeft === params.nominalRight ? `Муфта ${params.nominalLeft}` : `Муфта ${params.nominalLeft}х${params.nominalRight}`,
      ...merger.merge(),
      connectors: [
        connector('left', ConnectorFrame.left, params.length / 2, { depth: x1, nominal: params.nominalLeft, ...common }),
        connector('right', ConnectorFrame.right, params.length / 2, { depth: x2, nominal: params.nominalRight, ...common }),
      ],
    });
  }

  /** Вызывать только для известного номинала. */}
