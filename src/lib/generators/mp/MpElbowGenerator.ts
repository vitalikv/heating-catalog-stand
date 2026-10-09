import { BaseGenerator } from '../../core/BaseGenerator';
import { connector } from '../../core/connector';
import { ConnectorFrame } from '../../core/ConnectorFrame';
import type { GeneratedModel, ParamSpec, ValidationError } from '../../core/contracts';
import { createMeshModel } from '../../core/MeshModel';
import { MaterialGroupMerger } from '../../geometry/MaterialGroupMerger';
import { sleeves } from '../../geometry/SleeveGeometryBuilder';
import { spheres } from '../../geometry/SphereGeometryBuilder';
import { ParamSchema } from '../../params/ParamSchema';
import { specs } from '../../params/specs';
import { MpPipeSizes } from '../../sizes/MpPipeSizes';
import type { PartDiameters } from '../../sizes/ThreadSizes';
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
export class MpElbowGenerator extends BaseGenerator<MpElbowParams, PartDiameters> {
  readonly id = 'mpl_ugol_1';
  readonly title = 'Угол металлопластиковый';
  readonly paramSpecs: readonly ParamSpec[] = [
    specs.mpNominal('r1'),
    specs.length('m1', 'Длина плеча'),
  ];

  private readonly ends = new MpPressEnd();

  protected override layout(params: MpElbowParams): PartDiameters {
    return MpPipeSizes.require(params.r1);
  }

  protected override relations(params: MpElbowParams, d: PartDiameters): ValidationError[] {
    // Плечо до гильзы (s1 в gl2) было бы нулевой или отрицательной длины.
    const w1 = MpPressEnd.pressLength(d);
    return params.m1 <= w1 ? [ParamSchema.tooShort('m1', w1)] : [];
  }

  protected create(params: MpElbowParams, d: PartDiameters): GeneratedModel {
    const w1 = MpPressEnd.pressLength(d);
    const s1 = params.m1 - w1;
    const pipe = { outerDiameter: d.n, innerDiameter: d.v, length: s1 };
    const quarter = { phiLength: Math.PI / 2, rotation: { x: Math.PI / 2, y: 0, z: 0 } };

    const merger = new MaterialGroupMerger();
    merger.add(
      ...this.ends.build(d, s1, w1, MpPressEnd.right),
      ...sleeves.build({ material: 'bronze', ...pipe, center: { x: s1 / 2, y: 0, z: 0 } }),
      ...sleeves.build({ material: 'bronze', ...pipe, center: { x: 0, y: s1 / 2, z: 0 }, rotation: { x: 0, y: 0, z: -Math.PI / 2 } }),
      ...this.ends.build(d, s1, w1, MpPressEnd.top),
      spheres.build({ material: 'bronze', ...quarter, radius: d.n / 2 }),
      spheres.build({ material: 'bronze', ...quarter, radius: d.v / 2 }),
    );

    // Торец — конец пресс-гильзы, глубина — её длина. В gl2 точки стояли в центрах гильз.
    const common = { depth: w1, nominal: params.r1, joint: 'mp-press', gender: 'internal' } as const;
    return createMeshModel({
      title: `Угол ${params.r1}`,
      ...merger.merge(),
      connectors: [
        connector('right', ConnectorFrame.right, params.m1, common),
        connector('top', ConnectorFrame.top, params.m1, common),
      ],
    });
  }

}
