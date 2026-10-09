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

/** Параметры в формате cdm из gl2: r2 в этом генераторе нет, правый выход — r3. */
export interface MpCouplingParams {
  /** Наружные диаметры металлопластиковых труб слева и справа, мм, строкой. */
  r1: string;
  r3: string;
  /** Длина соединителя, м. */
  m1: number;
}

/** Металлопластиковый соединитель под пресс, в том числе переходной (перенос mpl_perehod_1). */
export class MpCouplingGenerator extends BaseGenerator<MpCouplingParams, RunLayout> {
  readonly id = 'mpl_perehod_1';
  readonly title = 'Соединитель металлопластиковый';
  readonly paramSpecs: readonly ParamSpec[] = [
    specs.mpNominal('r1', 'Труба слева, мм'),
    specs.mpNominal('r3', 'Труба справа, мм'),
    specs.length('m1', 'Длина', { max: 0.3 }),
  ];

  private readonly ends = new MpPressEnd();

  protected override layout(params: MpCouplingParams): RunLayout {
    const d1 = MpPipeSizes.require(params.r1);
    const d3 = MpPipeSizes.require(params.r3);
    return { d1, d3, dc: d1.n >= d3.n ? d1 : d3 };
  }

  protected override relations(params: MpCouplingParams, { d1, d3 }: RunLayout): ValidationError[] {
    // Трубы между гильзами (s1, s3 в gl2) были бы нулевой или отрицательной длины.
    const longest = Math.max(MpPressEnd.pressLength(d1), MpPressEnd.pressLength(d3));
    return params.m1 / 2 <= longest ? [ParamSchema.tooShort('m1', 2 * longest)] : [];
  }

  protected create(params: MpCouplingParams, { d1, d3, dc }: RunLayout): GeneratedModel {

    const merger = new MaterialGroupMerger();
    merger.add(...this.ends.buildRun(params.m1, d1, d3, dc));

    // Торцы — концы гильз (±m1/2), глубина — длина гильзы. В gl2 точки стояли в центрах гильз.
    const common = { joint: 'mp-press', gender: 'internal' } as const;
    const { left, right } = ConnectorFrame;
    return createMeshModel({
      title: params.r1 === params.r3 ? `Соединитель ${params.r1}` : `Соединитель ${params.r1}x${params.r3}`,
      ...merger.merge(),
      connectors: [
        connector('left', left, params.m1 / 2, { depth: MpPressEnd.pressLength(d1), nominal: params.r1, ...common }),
        connector('right', right, params.m1 / 2, { depth: MpPressEnd.pressLength(d3), nominal: params.r3, ...common }),
      ],
    });
  }
}
