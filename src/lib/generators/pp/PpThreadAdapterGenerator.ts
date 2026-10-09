import { BaseGenerator } from '../../core/BaseGenerator';
import { connector } from '../../core/connector';
import { ConnectorFrame } from '../../core/ConnectorFrame';
import type { GeneratedModel, ParamSpec, ThreadGender, ValidationError } from '../../core/contracts';
import { createMeshModel } from '../../core/MeshModel';
import { MaterialGroupMerger } from '../../geometry/MaterialGroupMerger';
import { sleeves } from '../../geometry/SleeveGeometryBuilder';
import { ParamSchema } from '../../params/ParamSchema';
import { specs } from '../../params/specs';
import { PpPipeSizes } from '../../sizes/PpPipeSizes';
import type { PartDiameters } from '../../sizes/ThreadSizes';
import { PpThreadInsert } from './PpThreadInsert';

export interface PpThreadAdapterParams {
  /** Сторона резьбы справа. */
  threadGender: ThreadGender;
  /** Наружный диаметр ПП-трубы слева, мм, строкой. */
  pipeNominal: string;
  /** Дюймовый номинал резьбы справа. */
  threadNominal: string;
  /** Длина, м. */
  length: number;
}

/** Длины раструба и резьбы — 0,3 наружного диаметра, не меньше 12 мм. */
const MIN_PART_LENGTH = 0.012;

interface AdapterLayout {
  /** Раструб под пайку и резьбовая вставка. */
  d1: PartDiameters;
  insert: PpThreadInsert;
  /** Длины раструба (x_1) и резьбы (x_2). */
  x1: number;
  x2: number;
}

/**
 * Полипропиленовый соединитель с резьбой (перенос pl_perehod_rezba_1): слева раструб
 * под пайку, справа металлическая резьбовая вставка в 12-гранном корпусе.
 */
export class PpThreadAdapterGenerator extends BaseGenerator<PpThreadAdapterParams, AdapterLayout> {
  readonly id = 'pp.thread-adapter';
  readonly version = 1;
  readonly title = 'Соединитель ПП с резьбой';
  readonly paramSpecs: readonly ParamSpec[] = [
    specs.threadGender(),
    specs.ppNominal('pipeNominal'),
    specs.threadNominal('threadNominal', 'Номинал резьбы'),
    specs.length('length', 'Длина'),
  ];
  readonly defaults: PpThreadAdapterParams = { threadGender: 'external', pipeNominal: '20', threadNominal: '1/2', length: 0.036 };

  protected override layout(params: PpThreadAdapterParams): AdapterLayout {
    const d1 = PpPipeSizes.require(params.pipeNominal);
    const insert = new PpThreadInsert(params.threadGender, params.threadNominal, d1);
    return {
      d1,
      insert,
      x1: Math.max(0.015 * d1.n * 20, MIN_PART_LENGTH),
      x2: Math.max(0.015 * insert.thread.n * 20, MIN_PART_LENGTH),
    };
  }

  protected override relations(params: PpThreadAdapterParams, { x1, x2 }: AdapterLayout): ValidationError[] {
    const longest = Math.max(x1, x2);
    return params.length / 2 <= longest ? [ParamSchema.tooShort('length', 2 * longest)] : [];
  }

  protected create(params: PpThreadAdapterParams, { d1, insert, x1, x2 }: AdapterLayout): GeneratedModel {
    const x3L = params.length / 2 - x1;
    const x3R = params.length / 2 - x2;
    const pipe = { outerDiameter: d1.n, innerDiameter: d1.v };
    const body = { outerDiameter: insert.body.n, innerDiameter: insert.body.v };
    const at = (x: number) => ({ x, y: 0, z: 0 });
    const bodyCenter = x3R + x2 / 2;

    const merger = new MaterialGroupMerger();
    merger.add(
      // Слева: раструб и гладкая часть
      ...sleeves.build({ material: 'plastic', ...pipe, length: x1, center: at(-(x3L + x1 / 2)) }),
      ...sleeves.build({ material: 'plastic', ...pipe, length: x3L, center: at(-x3L / 2) }),
      // Центр и корпус вставки
      ...sleeves.build({ material: 'plastic', ...body, length: Math.max(d1.n, insert.thread.n) / 7 }),
      ...sleeves.build({ material: 'plastic', ...body, length: x3R, center: at(x3R / 2) }),
      ...sleeves.build({ material: 'plastic', ...body, length: x2, outerSegments: 12, center: at(bodyCenter), materials: { outer: 'plasticFlat' } }),
      // Резьбовая втулка
      ...sleeves.build({
        material: 'metal',
        length: x2,
        outerDiameter: insert.thread.n,
        innerDiameter: insert.thread.v,
        center: at(insert.insertCenter(bodyCenter, x2)),
        materials: insert.materials,
      }),
    );

    // Раструб: торец −length/2, глубина — длина раструба. Резьба: торец — край втулки, глубина — её длина.
    // В gl2 точки стояли в центрах раструба и втулки.
    return createMeshModel({
      title: `Соединитель ${params.pipeNominal}х${params.threadNominal}${insert.suffix}`,
      ...merger.merge(),
      connectors: [
        connector('left', ConnectorFrame.left, params.length / 2, { depth: x1, nominal: params.pipeNominal, joint: 'pp-socket', gender: 'internal' }),
        connector('right', ConnectorFrame.right, insert.face(params.length / 2, x2), { depth: x2, nominal: params.threadNominal, joint: 'thread', gender: insert.gender }),
      ],
    });
  }
}
