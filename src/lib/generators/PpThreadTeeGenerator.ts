import type { GeneratedModel, ModelGenerator, ParamSpec, ValidationError } from '../contracts';
import { GeneratorParamsError } from '../GeneratorParamsError';
import { MaterialGroupMerger } from '../geometry/MaterialGroupMerger';
import { SleeveGeometryBuilder } from '../geometry/SleeveGeometryBuilder';
import type { MaterialLibrary } from '../materials/MaterialLibrary';
import { ParamSchema } from '../params/ParamSchema';
import { PpPipeSizes } from '../sizes/PpPipeSizes';
import { ThreadSizes } from '../sizes/ThreadSizes';
import { ConnectorFrame } from './ConnectorFrame';
import { MeshModel } from './MeshModel';
import { PpThreadInsert } from './PpThreadInsert';
import type { PpThreadAdapterParams } from './PpThreadAdapterGenerator';

/** Длина раструба и резьбы (x_1 в gl2), м. */
const SOCKET_LENGTH = 0.015;

/**
 * Полипропиленовый тройник с резьбой на отводе (перенос pl_troinik_rezba_1): проход
 * длиной m1 под пайку, отвод высотой m1/2 с металлической резьбовой вставкой.
 */
export class PpThreadTeeGenerator implements ModelGenerator<PpThreadAdapterParams> {
  readonly id = 'pl_troinik_rezba_1';
  readonly title = 'Тройник ПП с резьбой';
  readonly paramSpecs: readonly ParamSpec[] = [
    { kind: 'choice', key: 'side', label: 'Резьба', options: ['v', 'n'], optionLabels: { v: 'внутренняя', n: 'наружная' } },
    { kind: 'choice', key: 'r1', label: 'Труба, мм', options: PpPipeSizes.nominals },
    { kind: 'choice', key: 'r2', label: 'Резьба отвода', options: ThreadSizes.nominals },
    { kind: 'length', key: 'm1', label: 'Длина прохода', min: 0.001, max: 0.3, step: 0.0005 },
  ];

  private readonly sleeves = new SleeveGeometryBuilder();

  constructor(private readonly materials: MaterialLibrary) {}

  validate(params: PpThreadAdapterParams): ValidationError[] {
    const errors = ParamSchema.validate(this.paramSpecs, params);
    // Средняя часть прохода (x_2 в gl2) была бы нулевой или отрицательной длины.
    if (errors.length === 0 && params.m1 <= 2 * SOCKET_LENGTH) errors.push(ParamSchema.tooShort('m1', 2 * SOCKET_LENGTH));
    return errors;
  }

  build(params: PpThreadAdapterParams): GeneratedModel {
    const errors = this.validate(params);
    if (errors.length > 0) throw new GeneratorParamsError(this.id, errors);

    const d1 = PpPipeSizes.diameters(params.r1)!;
    const insert = new PpThreadInsert(params.side, params.r2, d1);
    const x1 = SOCKET_LENGTH;
    const x2 = params.m1 - 2 * x1;
    const m2 = params.m1 / 2;
    const x3 = m2 - x1;
    const pipe = { outerDiameter: d1.n, innerDiameter: d1.v };
    const up = { x: 0, y: Math.PI, z: Math.PI / 2 };
    const bodyCenter = x3 + x1 / 2;

    const merger = new MaterialGroupMerger();
    merger.add(
      // Проход: два раструба и средняя часть
      ...this.sleeves.build({ material: 'plastic', ...pipe, length: x1, center: { x: -(x2 + x1) / 2, y: 0, z: 0 } }),
      ...this.sleeves.build({ material: 'plastic', ...pipe, length: x2 }),
      ...this.sleeves.build({ material: 'plastic', ...pipe, length: x1, center: { x: (x2 + x1) / 2, y: 0, z: 0 } }),
      // Отвод: труба, корпус вставки, резьбовая втулка
      ...this.sleeves.build({ material: 'plastic', ...pipe, length: x3, center: { x: 0, y: x3 / 2, z: 0 }, rotation: { x: 0, y: 0, z: -Math.PI / 2 } }),
      ...this.sleeves.build({
        material: 'plastic',
        length: x1,
        outerDiameter: insert.body.n,
        innerDiameter: insert.body.v,
        outerSegments: 12,
        rotation: up,
        center: { x: 0, y: bodyCenter, z: 0 },
        materials: { outer: 'plasticFlat' },
      }),
      ...this.sleeves.build({
        material: 'metal',
        length: x1,
        outerDiameter: insert.thread.n,
        innerDiameter: insert.thread.v,
        rotation: up,
        center: { x: 0, y: insert.insertCenter(bodyCenter, x1), z: 0 },
        materials: insert.materials,
      }),
    );

    // Раструбы: торцы ±m1/2, глубина — длина раструба. Резьба: торец — край втулки, глубина — её длина.
    // В gl2 точки стояли в центрах раструбов и втулки.
    const socket = { depth: x1, nominal: params.r1, joint: 'pp-socket', gender: 'internal' } as const;
    const { left, top, right } = ConnectorFrame;
    return MeshModel.create({
      title: `Тройник ${params.r1}x${params.r2}${insert.suffix}x${params.r1}`,
      ...merger.merge(),
      connectors: [
        { id: 'left', position: ConnectorFrame.point(left, m2), ...left, ...socket },
        {
          id: 'top',
          position: ConnectorFrame.point(top, insert.face(m2, x1)),
          ...top,
          depth: x1,
          nominal: params.r2,
          joint: 'thread',
          gender: insert.gender,
        },
        { id: 'right', position: ConnectorFrame.point(right, m2), ...right, ...socket },
      ],
    }, this.materials);
  }
}
