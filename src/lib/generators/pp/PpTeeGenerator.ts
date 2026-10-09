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

/** Длина раструба (x_1 в gl2), м. */
const SOCKET_LENGTH = 0.015;

export interface PpTeeParams {
  /** Наружный диаметр ПП-трубы всех выходов, мм, строкой: '20', '25'… */
  nominal: string;
  /** Длина прохода, м. */
  length: number;
}

/**
 * Полипропиленовый тройник под пайку (перенос pl_troinik_1): проход длиной length по X
 * и отвод высотой length/2 по +Y — две втулки одного диаметра.
 */
export class PpTeeGenerator extends BaseGenerator<PpTeeParams> {
  readonly id = 'pp.tee';
  readonly version = 1;
  readonly title = 'Тройник ПП';
  readonly paramSpecs: readonly ParamSpec[] = [
    specs.ppNominal('nominal'),
    specs.length('length', 'Длина прохода', { max: 0.3 }),
  ];
  readonly defaults: PpTeeParams = { nominal: '20', length: 0.055 };

  protected override relations(params: PpTeeParams): ValidationError[] {
    // Раструбы прохода не должны перекрываться (x_2 в gl2).
    return params.length <= 2 * SOCKET_LENGTH ? [ParamSchema.tooShort('length', 2 * SOCKET_LENGTH)] : [];
  }

  protected create(params: PpTeeParams): GeneratedModel {
    const d = PpPipeSizes.require(params.nominal);
    const m2 = params.length / 2;
    const pipe = { outerDiameter: d.n, innerDiameter: d.v };

    const merger = new MaterialGroupMerger();
    merger.add(
      ...sleeves.build({ material: 'plastic', ...pipe, length: params.length }),
      ...sleeves.build({ material: 'plastic', ...pipe, length: m2, center: { x: 0, y: m2 / 2, z: 0 }, rotation: { x: 0, y: 0, z: -Math.PI / 2 } }),
    );

    // Торцы — концы прохода и отвода, глубина — длина раструба. В gl2 точки — в центрах раструбов.
    const common = { depth: SOCKET_LENGTH, nominal: params.nominal, joint: 'pp-socket', gender: 'internal' } as const;
    const { left, top, right } = ConnectorFrame;
    return createMeshModel({
      title: `Тройник ${params.nominal}`,
      ...merger.merge(),
      connectors: [
        connector('left', left, m2, common),
        connector('top', top, m2, common),
        connector('right', right, m2, common),
      ],
    });
  }
}
