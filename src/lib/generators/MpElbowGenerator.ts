import type { GeneratedModel, ModelGenerator, ParamSpec, ValidationError } from '../contracts';
import { GeneratorParamsError } from '../GeneratorParamsError';
import { MaterialGroupMerger } from '../geometry/MaterialGroupMerger';
import { SleeveGeometryBuilder } from '../geometry/SleeveGeometryBuilder';
import { SphereGeometryBuilder } from '../geometry/SphereGeometryBuilder';
import type { MaterialLibrary } from '../materials/MaterialLibrary';
import { ParamSchema } from '../params/ParamSchema';
import { MpPipeSizes } from '../sizes/MpPipeSizes';
import { ConnectorFrame } from './ConnectorFrame';
import { MeshModel } from './MeshModel';
import { MpPressEnd } from './MpPressEnd';

/** Параметры в формате cdm из gl2. */
export interface MpElbowParams {
  /** Наружный диаметр металлопластиковой трубы, мм, строкой: '16', '20'… */
  r1: string;
  /** Длина плеча от оси до конца пресс-гильзы, м. */
  m1: number;
}

/**
 * Металлопластиковый угол 90° под пресс (перенос mpl_ugol_1): плечи по +X и +Y
 * с пресс-концами, внешний угол — четверть сферы.
 */
export class MpElbowGenerator implements ModelGenerator<MpElbowParams> {
  readonly id = 'mpl_ugol_1';
  readonly title = 'Угол металлопластиковый';
  readonly paramSpecs: readonly ParamSpec[] = [
    { kind: 'choice', key: 'r1', label: 'Труба, мм', options: MpPipeSizes.nominals },
    { kind: 'length', key: 'm1', label: 'Длина плеча', min: 0.001, max: 0.2, step: 0.0005 },
  ];

  private readonly sleeves = new SleeveGeometryBuilder();
  private readonly spheres = new SphereGeometryBuilder();
  private readonly ends = new MpPressEnd(this.sleeves);

  constructor(private readonly materials: MaterialLibrary) {}

  validate(params: MpElbowParams): ValidationError[] {
    const errors = ParamSchema.validate(this.paramSpecs, params);
    if (errors.length === 0) {
      // Плечо до гильзы (s1 в gl2) было бы нулевой или отрицательной длины.
      const w1 = MpPressEnd.pressLength(MpPipeSizes.diameters(params.r1)!);
      if (params.m1 <= w1) errors.push(ParamSchema.tooShort('m1', w1));
    }
    return errors;
  }

  build(params: MpElbowParams): GeneratedModel {
    const errors = this.validate(params);
    if (errors.length > 0) throw new GeneratorParamsError(this.id, errors);

    const d = MpPipeSizes.diameters(params.r1)!;
    const w1 = MpPressEnd.pressLength(d);
    const s1 = params.m1 - w1;
    const pipe = { outerDiameter: d.n, innerDiameter: d.v, length: s1 };
    const quarter = { phiLength: Math.PI / 2, rotation: { x: Math.PI / 2, y: 0, z: 0 } };

    const merger = new MaterialGroupMerger();
    merger.add(
      ...this.ends.build(d, s1, w1, MpPressEnd.right),
      ...this.sleeves.build({ material: 'bronze', ...pipe, center: { x: s1 / 2, y: 0, z: 0 } }),
      ...this.sleeves.build({ material: 'bronze', ...pipe, center: { x: 0, y: s1 / 2, z: 0 }, rotation: { x: 0, y: 0, z: -Math.PI / 2 } }),
      ...this.ends.build(d, s1, w1, MpPressEnd.top),
      this.spheres.build({ material: 'bronze', ...quarter, radius: d.n / 2 }),
      this.spheres.build({ material: 'bronze', ...quarter, radius: d.v / 2 }),
    );

    // Торец — конец пресс-гильзы, глубина — её длина. В gl2 точки стояли в центрах гильз.
    const common = { depth: w1, nominal: params.r1, joint: 'mp-press', gender: 'internal' } as const;
    return MeshModel.create({
      title: `Угол ${params.r1}`,
      ...merger.merge(),
      connectors: [
        { id: 'right', position: ConnectorFrame.point(ConnectorFrame.right, params.m1), ...ConnectorFrame.right, ...common },
        { id: 'top', position: ConnectorFrame.point(ConnectorFrame.top, params.m1), ...ConnectorFrame.top, ...common },
      ],
    }, this.materials);
  }

}
