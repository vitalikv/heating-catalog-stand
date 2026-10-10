import { BaseGenerator } from '../../core/BaseGenerator';
import { connector } from '../../core/connector';
import { ConnectorFrame } from '../../core/ConnectorFrame';
import type { GeneratedModel, ParamSpec, ThreadGender, ValidationError } from '../../core/contracts';
import { createMeshModel } from '../../core/MeshModel';
import { MaterialGroupMerger } from '../../geometry/MaterialGroupMerger';
import { sleeves } from '../../geometry/SleeveGeometryBuilder';
import { ParamSchema } from '../../params/ParamSchema';
import { specs } from '../../params/specs';
import { armBodyDiameter, orientParts, threadedArm, threadedSize } from '../ThreadedParts';
import type { ThreadedSize } from '../ThreadedParts';
import { MpCompressionEnd } from './MpCompressionEnd';
import type { CompressionSize } from './MpCompressionEnd';

export interface MpCompressionThreadAdapterParams {
  /** Сторона резьбы справа. */
  threadGender: ThreadGender;
  /** Наружный диаметр МП-трубы слева, мм, строкой. */
  pipeNominal: string;
  /** Дюймовый номинал резьбы справа. */
  threadNominal: string;
  /** Длина A — между торцами штуцера (гайки) и резьбы, м. */
  length: number;
}
type Layout = { pipe: CompressionSize; thread: ThreadedSize };

/** Шестигранник корпуса под ключ и участок корпуса между ним и резьбой, м. */
const HEX_LENGTH = 0.006;
const THREAD_NECK = 0.002;

/**
 * Обжимной переход МП на резьбу (позиция 86) по образцу VALTEC VTm.301 (наружная резьба)
 * и VTm.302 (внутренняя), с. 31: длина A — по таблице. Справа резьба, за ней шестигранник,
 * слева обжимная часть до торца гайки. Корпус и резьба никелированные.
 */
export class MpCompressionThreadAdapterGenerator extends BaseGenerator<MpCompressionThreadAdapterParams, Layout> {
  readonly id = 'mp.compression-thread-adapter';
  readonly version = 1;
  readonly title = 'Переход МП обжимной на резьбу';
  readonly paramSpecs: readonly ParamSpec[] = [
    specs.threadGender(),
    MpCompressionEnd.nominalSpec('pipeNominal'),
    specs.threadNominal('threadNominal', 'Номинал резьбы'),
    specs.length('length', 'Длина A'),
  ];
  readonly defaults: MpCompressionThreadAdapterParams = { threadGender: 'external', pipeNominal: '16', threadNominal: '1/2', length: 0.038 };

  protected override layout(p: MpCompressionThreadAdapterParams): Layout {
    return { pipe: MpCompressionEnd.size(p.pipeNominal), thread: threadedSize(p.threadNominal, p.threadGender) };
  }

  /** От торца резьбы до середины шестигранника, м. */
  private static threadSide(d: Layout): number {
    return d.thread.depth + THREAD_NECK + HEX_LENGTH / 2;
  }

  protected override relations(p: MpCompressionThreadAdapterParams, d: Layout): ValidationError[] {
    // Гайка не заходит на шестигранник.
    const minimum = MpCompressionThreadAdapterGenerator.threadSide(d) + HEX_LENGTH / 2 + d.pipe.nutLength;
    return p.length <= minimum ? [ParamSchema.tooShort('length', minimum)] : [];
  }

  protected create(p: MpCompressionThreadAdapterParams, d: Layout): GeneratedModel {
    const half = p.length / 2;
    // Середина шестигранника: от неё резьбовое плечо вправо, обжимное — влево.
    const threadReach = MpCompressionThreadAdapterGenerator.threadSide(d);
    const hexX = half - threadReach;
    const origin = { x: hexX, y: 0, z: 0 };
    const hexOuter = Math.max(d.pipe.nutOuter, armBodyDiameter(d.thread, p.threadGender) * 1.15);
    const merger = new MaterialGroupMerger();
    merger.add(
      ...orientParts(MpCompressionEnd.arm(d.pipe, half + hexX), ConnectorFrame.left.direction, origin),
      ...orientParts(threadedArm(d.thread, p.threadGender, threadReach, 'metal'), ConnectorFrame.right.direction, origin),
      ...sleeves.build({ material: 'metal', length: HEX_LENGTH, outerDiameter: hexOuter, innerDiameter: Math.min(d.pipe.channel, d.thread.v),
        outerSegments: 6, center: origin, materials: { outer: 'metalFlat' } }),
    );
    const suffix = p.threadGender === 'internal' ? '(в)' : '(н)';
    return createMeshModel({
      title: `Переход обжимной ${p.pipeNominal}x${p.threadNominal}${suffix}`,
      ...merger.merge(),
      connectors: [
        connector('left', ConnectorFrame.left, half, MpCompressionEnd.end(p.pipeNominal, d.pipe)),
        connector('right', ConnectorFrame.right, half, { depth: d.thread.depth, nominal: p.threadNominal, joint: 'thread', gender: p.threadGender }),
      ],
    });
  }
}
