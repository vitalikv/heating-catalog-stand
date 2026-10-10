import { BaseGenerator } from '../../core/BaseGenerator';
import { connector } from '../../core/connector';
import { ConnectorFrame } from '../../core/ConnectorFrame';
import type { GeneratedModel, ParamSpec, ValidationError } from '../../core/contracts';
import { createMeshModel } from '../../core/MeshModel';
import { MaterialGroupMerger } from '../../geometry/MaterialGroupMerger';
import { sleeves } from '../../geometry/SleeveGeometryBuilder';
import { ParamSchema } from '../../params/ParamSchema';
import { specs } from '../../params/specs';
import { orientParts } from '../ThreadedParts';
import { MpCompressionEnd } from './MpCompressionEnd';
import type { CompressionSize } from './MpCompressionEnd';

export interface MpCompressionCouplingParams {
  /** Наружные диаметры МП-труб слева и справа, мм, строкой. */
  nominalLeft: string;
  nominalRight: string;
  /** Длина A — между торцами штуцеров (гаек), м. */
  length: number;
}
type Layout = { left: CompressionSize; right: CompressionSize };

/** Шестигранник корпуса посередине: ширина, м, и размер по вершинам относительно гайки — по эскизу VTm.303. */
const HEX_WIDTH = 0.006;
const HEX_RATIO = 0.9;

/**
 * Обжимной соединитель МП, в том числе переходной (позиция 83), по образцу VALTEC VTm.303:
 * длина A — по таблице каталога (с. 32), шестигранник корпуса посередине.
 */
export class MpCompressionCouplingGenerator extends BaseGenerator<MpCompressionCouplingParams, Layout> {
  readonly id = 'mp.compression-coupling';
  readonly version = 1;
  readonly title = 'Соединитель МП обжимной';
  readonly paramSpecs: readonly ParamSpec[] = [
    MpCompressionEnd.nominalSpec('nominalLeft', 'Труба слева, мм'),
    MpCompressionEnd.nominalSpec('nominalRight', 'Труба справа, мм'),
    specs.length('length', 'Длина A', { max: 0.3 }),
  ];
  readonly defaults: MpCompressionCouplingParams = { nominalLeft: '16', nominalRight: '16', length: 0.045 };

  protected override layout(p: MpCompressionCouplingParams): Layout {
    return { left: MpCompressionEnd.size(p.nominalLeft), right: MpCompressionEnd.size(p.nominalRight) };
  }

  protected override relations(p: MpCompressionCouplingParams, d: Layout): ValidationError[] {
    // Гайки не заходят на шестигранник.
    const half = Math.max(d.left.nutLength, d.right.nutLength) + HEX_WIDTH / 2;
    return p.length / 2 <= half ? [ParamSchema.tooShort('length', 2 * half)] : [];
  }

  protected create(p: MpCompressionCouplingParams, d: Layout): GeneratedModel {
    const half = p.length / 2;
    const hexOuter = HEX_RATIO * Math.max(d.left.nutOuter, d.right.nutOuter);
    const merger = new MaterialGroupMerger();
    merger.add(
      ...orientParts(MpCompressionEnd.arm(d.left, half), ConnectorFrame.left.direction),
      ...MpCompressionEnd.arm(d.right, half),
      ...sleeves.build({ material: 'metal', length: HEX_WIDTH, outerDiameter: hexOuter, innerDiameter: Math.min(d.left.channel, d.right.channel),
        outerSegments: 6, materials: { outer: 'metalFlat' } }),
    );
    return createMeshModel({
      title: p.nominalLeft === p.nominalRight ? `Соединитель обжимной ${p.nominalLeft}` : `Соединитель обжимной ${p.nominalLeft}x${p.nominalRight}`,
      ...merger.merge(),
      connectors: [
        connector('left', ConnectorFrame.left, half, MpCompressionEnd.end(p.nominalLeft, d.left)),
        connector('right', ConnectorFrame.right, half, MpCompressionEnd.end(p.nominalRight, d.right)),
      ],
    });
  }
}
