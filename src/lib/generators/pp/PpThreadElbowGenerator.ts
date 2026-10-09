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
import type { ThreadSideCode } from '../../params/specs';
import { PpPipeSizes } from '../../sizes/PpPipeSizes';
import { PpThreadInsert } from './PpThreadInsert';

/** Параметры в формате cdm из gl2. */
export interface PpThreadElbowParams {
  /** Сторона резьбы на правом выходе. */
  side: ThreadSideCode;
  /** Наружный диаметр ПП-трубы, мм, строкой. */
  r1: string;
  /** Дюймовый номинал резьбы. */
  r2: string;
  /** Длина плеча от оси до торца раструба, м. */
  m1: number;
}

/** Длина раструба и резьбового участка (x_1 в gl2), м. */
const SOCKET_LENGTH = 0.015;

/**
 * Полипропиленовый угол 90° с резьбой (перенос pl_ugol_90_rezba_1): вверх — раструб
 * под пайку, вправо — металлическая резьбовая вставка в 12-гранном корпусе.
 */
export class PpThreadElbowGenerator extends BaseGenerator<PpThreadElbowParams> {
  readonly id = 'pl_ugol_90_rezba_1';
  readonly title = 'Угол ПП 90° с резьбой';
  readonly paramSpecs: readonly ParamSpec[] = [
    specs.threadSide(),
    specs.ppNominal('r1'),
    specs.threadNominal('r2', 'Номинал резьбы'),
    specs.length('m1', 'Длина плеча'),
  ];

  protected override relations(params: PpThreadElbowParams): ValidationError[] {
    return params.m1 <= SOCKET_LENGTH ? [ParamSchema.tooShort('m1', SOCKET_LENGTH)] : [];
  }

  protected create(params: PpThreadElbowParams): GeneratedModel {
    const d1 = PpPipeSizes.require(params.r1);
    const insert = new PpThreadInsert(params.side, params.r2, d1);
    const x1 = SOCKET_LENGTH;
    const x2 = params.m1 - x1;
    const pipe = { outerDiameter: d1.n, innerDiameter: d1.v };
    const vertical = { rotation: { x: 0, y: 0, z: -Math.PI / 2 } };
    const quarter = { phiLength: Math.PI / 2, rotation: { x: Math.PI / 2, y: 0, z: 0 } };
    const bodyCenter = x2 + x1 / 2;

    const merger = new MaterialGroupMerger();
    merger.add(
      // Вправо: труба, корпус вставки, резьбовая втулка
      ...sleeves.build({ material: 'plastic', ...pipe, length: x2, center: { x: x2 / 2, y: 0, z: 0 } }),
      ...sleeves.build({
        material: 'plastic',
        length: x1,
        outerDiameter: insert.body.n,
        innerDiameter: insert.body.v,
        outerSegments: 12,
        center: { x: bodyCenter, y: 0, z: 0 },
        materials: { outer: 'plasticFlat' },
      }),
      ...sleeves.build({
        material: 'metal',
        length: x1,
        outerDiameter: insert.thread.n,
        innerDiameter: insert.thread.v,
        center: { x: insert.insertCenter(bodyCenter, x1), y: 0, z: 0 },
        materials: insert.materials,
      }),
      // Вверх: труба и раструб
      ...sleeves.build({ material: 'plastic', ...pipe, ...vertical, length: x2, center: { x: 0, y: x2 / 2, z: 0 } }),
      ...sleeves.build({ material: 'plastic', ...pipe, ...vertical, length: x1, center: { x: 0, y: x2 + x1 / 2, z: 0 } }),
      spheres.build({ material: 'plastic', ...quarter, radius: d1.n / 2 }),
      spheres.build({ material: 'plastic', ...quarter, radius: d1.v / 2 }),
    );

    // Раструб: торец — конец плеча, глубина — длина раструба. Резьба: торец — край втулки,
    // глубина — длина втулки. В gl2 точки стояли в центрах раструба и втулки.
    const face = insert.face(params.m1, x1);
    return createMeshModel({
      title: `Угол ${params.r1}x${params.r2}${insert.suffix}`,
      ...merger.merge(),
      connectors: [
        connector('right', ConnectorFrame.right, face, { depth: x1, nominal: params.r2, joint: 'thread', gender: insert.gender }),
        connector('top', ConnectorFrame.top, params.m1, { depth: x1, nominal: params.r1, joint: 'pp-socket', gender: 'internal' }),
      ],
    });
  }
}
