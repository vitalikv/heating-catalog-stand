import { BaseGenerator } from '../../core/BaseGenerator';
import { connector } from '../../core/connector';
import { ConnectorFrame } from '../../core/ConnectorFrame';
import type { GeneratedModel, ParamSpec, ValidationError } from '../../core/contracts';
import { createMeshModel } from '../../core/MeshModel';
import { MaterialGroupMerger } from '../../geometry/MaterialGroupMerger';
import { sleeves } from '../../geometry/SleeveGeometryBuilder';
import type { SleeveMaterials } from '../../geometry/SleeveGeometryBuilder';
import { ParamSchema } from '../../params/ParamSchema';
import { specs } from '../../params/specs';
import { ThreadSizes } from '../../sizes/ThreadSizes';
import type { PartDiameters } from '../../sizes/ThreadSizes';

/** Параметры в формате cdm из gl2, чтобы наборы каталога переносились как есть. */
export interface SteelCouplingParams {
  /** Дюймовый номинал внутренней резьбы слева, например '1/2'. */
  r1: string;
  /** Номинал справа. */
  r2: string;
  /** Длина муфты, м. */
  m1: number;
}

const MIN_THREAD_LENGTH = 0.012;
/** Запас ширины колец по диаметру, м. */
const RING_OUTER_EXTRA = 0.002;
const RING_INNER_EXTRA = 0.001;

/** Размеры муфты по формулам st_mufta_1. */
interface CouplingLayout {
  d1: PartDiameters;
  d2: PartDiameters;
  /** Длины резьбовых участков слева и справа. */
  x1: number;
  x2: number;
  /** Длины гладких участков слева и справа. */
  x3L: number;
  x3R: number;
  /** Ширина колец и центральной втулки. */
  x4: number;
}

/** Стальная муфта с внутренней резьбой с двух сторон (перенос st_mufta_1). */
export class SteelCouplingGenerator extends BaseGenerator<SteelCouplingParams, CouplingLayout> {
  readonly id = 'st_mufta_1';
  readonly title = 'Муфта стальная';
  readonly paramSpecs: readonly ParamSpec[] = [
    specs.threadNominal('r1', 'Резьба слева'),
    specs.threadNominal('r2', 'Резьба справа'),
    specs.length('m1', 'Длина'),
  ];

  protected override layout(params: SteelCouplingParams): CouplingLayout {
    const d1 = ThreadSizes.require(params.r1, 'internal');
    const d2 = ThreadSizes.require(params.r2, 'internal');
    const x1 = Math.max(0.015 * d1.n * 20, MIN_THREAD_LENGTH);
    const x2 = Math.max(0.015 * d2.n * 20, MIN_THREAD_LENGTH);
    return { d1, d2, x1, x2, x3L: params.m1 / 2 - x1, x3R: params.m1 / 2 - x2, x4: Math.max(d1.n, d2.n) / 7 };
  }

  protected override relations(_params: SteelCouplingParams, { x1, x2, x3L, x3R }: CouplingLayout): ValidationError[] {
    // Гладкий участок нулевой длины считается ошибкой.
    return x3L <= 0 || x3R <= 0 ? [ParamSchema.tooShort('m1', 2 * Math.max(x1, x2))] : [];
  }

  protected create(params: SteelCouplingParams, { d1, d2, x1, x2, x3L, x3R, x4 }: CouplingLayout): GeneratedModel {
    const threadMaterials: Partial<SleeveMaterials> = { inner: 'thread' };
    const at = (x: number) => ({ x, y: 0, z: 0 });

    const merger = new MaterialGroupMerger();
    merger.add(
      // Кольцо слева
      ...sleeves.build({ material: 'metal', length: x4, outerDiameter: d1.n + RING_OUTER_EXTRA, innerDiameter: d1.v + RING_INNER_EXTRA, center: at(-(x3L + x1)) }),
      // Резьба и гладкая часть слева
      ...sleeves.build({ material: 'metal', length: x1, outerDiameter: d1.n, innerDiameter: d1.v, center: at(-(x3L + x1 / 2)), materials: threadMaterials }),
      ...sleeves.build({ material: 'metal', length: x3L, outerDiameter: d1.n, innerDiameter: d1.v, center: at(-x3L / 2) }),
      // Центр
      ...sleeves.build({ material: 'metal', length: x4, outerDiameter: Math.max(d1.n, d2.n), innerDiameter: Math.min(d1.v, d2.v) }),
      // Гладкая часть и резьба справа
      ...sleeves.build({ material: 'metal', length: x3R, outerDiameter: d2.n, innerDiameter: d2.v, center: at(x3R / 2) }),
      ...sleeves.build({ material: 'metal', length: x2, outerDiameter: d2.n, innerDiameter: d2.v, center: at(x3R + x2 / 2), materials: threadMaterials }),
      // Кольцо справа; в gl2 стоит в x_3L + x_1, что равно m1/2 = x_3R + x_2
      ...sleeves.build({ material: 'metal', length: x4, outerDiameter: d2.n + RING_OUTER_EXTRA, innerDiameter: d2.v + RING_INNER_EXTRA, center: at(x3R + x2) }),
    );

    // Торец — наружная грань кольца (m1/2 + x_4/2); резьба идёт от него до гладкого участка.
    // В gl2 точка разъёма стояла в центре резьбового участка.
    const face = params.m1 / 2 + x4 / 2;
    const common = { joint: 'thread', gender: 'internal' } as const;
    return createMeshModel({
      title: params.r1 === params.r2 ? `Муфта ${params.r1}(в)` : `Муфта ${params.r1}(в)х${params.r2}(в)`,
      ...merger.merge(),
      connectors: [
        connector('left', ConnectorFrame.left, face, { depth: face - x3L, nominal: params.r1, ...common }),
        connector('right', ConnectorFrame.right, face, { depth: face - x3R, nominal: params.r2, ...common }),
      ],
    });
  }
}
