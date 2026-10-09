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
import { PpThreadInsert } from './PpThreadInsert';
import type { PpThreadAdapterParams } from './PpThreadAdapterGenerator';

/** Длина раструба и резьбы (x_1 в gl2), м. */
const SOCKET_LENGTH = 0.015;

/**
 * Полипропиленовый тройник с резьбой на отводе (перенос pl_troinik_rezba_1): проход
 * длиной length под пайку, отвод высотой length/2 с металлической резьбовой вставкой.
 */
export class PpThreadTeeGenerator extends BaseGenerator<PpThreadAdapterParams> {
  readonly id = 'pp.tee-thread';
  readonly version = 1;
  readonly title = 'Тройник ПП с резьбой';
  readonly paramSpecs: readonly ParamSpec[] = [
    specs.threadGender(),
    specs.ppNominal('pipeNominal'),
    specs.threadNominal('threadNominal', 'Резьба отвода'),
    specs.length('length', 'Длина прохода', { max: 0.3 }),
  ];
  readonly defaults: PpThreadAdapterParams = { threadGender: 'external', pipeNominal: '20', threadNominal: '1/2', length: 0.07 };

  protected override relations(params: PpThreadAdapterParams): ValidationError[] {
    // Средняя часть прохода (x_2 в gl2) была бы нулевой или отрицательной длины.
    return params.length <= 2 * SOCKET_LENGTH ? [ParamSchema.tooShort('length', 2 * SOCKET_LENGTH)] : [];
  }

  protected create(params: PpThreadAdapterParams): GeneratedModel {
    const d1 = PpPipeSizes.require(params.pipeNominal);
    const insert = new PpThreadInsert(params.threadGender, params.threadNominal, d1);
    const x1 = SOCKET_LENGTH;
    const x2 = params.length - 2 * x1;
    const m2 = params.length / 2;
    const x3 = m2 - x1;
    const pipe = { outerDiameter: d1.n, innerDiameter: d1.v };
    const up = { x: 0, y: Math.PI, z: Math.PI / 2 };
    const bodyCenter = x3 + x1 / 2;

    const merger = new MaterialGroupMerger();
    merger.add(
      // Проход: два раструба и средняя часть
      ...sleeves.build({ material: 'plastic', ...pipe, length: x1, center: { x: -(x2 + x1) / 2, y: 0, z: 0 } }),
      ...sleeves.build({ material: 'plastic', ...pipe, length: x2 }),
      ...sleeves.build({ material: 'plastic', ...pipe, length: x1, center: { x: (x2 + x1) / 2, y: 0, z: 0 } }),
      // Отвод: труба, корпус вставки, резьбовая втулка
      ...sleeves.build({ material: 'plastic', ...pipe, length: x3, center: { x: 0, y: x3 / 2, z: 0 }, rotation: { x: 0, y: 0, z: -Math.PI / 2 } }),
      ...sleeves.build({
        material: 'plastic',
        length: x1,
        outerDiameter: insert.body.n,
        innerDiameter: insert.body.v,
        outerSegments: 12,
        rotation: up,
        center: { x: 0, y: bodyCenter, z: 0 },
        materials: { outer: 'plasticFlat' },
      }),
      ...sleeves.build({
        material: 'metal',
        length: x1,
        outerDiameter: insert.thread.n,
        innerDiameter: insert.thread.v,
        rotation: up,
        center: { x: 0, y: insert.insertCenter(bodyCenter, x1), z: 0 },
        materials: insert.materials,
      }),
    );

    // Раструбы: торцы ±length/2, глубина — длина раструба. Резьба: торец — край втулки, глубина — её длина.
    // В gl2 точки стояли в центрах раструбов и втулки.
    const socket = { depth: x1, nominal: params.pipeNominal, joint: 'pp-socket', gender: 'internal' } as const;
    const { left, top, right } = ConnectorFrame;
    return createMeshModel({
      title: `Тройник ${params.pipeNominal}x${params.threadNominal}${insert.suffix}x${params.pipeNominal}`,
      ...merger.merge(),
      connectors: [
        connector('left', left, m2, socket),
        connector('top', top, insert.face(m2, x1), { depth: x1, nominal: params.threadNominal, joint: 'thread', gender: insert.gender }),
        connector('right', right, m2, socket),
      ],
    });
  }
}
