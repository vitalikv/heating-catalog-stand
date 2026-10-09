import { BaseGenerator } from '../../core/BaseGenerator';
import { connector } from '../../core/connector';
import { ConnectorFrame } from '../../core/ConnectorFrame';
import type { GeneratedModel, ParamSpec, ValidationError } from '../../core/contracts';
import { createMeshModel } from '../../core/MeshModel';
import { MaterialGroupMerger } from '../../geometry/MaterialGroupMerger';
import { sleeves } from '../../geometry/SleeveGeometryBuilder';
import { ParamSchema } from '../../params/ParamSchema';
import { specs } from '../../params/specs';
import { ThreadSizes } from '../../sizes/ThreadSizes';

/** Параметры в формате cdm из gl2. */
export interface SteelCrossParams {
  /** Дюймовый номинал внутренней резьбы всех выходов, например '1/2'. */
  r1: string;
  /** Размер между торцами, м. */
  m1: number;
}

/** Длина резьбы (x_1 в gl2), м. */
const THREAD_LENGTH = 0.015;
/** Зазор кольца по внутреннему диаметру (kf в gl2), м. */
const RING_GAP = 0.0001;

/** Стальная крестовина с внутренней резьбой (перенос st_krestovina_1): выходы по ±X и ±Y. */
export class SteelCrossGenerator extends BaseGenerator<SteelCrossParams> {
  readonly id = 'st_krestovina_1';
  readonly title = 'Крестовина стальная';
  readonly paramSpecs: readonly ParamSpec[] = [
    specs.threadNominal('r1', 'Резьба (в)'),
    specs.length('m1', 'Размер', { max: 0.3 }),
  ];

  protected override relations(params: SteelCrossParams): ValidationError[] {
    // Средняя часть (x_2 в gl2) была бы нулевой или отрицательной длины.
    return params.m1 <= 2 * THREAD_LENGTH ? [ParamSchema.tooShort('m1', 2 * THREAD_LENGTH)] : [];
  }

  protected create(params: SteelCrossParams): GeneratedModel {
    const d = ThreadSizes.require(params.r1, 'internal');
    const x1 = THREAD_LENGTH;
    const x2 = params.m1 - 2 * x1;
    const ring = d.n / 10;
    const pipe = { outerDiameter: d.n, innerDiameter: d.v };
    const ringSize = { length: ring, outerDiameter: d.n + ring, innerDiameter: d.v + RING_GAP };
    const threadOffset = (x2 + x1) / 2;
    // Кольцо — у торца внутри резьбы.
    const ringOffset = x2 / 2 + x1 - ring / 2;

    const merger = new MaterialGroupMerger();
    for (const vertical of [false, true]) {
      const at = (offset: number) => (vertical ? { x: 0, y: offset, z: 0 } : { x: offset, y: 0, z: 0 });
      const rotation = vertical ? { x: 0, y: 0, z: Math.PI / 2 } : undefined;
      merger.add(
        ...sleeves.build({ material: 'metal', ...pipe, rotation, length: x1, center: at(-threadOffset), materials: { inner: 'thread' } }),
        ...sleeves.build({ material: 'metal', ...pipe, rotation, length: x2 }),
        ...sleeves.build({ material: 'metal', ...pipe, rotation, length: x1, center: at(threadOffset), materials: { inner: 'thread' } }),
      );
    }
    for (const vertical of [false, true]) {
      const rotation = vertical ? { x: 0, y: 0, z: Math.PI / 2 } : undefined;
      for (const offset of [-ringOffset, ringOffset]) {
        merger.add(...sleeves.build({ material: 'metal', ...ringSize, rotation, center: vertical ? { x: 0, y: offset, z: 0 } : { x: offset, y: 0, z: 0 } }));
      }
    }

    // Торцы — концы резьбы (±m1/2), глубина — резьба. В gl2 точки — в центрах резьбы.
    const common = { depth: x1, nominal: params.r1, joint: 'thread', gender: 'internal' } as const;
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
