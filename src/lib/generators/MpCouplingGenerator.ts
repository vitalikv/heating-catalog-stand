import type { GeneratedModel, ModelGenerator, ParamSpec, ValidationError } from '../contracts';
import { GeneratorParamsError } from '../GeneratorParamsError';
import { MaterialGroupMerger } from '../geometry/MaterialGroupMerger';
import { SleeveGeometryBuilder } from '../geometry/SleeveGeometryBuilder';
import { ParamSchema } from '../params/ParamSchema';
import { MpPipeSizes } from '../sizes/MpPipeSizes';
import { ConnectorFrame } from './ConnectorFrame';
import { MeshModel } from './MeshModel';
import { MpPressEnd } from './MpPressEnd';

/** Параметры в формате cdm из gl2: r2 в этом генераторе нет, правый выход — r3. */
export interface MpCouplingParams {
  /** Наружные диаметры металлопластиковых труб слева и справа, мм, строкой. */
  r1: string;
  r3: string;
  /** Длина соединителя, м. */
  m1: number;
}

/** Металлопластиковый соединитель под пресс, в том числе переходной (перенос mpl_perehod_1). */
export class MpCouplingGenerator implements ModelGenerator<MpCouplingParams> {
  readonly id = 'mpl_perehod_1';
  readonly title = 'Соединитель металлопластиковый';
  readonly paramSpecs: readonly ParamSpec[] = [
    { kind: 'choice', key: 'r1', label: 'Труба слева, мм', options: MpPipeSizes.nominals },
    { kind: 'choice', key: 'r3', label: 'Труба справа, мм', options: MpPipeSizes.nominals },
    { kind: 'length', key: 'm1', label: 'Длина', min: 0.001, max: 0.3, step: 0.0005 },
  ];

  private readonly sleeves = new SleeveGeometryBuilder();
  private readonly ends = new MpPressEnd(this.sleeves);

  validate(params: MpCouplingParams): ValidationError[] {
    const errors = ParamSchema.validate(this.paramSpecs, params);
    if (errors.length === 0) {
      // Трубы между гильзами (s1, s3 в gl2) были бы нулевой или отрицательной длины.
      const longest = Math.max(...[params.r1, params.r3].map((r) => MpPressEnd.pressLength(MpPipeSizes.diameters(r)!)));
      if (params.m1 / 2 <= longest) errors.push(ParamSchema.tooShort('m1', 2 * longest));
    }
    return errors;
  }

  build(params: MpCouplingParams): GeneratedModel {
    const errors = this.validate(params);
    if (errors.length > 0) throw new GeneratorParamsError(this.id, errors);

    const d1 = MpPipeSizes.diameters(params.r1)!;
    const d3 = MpPipeSizes.diameters(params.r3)!;
    const dc = d1.n >= d3.n ? d1 : d3;

    const merger = new MaterialGroupMerger();
    merger.add(...this.ends.buildRun(params.m1, d1, d3, dc));

    // Торцы — концы гильз (±m1/2), глубина — длина гильзы. В gl2 точки стояли в центрах гильз.
    const common = { joint: 'mp-press', gender: 'internal' } as const;
    const { left, right } = ConnectorFrame;
    return MeshModel.create({
      title: params.r1 === params.r3 ? `Соединитель ${params.r1}` : `Соединитель ${params.r1}x${params.r3}`,
      ...merger.merge(),
      connectors: [
        { id: 'left', position: ConnectorFrame.point(left, params.m1 / 2), ...left, depth: MpPressEnd.pressLength(d1), nominal: params.r1, ...common },
        { id: 'right', position: ConnectorFrame.point(right, params.m1 / 2), ...right, depth: MpPressEnd.pressLength(d3), nominal: params.r3, ...common },
      ],
    });
  }
}
