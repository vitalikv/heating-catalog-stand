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

export interface PpCrossParams {
  /** Наружный диаметр ПП-трубы всех выходов, мм, строкой: '20', '25'… */
  nominal: string;
  /** Размер между торцами, м. */
  size: number;
}

/** Полипропиленовая крестовина под пайку (перенос pl_krestovina_1): выходы по ±X и ±Y. */
export class PpCrossGenerator extends BaseGenerator<PpCrossParams> {
  readonly id = 'pp.cross';
  readonly version = 1;
  readonly title = 'Крестовина ПП';
  readonly paramSpecs: readonly ParamSpec[] = [
    specs.ppNominal('nominal'),
    specs.length('size', 'Размер', { max: 0.3 }),
  ];
  readonly defaults: PpCrossParams = { nominal: '20', size: 0.052 };

  protected override relations(params: PpCrossParams): ValidationError[] {
    // Средняя часть (x_2 в gl2) была бы нулевой или отрицательной длины.
    return params.size <= 2 * SOCKET_LENGTH ? [ParamSchema.tooShort('size', 2 * SOCKET_LENGTH)] : [];
  }

  protected create(params: PpCrossParams): GeneratedModel {
    const d = PpPipeSizes.require(params.nominal);
    const x1 = SOCKET_LENGTH;
    const x2 = params.size - 2 * x1;
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

    // Торцы — концы раструбов (±size/2), глубина — длина раструба. В gl2 точки — в центрах раструбов.
    const common = { depth: x1, nominal: params.nominal, joint: 'pp-socket', gender: 'internal' } as const;
    const half = params.size / 2;
    const { left, right, bottom, top } = ConnectorFrame;
    return createMeshModel({
      title: `Крестовина ${params.nominal}`,
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
