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
export interface PpReducingTeeParams {
  /** Наружные диаметры ПП-труб: слева, отвод, справа; мм, строкой. */
  r1: string;
  r2: string;
  r3: string;
  /** Длина прохода, м. */
  m1: number;
  /** Высота отвода над наружной стенкой прохода (до торца — m2 + dc/2), м. */
  m2: number;
}

/** Длина раструба (x_1 в gl2), м. */
const SOCKET_LENGTH = 0.02;

/** Раструбы слева, отвода и справа; dc — наибольший, к нему сходятся конусы. */
interface ReducingTeeLayout {
  d1: PartDiameters;
  d2: PartDiameters;
  d3: PartDiameters;
  dc: PartDiameters;
}

/**
 * Полипропиленовый переходной тройник (перенос pl_troinik_2): раструбы своих диаметров,
 * между ними конусы от наибольшего диаметра.
 */
export class PpReducingTeeGenerator extends BaseGenerator<PpReducingTeeParams, ReducingTeeLayout> {
  readonly id = 'pl_troinik_2';
  readonly title = 'Тройник ПП переходной';
  readonly paramSpecs: readonly ParamSpec[] = [
    specs.ppNominal('r1', 'Слева, мм'),
    specs.ppNominal('r2', 'Отвод, мм'),
    specs.ppNominal('r3', 'Справа, мм'),
    specs.length('m1', 'Длина прохода', { max: 0.3 }),
    specs.length('m2', 'Высота отвода'),
  ];

  protected override layout(params: PpReducingTeeParams): ReducingTeeLayout {
    const [d1, d2, d3] = [params.r1, params.r2, params.r3].map((r) => PpPipeSizes.require(r));
    return { d1, d2, d3, dc: [d1, d2, d3].reduce((max, d) => (d.n > max.n ? d : max)) };
  }

  protected override relations(params: PpReducingTeeParams, { dc }: ReducingTeeLayout): ValidationError[] {
    const errors: ValidationError[] = [];
    // Конусы между раструбами (x_2, x_3 в gl2) были бы нулевой или отрицательной длины.
    if (params.m1 <= 2 * SOCKET_LENGTH) errors.push(ParamSchema.tooShort('m1', 2 * SOCKET_LENGTH));
    if (params.m2 + dc.n / 2 <= SOCKET_LENGTH) errors.push(ParamSchema.tooShort('m2', SOCKET_LENGTH - dc.n / 2));
    return errors;
  }

  protected create(params: PpReducingTeeParams, { d1, d2, d3, dc }: ReducingTeeLayout): GeneratedModel {
    const x1 = SOCKET_LENGTH;
    const x2 = params.m1 - 2 * x1;
    const height = params.m2 + dc.n / 2;
    const x3 = height - x1;
    const size = (d: PartDiameters) => ({ outerDiameter: d.n, innerDiameter: d.v });
    const cone = (d: PartDiameters) => ({ outerDiameter: dc.n, innerDiameter: dc.v, outerDiameterStart: d.n, innerDiameterStart: d.v });
    const at = (x: number) => ({ x, y: 0, z: 0 });

    const merger = new MaterialGroupMerger();
    merger.add(
      ...sleeves.build({ material: 'plastic', ...size(d1), length: x1, center: at(-(x2 + x1) / 2) }),
      ...sleeves.build({ material: 'plastic', ...cone(d1), length: x2 / 2, center: at(-x2 / 4) }),
      ...sleeves.build({ material: 'plastic', ...cone(d3), length: x2 / 2, center: at(x2 / 4), rotation: { x: 0, y: Math.PI, z: 0 } }),
      ...sleeves.build({ material: 'plastic', ...size(d3), length: x1, center: at((x2 + x1) / 2) }),
      ...sleeves.build({ material: 'plastic', ...cone(d2), length: x3, center: { x: 0, y: x3 / 2, z: 0 }, rotation: { x: 0, y: 0, z: -Math.PI / 2 } }),
      ...sleeves.build({ material: 'plastic', ...size(d2), length: x1, center: { x: 0, y: x3 + x1 / 2, z: 0 }, rotation: { x: 0, y: Math.PI, z: Math.PI / 2 } }),
    );

    // Торцы — концы раструбов, глубина — длина раструба. В gl2 точки — в центрах раструбов.
    const common = { depth: x1, joint: 'pp-socket', gender: 'internal' } as const;
    const { left, top, right } = ConnectorFrame;
    return createMeshModel({
      title: `Тройник ${params.r1}x${params.r2}x${params.r3}`,
      ...merger.merge(),
      connectors: [
        connector('left', left, params.m1 / 2, { nominal: params.r1, ...common }),
        connector('top', top, height, { nominal: params.r2, ...common }),
        connector('right', right, params.m1 / 2, { nominal: params.r3, ...common }),
      ],
    });
  }

  /** Диаметры выхода с наибольшим наружным диаметром; вызывать только для известных номиналов. */}
