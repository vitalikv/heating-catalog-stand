import { BaseGenerator } from '../../core/BaseGenerator';
import { connector } from '../../core/connector';
import { ConnectorFrame } from '../../core/ConnectorFrame';
import type { GeneratedModel, ParamSpec, ValidationError } from '../../core/contracts';
import { createMeshModel } from '../../core/MeshModel';
import { MaterialGroupMerger } from '../../geometry/MaterialGroupMerger';
import { sleeves } from '../../geometry/SleeveGeometryBuilder';
import { ParamSchema } from '../../params/ParamSchema';
import { specs } from '../../params/specs';
import { MpPipeSizes } from '../../sizes/MpPipeSizes';
import { MpPressEnd } from './MpPressEnd';
import type { TeeLayout } from './MpPressEnd';

export interface MpTeeParams {
  /** Наружные диаметры металлопластиковых труб: слева, отвод, справа; мм, строкой. */
  nominalLeft: string;
  nominalBranch: string;
  nominalRight: string;
  /** Длина прохода, м. */
  length: number;
  /** Высота отвода от оси прохода до конца гильзы, м. */
  branchLength: number;
}

/** Металлопластиковый тройник под пресс, в том числе переходной (перенос mpl_troinik_1). */
export class MpTeeGenerator extends BaseGenerator<MpTeeParams, TeeLayout> {
  readonly id = 'mp.tee';
  readonly version = 1;
  readonly title = 'Тройник металлопластиковый';
  readonly paramSpecs: readonly ParamSpec[] = [
    specs.mpNominal('nominalLeft', 'Слева, мм'),
    specs.mpNominal('nominalBranch', 'Отвод, мм'),
    specs.mpNominal('nominalRight', 'Справа, мм'),
    specs.length('length', 'Длина прохода', { max: 0.3 }),
    specs.length('branchLength', 'Высота отвода'),
  ];
  readonly defaults: MpTeeParams = { nominalLeft: '16', nominalBranch: '20', nominalRight: '16', length: 0.088, branchLength: 0.044 };

  private readonly ends = new MpPressEnd();

  protected override layout(params: MpTeeParams): TeeLayout {
    const [d1, d2, d3] = [params.nominalLeft, params.nominalBranch, params.nominalRight].map((r) => MpPipeSizes.require(r));
    return { d1, d2, d3, dc: [d1, d2, d3].reduce((max, d) => (d.n > max.n ? d : max)) };
  }

  protected override relations(params: MpTeeParams, { d1, d2, d3 }: TeeLayout): ValidationError[] {
    // Трубы до гильз (s1, s2, s3 в gl2) были бы нулевой или отрицательной длины.
    const errors: ValidationError[] = [];
    const run = Math.max(MpPressEnd.pressLength(d1), MpPressEnd.pressLength(d3));
    const w2 = MpPressEnd.pressLength(d2);
    if (params.length / 2 <= run) errors.push(ParamSchema.tooShort('length', 2 * run));
    if (params.branchLength <= w2) errors.push(ParamSchema.tooShort('branchLength', w2));
    return errors;
  }

  protected create(params: MpTeeParams, { d1, d2, d3, dc }: TeeLayout): GeneratedModel {
    const w2 = MpPressEnd.pressLength(d2);
    const s2 = (params.branchLength - w2) / 2;

    const merger = new MaterialGroupMerger();
    merger.add(
      ...this.ends.buildRun(params.length, d1, d3, dc),
      // Отвод: конус от наибольшего диаметра, труба, пресс-конец
      ...sleeves.build({
        material: 'bronze',
        length: s2,
        outerDiameter: dc.n,
        innerDiameter: dc.v,
        outerDiameterStart: d2.n,
        innerDiameterStart: d2.v,
        center: { x: 0, y: s2 / 2, z: 0 },
        rotation: { x: 0, y: 0, z: -Math.PI / 2 },
      }),
      ...sleeves.build({ material: 'bronze', length: s2, outerDiameter: d2.n, innerDiameter: d2.v, ...MpPressEnd.top(1.5 * s2) }),
      ...this.ends.build(d2, 2 * s2, w2, MpPressEnd.top),
    );

    // Торцы — концы гильз, глубина — длина гильзы. В gl2 точки стояли в центрах гильз.
    const common = { joint: 'mp-press', gender: 'internal' } as const;
    const { left, top, right } = ConnectorFrame;
    const names = [params.nominalLeft, params.nominalBranch, params.nominalRight];
    return createMeshModel({
      title: new Set(names).size === 1 ? `Тройник ${params.nominalLeft}` : `Тройник ${names.join('x')}`,
      ...merger.merge(),
      connectors: [
        connector('left', left, params.length / 2, { depth: MpPressEnd.pressLength(d1), nominal: params.nominalLeft, ...common }),
        connector('top', top, params.branchLength, { depth: w2, nominal: params.nominalBranch, ...common }),
        connector('right', right, params.length / 2, { depth: MpPressEnd.pressLength(d3), nominal: params.nominalRight, ...common }),
      ],
    });
  }
}
