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

/** Полипропиленовая крестовина под пайку (перенос pl_krestovina_1): выходы по ±X и ±Y. */
export class PpCrossGenerator extends BaseGenerator<PpElbowParams> {
  readonly id = 'pl_krestovina_1';
  readonly title = 'Крестовина ПП';
  readonly paramSpecs: readonly ParamSpec[] = [
    specs.ppNominal('r1'),
    specs.length('m1', 'Размер', { max: 0.3 }),
  ];

  protected override relations(params: PpElbowParams): ValidationError[] {
    // Средняя часть (x_2 в gl2) была бы нулевой или отрицательной длины.
    return params.m1 <= 2 * SOCKET_LENGTH ? [ParamSchema.tooShort('m1', 2 * SOCKET_LENGTH)] : [];
  }

  protected create(params: PpElbowParams): GeneratedModel {
    const d = PpPipeSizes.require(params.r1);
    const x1 = SOCKET_LENGTH;
    const x2 = params.m1 - 2 * x1;
    const pipe = { outerDiameter: d.n, innerDiameter: d.v };
    const offset = (x2 + x1) / 2;

    // В gl2 раструбы и средняя часть — отдельные втулки одного диаметра; разбиение сохранено.
    const merger = new MaterialGroupMerger();
    for (const vertical of [false, true]) {
      const at = (value: number) => (vertical ? { x: 0, y: value, z: 0 } : { x: value, y: 0, z: 0 });
      const rotation = vertical ? { x: 0, y: 0, z: Math.PI / 2 } : undefined;
      merger.add(
        ...sleeves.build({ material: 'plastic', ...pipe, rotation, length: x1, center: at(-offset) }),
        ...sleeves.build({ material: 'plastic', ...pipe, rotation, length: x2 }),
        ...sleeves.build({ material: 'plastic', ...pipe, rotation, length: x1, center: at(offset) }),
      );
    }

    // Торцы — концы раструбов (±m1/2), глубина — длина раструба. В gl2 точки — в центрах раструбов.
    const common = { depth: x1, nominal: params.r1, joint: 'pp-socket', gender: 'internal' } as const;
    const half = params.m1 / 2;
    const { left, right, bottom, top } = ConnectorFrame;
    return createMeshModel({
      title: `Крестовина ${params.r1}`,
      ...merger.merge(),
      connectors: [
        connector('left', left, half, common),
        connector('right', right, half, common),
        connector('bottom', bottom, half, common),
        connector('top', top, half, common),
      ],
    });
  }
}
