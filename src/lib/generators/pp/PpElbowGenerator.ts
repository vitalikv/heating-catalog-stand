import { BaseGenerator } from '../../core/BaseGenerator';
import { connector } from '../../core/connector';
import { ConnectorFrame } from '../../core/ConnectorFrame';
import type { GeneratedModel, ParamSpec, ValidationError } from '../../core/contracts';
import { createMeshModel } from '../../core/MeshModel';
import { MaterialGroupMerger } from '../../geometry/MaterialGroupMerger';
import { sleeves } from '../../geometry/SleeveGeometryBuilder';
import { spheres } from '../../geometry/SphereGeometryBuilder';
import { ParamSchema } from '../../params/ParamSchema';
import { specs } from '../../params/specs';
import { PpPipeSizes } from '../../sizes/PpPipeSizes';

/** Параметры в формате cdm из gl2. */
export interface PpElbowParams {
  /** Наружный диаметр ПП-трубы, мм, строкой: '20', '25'… */
  r1: string;
  /** Длина плеча от оси до торца, м. */
  m1: number;
}

/** Длина раструба у торца, м (x_1 в gl2). */
const SOCKET_LENGTH = 0.015;

/**
 * Полипропиленовый угол 90° под пайку (перенос pl_ugol_90_1).
 * Плечи идут по +X и +Y из начала координат, внешний угол скруглён четвертью сферы.
 */
export class PpElbowGenerator extends BaseGenerator<PpElbowParams> {
  readonly id = 'pl_ugol_90_1';
  readonly title = 'Угол ПП 90°';
  readonly paramSpecs: readonly ParamSpec[] = [
    specs.ppNominal('r1'),
    specs.length('m1', 'Длина плеча'),
  ];

  protected override relations(params: PpElbowParams): ValidationError[] {
    // Плечо до раструба (x_2 в gl2) было бы нулевой или отрицательной длины.
    return params.m1 <= SOCKET_LENGTH ? [ParamSchema.tooShort('m1', SOCKET_LENGTH)] : [];
  }

  protected create(params: PpElbowParams): GeneratedModel {
    const d = PpPipeSizes.require(params.r1);
    const x1 = SOCKET_LENGTH;
    const x2 = params.m1 - x1;
    const pipe = { outerDiameter: d.n, innerDiameter: d.v };
    const vertical = { x: 0, y: 0, z: -Math.PI / 2 };
    const quarter = { phiLength: Math.PI / 2, rotation: { x: Math.PI / 2, y: 0, z: 0 } };

    // В gl2 плечо и раструб — две втулки одного диаметра; разбиение сохранено.
    const merger = new MaterialGroupMerger();
    merger.add(
      ...sleeves.build({ material: 'plastic', ...pipe, length: x2, center: { x: x2 / 2, y: 0, z: 0 } }),
      ...sleeves.build({ material: 'plastic', ...pipe, length: x1, center: { x: x2 + x1 / 2, y: 0, z: 0 } }),
      ...sleeves.build({ material: 'plastic', ...pipe, length: x2, rotation: vertical, center: { x: 0, y: x2 / 2, z: 0 } }),
      ...sleeves.build({ material: 'plastic', ...pipe, length: x1, rotation: vertical, center: { x: 0, y: x2 + x1 / 2, z: 0 } }),
      spheres.build({ material: 'plastic', ...quarter, radius: d.n / 2 }),
      spheres.build({ material: 'plastic', ...quarter, radius: d.v / 2 }),
    );

    const title = `Угол ${params.r1}`;

    // Торец раструба — конец плеча m1, глубина — длина раструба x_1.
    // В gl2 точка разъёма стояла в центре раструба. ID — по стороне выхода.
    const end = { depth: x1, nominal: params.r1, joint: 'pp-socket', gender: 'internal' } as const;
    const connectors = [connector('right', ConnectorFrame.right, params.m1, end), connector('top', ConnectorFrame.top, params.m1, end)];

    return createMeshModel({ title, ...merger.merge(), connectors });
  }
}
