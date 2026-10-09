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
import type { PpElbowParams } from './PpElbowGenerator';

/** Длина раструба (x_1 в gl2), м. */
const SOCKET_LENGTH = 0.015;

/**
 * Полипропиленовый тройник под пайку (перенос pl_troinik_1): проход длиной m1 по X
 * и отвод высотой m1/2 по +Y — две втулки одного диаметра.
 */
export class PpTeeGenerator extends BaseGenerator<PpElbowParams> {
  readonly id = 'pl_troinik_1';
  readonly title = 'Тройник ПП';
  readonly paramSpecs: readonly ParamSpec[] = [
    specs.ppNominal('r1'),
    specs.length('m1', 'Длина прохода', { max: 0.3 }),
  ];

  protected override relations(params: PpElbowParams): ValidationError[] {
    // Раструбы прохода не должны перекрываться (x_2 в gl2).
    return params.m1 <= 2 * SOCKET_LENGTH ? [ParamSchema.tooShort('m1', 2 * SOCKET_LENGTH)] : [];
  }

  protected create(params: PpElbowParams): GeneratedModel {
    const d = PpPipeSizes.require(params.r1);
    const m2 = params.m1 / 2;
    const pipe = { outerDiameter: d.n, innerDiameter: d.v };

    const merger = new MaterialGroupMerger();
    merger.add(
      ...sleeves.build({ material: 'plastic', ...pipe, length: params.m1 }),
      ...sleeves.build({ material: 'plastic', ...pipe, length: m2, center: { x: 0, y: m2 / 2, z: 0 }, rotation: { x: 0, y: 0, z: -Math.PI / 2 } }),
    );

    // Торцы — концы прохода и отвода, глубина — длина раструба. В gl2 точки — в центрах раструбов.
    const common = { depth: SOCKET_LENGTH, nominal: params.r1, joint: 'pp-socket', gender: 'internal' } as const;
    const { left, top, right } = ConnectorFrame;
    return createMeshModel({
      title: `Тройник ${params.r1}`,
      ...merger.merge(),
      connectors: [
        connector('left', left, m2, common),
        connector('top', top, m2, common),
        connector('right', right, m2, common),
      ],
    });
  }
}
