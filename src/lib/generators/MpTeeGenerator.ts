import type { GeneratedModel, ModelGenerator, ParamSpec, ValidationError } from '../contracts';
import { GeneratorParamsError } from '../GeneratorParamsError';
import { MaterialGroupMerger } from '../geometry/MaterialGroupMerger';
import { SleeveGeometryBuilder } from '../geometry/SleeveGeometryBuilder';
import type { MaterialLibrary } from '../materials/MaterialLibrary';
import { ParamSchema } from '../params/ParamSchema';
import { MpPipeSizes } from '../sizes/MpPipeSizes';
import { ConnectorFrame } from './ConnectorFrame';
import { MeshModel } from './MeshModel';
import { MpPressEnd } from './MpPressEnd';

/** Параметры в формате cdm из gl2. */
export interface MpTeeParams {
  /** Наружные диаметры металлопластиковых труб: слева, отвод, справа; мм, строкой. */
  r1: string;
  r2: string;
  r3: string;
  /** Длина прохода, м. */
  m1: number;
  /** Высота отвода от оси прохода до конца гильзы, м. */
  m2: number;
}

/** Металлопластиковый тройник под пресс, в том числе переходной (перенос mpl_troinik_1). */
export class MpTeeGenerator implements ModelGenerator<MpTeeParams> {
  readonly id = 'mpl_troinik_1';
  readonly title = 'Тройник металлопластиковый';
  readonly paramSpecs: readonly ParamSpec[] = [
    { kind: 'choice', key: 'r1', label: 'Слева, мм', options: MpPipeSizes.nominals },
    { kind: 'choice', key: 'r2', label: 'Отвод, мм', options: MpPipeSizes.nominals },
    { kind: 'choice', key: 'r3', label: 'Справа, мм', options: MpPipeSizes.nominals },
    { kind: 'length', key: 'm1', label: 'Длина прохода', min: 0.001, max: 0.3, step: 0.0005 },
    { kind: 'length', key: 'm2', label: 'Высота отвода', min: 0.001, max: 0.2, step: 0.0005 },
  ];

  private readonly sleeves = new SleeveGeometryBuilder();
  private readonly ends = new MpPressEnd(this.sleeves);

  constructor(private readonly materials: MaterialLibrary) {}

  validate(params: MpTeeParams): ValidationError[] {
    const errors = ParamSchema.validate(this.paramSpecs, params);
    if (errors.length === 0) {
      // Трубы до гильз (s1, s2, s3 в gl2) были бы нулевой или отрицательной длины.
      const press = (r: string) => MpPressEnd.pressLength(MpPipeSizes.diameters(r)!);
      const run = Math.max(press(params.r1), press(params.r3));
      if (params.m1 / 2 <= run) errors.push(ParamSchema.tooShort('m1', 2 * run));
      if (params.m2 <= press(params.r2)) errors.push(ParamSchema.tooShort('m2', press(params.r2)));
    }
    return errors;
  }

  build(params: MpTeeParams): GeneratedModel {
    const errors = this.validate(params);
    if (errors.length > 0) throw new GeneratorParamsError(this.id, errors);

    const [d1, d2, d3] = [params.r1, params.r2, params.r3].map((r) => MpPipeSizes.diameters(r)!);
    const dc = [d1, d2, d3].reduce((max, d) => (d.n > max.n ? d : max));
    const w2 = MpPressEnd.pressLength(d2);
    const s2 = (params.m2 - w2) / 2;

    const merger = new MaterialGroupMerger();
    merger.add(
      ...this.ends.buildRun(params.m1, d1, d3, dc),
      // Отвод: конус от наибольшего диаметра, труба, пресс-конец
      ...this.sleeves.build({
        length: s2,
        outerDiameter: dc.n,
        innerDiameter: dc.v,
        outerDiameterStart: d2.n,
        innerDiameterStart: d2.v,
        center: { x: 0, y: s2 / 2, z: 0 },
        rotation: { x: 0, y: 0, z: -Math.PI / 2 },
      }),
      ...this.sleeves.build({ length: s2, outerDiameter: d2.n, innerDiameter: d2.v, ...MpPressEnd.top(1.5 * s2) }),
      ...this.ends.build(d2, 2 * s2, w2, MpPressEnd.top),
    );

    // Торцы — концы гильз, глубина — длина гильзы. В gl2 точки стояли в центрах гильз.
    const common = { joint: 'mp-press', gender: 'internal' } as const;
    const { left, top, right } = ConnectorFrame;
    const names = [params.r1, params.r2, params.r3];
    return MeshModel.create({
      title: new Set(names).size === 1 ? `Тройник ${params.r1}` : `Тройник ${names.join('x')}`,
      geometry: merger.merge(),
      materials: MpPressEnd.meshMaterials(this.materials),
      connectors: [
        { id: 'left', position: ConnectorFrame.point(left, params.m1 / 2), ...left, depth: MpPressEnd.pressLength(d1), nominal: params.r1, ...common },
        { id: 'top', position: ConnectorFrame.point(top, params.m2), ...top, depth: w2, nominal: params.r2, ...common },
        { id: 'right', position: ConnectorFrame.point(right, params.m1 / 2), ...right, depth: MpPressEnd.pressLength(d3), nominal: params.r3, ...common },
      ],
    });
  }
}
