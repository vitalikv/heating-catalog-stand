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

export interface StrainerParams {
  /** Номинал внутренней резьбы концов, например '3/4'. */
  nominal: string;
  /** Длина фильтра, м. */
  length: number;
}

/** Длина резьбы — 0,4 наружного диаметра, не меньше 12 мм. */
const MIN_THREAD_LENGTH = 0.012;
/** Описанный диаметр гайки — n × 1.236. */
const NUT_SCALE = 1.236;
const HEX_SEGMENTS = 6;
/** Наклон отстойника. */
const SUMP_TURN = -Math.PI / 4;

/** Диаметры резьбы и длина резьбового участка (x_1). */
interface StrainerLayout {
  d1: PartDiameters;
  x1: number;
}

/** Косой фильтр: прямой корпус с резьбой на концах и отстойник под 45° с крышкой (перенос filtr_kosoy_1). */
export class StrainerGenerator extends BaseGenerator<StrainerParams, StrainerLayout> {
  readonly id = 'equipment.strainer';
  readonly version = 1;
  readonly title = 'Фильтр косой';
  readonly paramSpecs: readonly ParamSpec[] = [
    specs.threadNominal('nominal', 'Резьба (в)'),
    specs.length('length', 'Длина', { max: 0.3 }),
  ];
  readonly defaults: StrainerParams = { nominal: '1/2', length: 0.053 };

  protected override layout(params: StrainerParams): StrainerLayout {
    const d1 = ThreadSizes.require(params.nominal, 'internal');
    return { d1, x1: Math.max(0.02 * d1.n * 20, MIN_THREAD_LENGTH) };
  }

  protected override relations(params: StrainerParams, { x1 }: StrainerLayout): ValidationError[] {
    // Корпус между резьбами нулевой длины считается ошибкой.
    return params.length <= 2 * x1 ? [ParamSchema.tooShort('length', 2 * x1)] : [];
  }

  protected create(params: StrainerParams, { d1, x1 }: StrainerLayout): GeneratedModel {
    const s1 = params.length - x1 * 2;
    // Отстойник: длина трубы, толщина крышки и её гайки
    const s2 = (params.length / 2) * 1.3;
    const s3 = 0.005 * d1.n * 20;
    const s4 = 0.009 * d1.n * 20;
    const at = (x: number) => ({ x, y: 0, z: 0 });
    const end = s1 / 2 + x1 / 2;
    const nut = { length: x1, outerDiameter: d1.n * NUT_SCALE, innerDiameter: d1.v + 0.001, outerSegments: HEX_SEGMENTS, materials: { outer: 'metalFlat' } } satisfies Partial<SleeveShape>;
    const thread = { length: x1, outerDiameter: d1.n, innerDiameter: d1.v, materials: { inner: 'thread' } } satisfies Partial<SleeveShape>;
    // Куски отстойника сдвигаются вдоль своей оси до поворота (pos1 в gl2).
    const sump = (shift: number) => ({ offset: at(-shift), rotation: { x: 0, y: 0, z: SUMP_TURN }, center: at(s1 - d1.n) });

    const merger = new MaterialGroupMerger();
    merger.add(
      ...sleeves.build({ material: 'metal', ...nut, center: at(-end) }),
      ...sleeves.build({ material: 'metal', ...thread, center: at(-end) }),
      ...sleeves.build({ material: 'metal', length: s1, outerDiameter: d1.n, innerDiameter: d1.v }),
      ...sleeves.build({ material: 'metal', ...thread, center: at(end) }),
      ...sleeves.build({ material: 'metal', ...nut, center: at(end) }),
      ...sleeves.build({ material: 'metal', length: s2, outerDiameter: d1.n + 0.003, innerDiameter: d1.v, ...sump(s2 / 2) }),
      // Крышка и её гайка — сплошные
      ...sleeves.build({ material: 'metal', length: s3, outerDiameter: d1.n * 1.2, innerDiameter: 0, ...sump(s2 + s3 / 2) }),
      ...sleeves.build({ material: 'metal', length: s4, outerDiameter: d1.n, innerDiameter: 0, outerSegments: HEX_SEGMENTS, materials: { outer: 'metalFlat' }, ...sump(s2 + s3 + s4 / 2) }),
    );

    // Торцы — концы резьбы, глубина — длина резьбы. В gl2 точки — в центрах резьбы.
    const common = { depth: x1, nominal: params.nominal, joint: 'thread', gender: 'internal' } as const;
    return createMeshModel({
      title: `Фильтр косой ${params.nominal}(в-в)`,
      ...merger.merge(),
      connectors: [
        connector('left', ConnectorFrame.left, s1 / 2 + x1, common),
        connector('right', ConnectorFrame.right, s1 / 2 + x1, common),
      ],
    });
  }
}
