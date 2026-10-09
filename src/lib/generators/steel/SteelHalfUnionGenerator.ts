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
import type { PartDiameters } from '../../sizes/ThreadSizes';

export interface SteelHalfUnionParams {
  /** Номинал внутренней резьбы накидной гайки, например '3/4'. */
  nutNominal: string;
  /** Номинал наружной резьбы патрубка, например '1/2'. */
  pipeNominal: string;
  /** Длина от гайки до конца патрубка, м. */
  length: number;
}

/** Толщина колец (x_3, x_4 в gl2), м. */
const RING = 0.002;
/** Сдвиг начала патрубка от гайки (x_3L = −(x_4 + 0.001) в gl2), м. */
const NUT_SHIFT = RING + 0.001;
/** Описанный диаметр гайки — n × 1.236. */
const NUT_SCALE = 1.236;
const HEX_SEGMENTS = 6;

/** Размеры полусгона по формулам st_pol_sgon_1. */
interface HalfUnionLayout {
  /** Гайка (внутренняя резьба) и патрубок (наружная). */
  d1: PartDiameters;
  d2: PartDiameters;
  /** Длина резьбы гайки (x_1) и концевой резьбы патрубка (x_2). */
  x1: number;
  x2: number;
  /** Резьба патрубка перед концевой (x_5). */
  x5: number;
  /** Гладкий участок патрубка (x_3R). */
  x3R: number;
}

/** Стальной полусгон: накидная гайка с внутренней резьбой и патрубок с наружной (перенос st_pol_sgon_1). */
export class SteelHalfUnionGenerator extends BaseGenerator<SteelHalfUnionParams, HalfUnionLayout> {
  readonly id = 'steel.half-union';
  readonly version = 1;
  readonly title = 'Полусгон стальной';
  readonly paramSpecs: readonly ParamSpec[] = [
    specs.threadNominal('nutNominal', 'Резьба гайки (в)'),
    specs.threadNominal('pipeNominal', 'Резьба патрубка (н)'),
    specs.length('length', 'Длина'),
  ];
  readonly defaults: SteelHalfUnionParams = { nutNominal: '3/4', pipeNominal: '1/2', length: 0.04 };

  protected override layout(params: SteelHalfUnionParams): HalfUnionLayout {
    const d1 = ThreadSizes.require(params.nutNominal, 'internal');
    const d2 = ThreadSizes.require(params.pipeNominal, 'external');
    const x1 = 0.02 * d1.n * 20;
    const x2 = 0.02 * d2.n * 20;
    const x5 = x2 * 1.3;
    return { d1, d2, x1, x2, x5, x3R: params.length - x2 - x5 - RING };
  }

  protected override relations(_params: SteelHalfUnionParams, { x2, x5, x3R }: HalfUnionLayout): ValidationError[] {
    // Гладкий участок патрубка нулевой длины считается ошибкой.
    return x3R <= 0 ? [ParamSchema.tooShort('length', x2 + x5 + RING)] : [];
  }

  protected create(params: SteelHalfUnionParams, { d1, d2, x1, x2, x5, x3R }: HalfUnionLayout): GeneratedModel {
    const nut = { outerDiameter: d1.n * NUT_SCALE, outerSegments: HEX_SEGMENTS };
    const pipe = { outerDiameter: d2.n, innerDiameter: d2.v };
    const at = (x: number) => ({ x, y: 0, z: 0 });
    // Корпус гайки кончается в −(x_3L + x_3) = 0.001, дальше — кольцо-упор до 0.003.
    const nutEnd = NUT_SHIFT - RING;

    const merger = new MaterialGroupMerger();
    merger.add(
      // Гайка: резьбовая часть, гладкая часть и кольцо-упор вокруг патрубка
      ...sleeves.build({ material: 'metal', ...nut, length: x1, innerDiameter: d1.v, center: at(nutEnd - x1), materials: { outer: 'metalFlat', inner: 'thread' } }),
      ...sleeves.build({ material: 'metal', ...nut, length: x1 / 2, innerDiameter: d1.v, center: at(nutEnd - x1 / 4), materials: { outer: 'metalFlat' } }),
      ...sleeves.build({ material: 'metal', ...nut, length: RING, innerDiameter: d2.n + 0.001, center: at(NUT_SHIFT - RING / 2), materials: { outer: 'metalFlat' } }),
      // Патрубок: буртик, гладкая часть, две резьбовые части
      ...sleeves.build({ material: 'metal', length: RING, outerDiameter: d1.v, innerDiameter: d2.v - 0.001, center: at(RING / 2) }),
      ...sleeves.build({ material: 'metal', ...pipe, length: x3R, center: at(RING + x3R / 2) }),
      ...sleeves.build({ material: 'metal', ...pipe, length: x5, center: at(RING + x3R + x5 / 2), materials: { outer: 'thread' } }),
      ...sleeves.build({ material: 'metal', ...pipe, length: x2, center: at(RING + x3R + x5 + x2 / 2), materials: { outer: 'thread' } }),
    );

    // Торцы: открытый край гайки и конец патрубка. Глубина — резьба гайки и вся резьба патрубка.
    // В gl2 точки стояли в центрах резьбы гайки и концевой резьбы.
    return createMeshModel({
      title: `Полусгон ${params.pipeNominal}`,
      ...merger.merge(),
      connectors: [
        connector('nut', ConnectorFrame.left, at(nutEnd - 1.5 * x1), { depth: x1, nominal: params.nutNominal, joint: 'thread', gender: 'internal' }),
        connector('pipe', ConnectorFrame.right, params.length, { depth: x5 + x2, nominal: params.pipeNominal, joint: 'thread', gender: 'external' }),
      ],
    });
  }
}
