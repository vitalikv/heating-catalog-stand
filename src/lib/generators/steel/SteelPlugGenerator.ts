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

/** Параметры в формате cdm из gl2. */
export interface SteelPlugParams {
  /** Дюймовый номинал наружной резьбы, например '1/2'. */
  r1: string;
  /** Длина, как у ниппеля: заглушка — его левая половина, м. */
  m1: number;
}

/** Длина резьбового участка — 0,3 наружного диаметра в пределах 8…12 мм, как у ниппеля. */
const MIN_THREAD_LENGTH = 0.008;
const MAX_THREAD_LENGTH = 0.012;
const HEX_SEGMENTS = 6;

interface PlugLayout {
  d1: PartDiameters;
  /** Длина резьбового участка. */
  x1: number;
}

/** Стальная заглушка с наружной резьбой и сплошным шестигранником (перенос st_zagl_nr). */
export class SteelPlugGenerator extends BaseGenerator<SteelPlugParams, PlugLayout> {
  readonly id = 'st_zagl_nr';
  readonly title = 'Заглушка стальная (н)';
  readonly paramSpecs: readonly ParamSpec[] = [specs.threadNominal('r1', 'Резьба'), specs.length('m1', 'Длина')];

  protected override layout(params: SteelPlugParams): PlugLayout {
    const d1 = ThreadSizes.require(params.r1, 'external');
    return { d1, x1: Math.min(Math.max(0.015 * d1.n * 20, MIN_THREAD_LENGTH), MAX_THREAD_LENGTH) };
  }

  protected override relations(params: SteelPlugParams, { x1 }: PlugLayout): ValidationError[] {
    // Гладкий участок нулевой длины считается ошибкой, как у ниппеля.
    return params.m1 / 2 <= x1 ? [ParamSchema.tooShort('m1', 2 * x1)] : [];
  }

  protected create(params: SteelPlugParams, { d1, x1 }: PlugLayout): GeneratedModel {
    const x3L = params.m1 / 2 - x1;
    const at = (x: number) => ({ x, y: 0, z: 0 });

    const merger = new MaterialGroupMerger();
    merger.add(
      // Резьба и гладкая часть
      ...sleeves.build({ material: 'metal', length: x1, outerDiameter: d1.n, innerDiameter: d1.v, center: at(-(x3L + x1 / 2)), materials: { outer: 'thread' } }),
      ...sleeves.build({ material: 'metal', length: x3L, outerDiameter: d1.n, innerDiameter: d1.v, center: at(-x3L / 2) }),
      // Сплошной шестигранник: длина n/7, описанный диаметр n + n/4
      ...sleeves.build({ material: 'metal', length: d1.n / 7, outerDiameter: d1.n + d1.n / 4, innerDiameter: 0, outerSegments: HEX_SEGMENTS }),
    );

    // Торец — конец резьбы (−m1/2), глубина — длина резьбы. В gl2 точка — в центре резьбы.
    return createMeshModel({
      title: `Заглушка ${params.r1}(н)`,
      ...merger.merge(),
      connectors: [connector('left', ConnectorFrame.left, params.m1 / 2, { depth: x1, nominal: params.r1, joint: 'thread', gender: 'external' })],
    });
  }
}
