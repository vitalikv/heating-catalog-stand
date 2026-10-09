import { BaseGenerator } from '../../core/BaseGenerator';
import { connector } from '../../core/connector';
import { ConnectorFrame } from '../../core/ConnectorFrame';
import type { GeneratedModel, ParamSpec, ValidationError } from '../../core/contracts';
import { createMeshModel } from '../../core/MeshModel';
import { MaterialGroupMerger } from '../../geometry/MaterialGroupMerger';
import { sleeves } from '../../geometry/SleeveGeometryBuilder';
import type { SleeveShape } from '../../geometry/SleeveGeometryBuilder';
import { ParamSchema } from '../../params/ParamSchema';
import { specs } from '../../params/specs';
import { ThreadSizes } from '../../sizes/ThreadSizes';
import type { PartDiameters } from '../../sizes/ThreadSizes';

/** Параметры в формате cdm из gl2. */
export interface SteelNippleParams {
  /** Дюймовый номинал наружной резьбы слева, например '1/2'. */
  r1: string;
  /** Номинал справа. */
  r2: string;
  /** Длина ниппеля, м. */
  m1: number;
}

/** Длина резьбового участка — 0,3 наружного диаметра в пределах 8…12 мм. */
const MIN_THREAD_LENGTH = 0.008;
const MAX_THREAD_LENGTH = 0.012;
const HEX_SEGMENTS = 6;

interface NippleLayout {
  d1: PartDiameters;
  d2: PartDiameters;
  /** Длины резьбовых участков слева и справа. */
  x1: number;
  x2: number;
}

/** Стальной ниппель с наружной резьбой с двух сторон (перенос st_nippel_1). */
export class SteelNippleGenerator extends BaseGenerator<SteelNippleParams, NippleLayout> {
  readonly id = 'st_nippel_1';
  readonly title = 'Ниппель стальной';
  readonly paramSpecs: readonly ParamSpec[] = [
    specs.threadNominal('r1', 'Резьба слева'),
    specs.threadNominal('r2', 'Резьба справа'),
    specs.length('m1', 'Длина'),
  ];

  protected override layout(params: SteelNippleParams): NippleLayout {
    const d1 = ThreadSizes.require(params.r1, 'external');
    const d2 = ThreadSizes.require(params.r2, 'external');
    const threadLength = (d: PartDiameters) => Math.min(Math.max(0.015 * d.n * 20, MIN_THREAD_LENGTH), MAX_THREAD_LENGTH);
    return { d1, d2, x1: threadLength(d1), x2: threadLength(d2) };
  }

  protected override relations(params: SteelNippleParams, { x1, x2 }: NippleLayout): ValidationError[] {
    // Гладкий участок нулевой длины считается ошибкой, как у муфты.
    const thread = Math.max(x1, x2);
    return params.m1 / 2 <= thread ? [ParamSchema.tooShort('m1', 2 * thread)] : [];
  }

  protected create(params: SteelNippleParams, { d1, d2, x1, x2 }: NippleLayout): GeneratedModel {
    const x3L = params.m1 / 2 - x1;
    const x3R = params.m1 / 2 - x2;
    const maxN = Math.max(d1.n, d2.n);
    const at = (x: number) => ({ x, y: 0, z: 0 });
    const thread: Partial<SleeveShape> = { materials: { outer: 'thread' } };

    const merger = new MaterialGroupMerger();
    merger.add(
      // Резьба и гладкая часть слева
      ...sleeves.build({ material: 'metal', ...thread, length: x1, outerDiameter: d1.n, innerDiameter: d1.v, center: at(-(x3L + x1 / 2)) }),
      ...sleeves.build({ material: 'metal', length: x3L, outerDiameter: d1.n, innerDiameter: d1.v, center: at(-x3L / 2) }),
      // Шестигранник: длина n/7, описанный диаметр n + n/4
      ...sleeves.build({
        material: 'metal',
        length: maxN / 7,
        outerDiameter: maxN + maxN / 4,
        innerDiameter: Math.min(d1.v, d2.v) + 0.001,
        outerSegments: HEX_SEGMENTS,
      }),
      // Гладкая часть и резьба справа
      ...sleeves.build({ material: 'metal', length: x3R, outerDiameter: d2.n, innerDiameter: d2.v, center: at(x3R / 2) }),
      ...sleeves.build({ material: 'metal', ...thread, length: x2, outerDiameter: d2.n, innerDiameter: d2.v, center: at(x3R + x2 / 2) }),
    );

    // Торцы — концы резьбы (±m1/2), глубина — длина резьбового участка.
    // В gl2 точка разъёма стояла в центре резьбового участка.
    const common = { joint: 'thread', gender: 'external' } as const;
    return createMeshModel({
      title: params.r1 === params.r2 ? `Ниппель ${params.r1}(н)` : `Ниппель ${params.r1}(н)х${params.r2}(н)`,
      ...merger.merge(),
      connectors: [
        connector('left', ConnectorFrame.left, params.m1 / 2, { depth: x1, nominal: params.r1, ...common }),
        connector('right', ConnectorFrame.right, params.m1 / 2, { depth: x2, nominal: params.r2, ...common }),
      ],
    });
  }
}
