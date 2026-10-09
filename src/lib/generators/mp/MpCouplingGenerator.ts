import { BaseGenerator } from '../../core/BaseGenerator';
import { connector } from '../../core/connector';
import { ConnectorFrame } from '../../core/ConnectorFrame';
import type { GeneratedModel, ParamSpec, ValidationError } from '../../core/contracts';
import { createMeshModel } from '../../core/MeshModel';
import { MaterialGroupMerger } from '../../geometry/MaterialGroupMerger';
import { ParamSchema } from '../../params/ParamSchema';
import { specs } from '../../params/specs';
import { MpPipeSizes } from '../../sizes/MpPipeSizes';
import { MpPressEnd } from './MpPressEnd';
import type { RunLayout } from './MpPressEnd';

export interface MpCouplingParams {
  /** Наружные диаметры металлопластиковых труб слева и справа, мм, строкой. */
  nominalLeft: string;
  nominalRight: string;
  /** Длина соединителя, м. */
  length: number;
}

/** Металлопластиковый соединитель под пресс, в том числе переходной (перенос mpl_perehod_1). */
export class MpCouplingGenerator extends BaseGenerator<MpCouplingParams, RunLayout> {
  readonly id = 'mp.coupling';
  readonly version = 1;
  readonly title = 'Соединитель металлопластиковый';
  readonly paramSpecs: readonly ParamSpec[] = [
    specs.mpNominal('nominalLeft', 'Труба слева, мм'),
    specs.mpNominal('nominalRight', 'Труба справа, мм'),
    specs.length('length', 'Длина', { max: 0.3 }),
  ];
  readonly defaults: MpCouplingParams = { nominalLeft: '16', nominalRight: '16', length: 0.06 };

  private readonly ends = new MpPressEnd();

  protected override layout(params: MpCouplingParams): RunLayout {
    const d1 = MpPipeSizes.require(params.nominalLeft);
    const d3 = MpPipeSizes.require(params.nominalRight);
    return { d1, d3, dc: d1.n >= d3.n ? d1 : d3 };
  }

  protected override relations(params: MpCouplingParams, { d1, d3 }: RunLayout): ValidationError[] {
    // Трубы между гильзами (s1, s3 в gl2) были бы нулевой или отрицательной длины.
    const longest = Math.max(MpPressEnd.pressLength(d1), MpPressEnd.pressLength(d3));
    return params.length / 2 <= longest ? [ParamSchema.tooShort('length', 2 * longest)] : [];
  }

  protected create(params: MpCouplingParams, { d1, d3, dc }: RunLayout): GeneratedModel {

    const merger = new MaterialGroupMerger();
    merger.add(...this.ends.buildRun(params.length, d1, d3, dc));

    // Торцы — концы гильз (±length/2), глубина — длина гильзы. В gl2 точки стояли в центрах гильз.
    const common = { joint: 'mp-press', gender: 'internal' } as const;
    const { left, right } = ConnectorFrame;
    return createMeshModel({
      title: params.nominalLeft === params.nominalRight ? `Соединитель ${params.nominalLeft}` : `Соединитель ${params.nominalLeft}x${params.nominalRight}`,
      ...merger.merge(),
      connectors: [
        connector('left', left, params.length / 2, { depth: MpPressEnd.pressLength(d1), nominal: params.nominalLeft, ...common }),
        connector('right', right, params.length / 2, { depth: MpPressEnd.pressLength(d3), nominal: params.nominalRight, ...common }),
      ],
    });
  }
}
