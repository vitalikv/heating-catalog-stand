import type { GeneratedModel, ModelGenerator, ParamSpec, ValidationError } from '../contracts';
import { GeneratorParamsError } from '../GeneratorParamsError';
import { MaterialGroupMerger } from '../geometry/MaterialGroupMerger';
import { SleeveGeometryBuilder } from '../geometry/SleeveGeometryBuilder';
import type { SleeveShape } from '../geometry/SleeveGeometryBuilder';
import type { MaterialLibrary } from '../materials/MaterialLibrary';
import { ParamSchema } from '../params/ParamSchema';
import { ThreadSizes } from '../sizes/ThreadSizes';
import { ConnectorFrame } from './ConnectorFrame';
import { MeshModel } from './MeshModel';

/** Параметры в формате cdm из gl2. */
export interface StrainerParams {
  /** Номинал внутренней резьбы концов, например '3/4'. */
  r1: string;
  /** Длина фильтра, м. */
  m1: number;
}

/** Длина резьбы — 0,4 наружного диаметра, не меньше 12 мм. */
const MIN_THREAD_LENGTH = 0.012;
/** Описанный диаметр гайки — n × 1.236. */
const NUT_SCALE = 1.236;
const HEX_SEGMENTS = 6;
/** Наклон отстойника. */
const SUMP_TURN = -Math.PI / 4;

/** Косой фильтр: прямой корпус с резьбой на концах и отстойник под 45° с крышкой (перенос filtr_kosoy_1). */
export class StrainerGenerator implements ModelGenerator<StrainerParams> {
  readonly id = 'filtr_kosoy_1';
  readonly title = 'Фильтр косой';
  readonly paramSpecs: readonly ParamSpec[] = [
    { kind: 'choice', key: 'r1', label: 'Резьба (в)', options: ThreadSizes.nominals },
    { kind: 'length', key: 'm1', label: 'Длина', min: 0.001, max: 0.3, step: 0.0005 },
  ];

  private readonly sleeves = new SleeveGeometryBuilder();

  constructor(private readonly materials: MaterialLibrary) {}

  validate(params: StrainerParams): ValidationError[] {
    const errors = ParamSchema.validate(this.paramSpecs, params);
    // Корпус между резьбами нулевой длины считается ошибкой.
    if (errors.length === 0) {
      const x1 = this.threadLength(params.r1);
      if (params.m1 <= 2 * x1) errors.push(ParamSchema.tooShort('m1', 2 * x1));
    }
    return errors;
  }

  build(params: StrainerParams): GeneratedModel {
    const errors = this.validate(params);
    if (errors.length > 0) throw new GeneratorParamsError(this.id, errors);

    const d1 = ThreadSizes.diameters(params.r1, 'internal')!;
    const x1 = this.threadLength(params.r1);
    const s1 = params.m1 - x1 * 2;
    // Отстойник: длина трубы, толщина крышки и её гайки
    const s2 = (params.m1 / 2) * 1.3;
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
      ...this.sleeves.build({ material: 'metal', ...nut, center: at(-end) }),
      ...this.sleeves.build({ material: 'metal', ...thread, center: at(-end) }),
      ...this.sleeves.build({ material: 'metal', length: s1, outerDiameter: d1.n, innerDiameter: d1.v }),
      ...this.sleeves.build({ material: 'metal', ...thread, center: at(end) }),
      ...this.sleeves.build({ material: 'metal', ...nut, center: at(end) }),
      ...this.sleeves.build({ material: 'metal', length: s2, outerDiameter: d1.n + 0.003, innerDiameter: d1.v, ...sump(s2 / 2) }),
      // Крышка и её гайка — сплошные
      ...this.sleeves.build({ material: 'metal', length: s3, outerDiameter: d1.n * 1.2, innerDiameter: 0, ...sump(s2 + s3 / 2) }),
      ...this.sleeves.build({ material: 'metal', length: s4, outerDiameter: d1.n, innerDiameter: 0, outerSegments: HEX_SEGMENTS, materials: { outer: 'metalFlat' }, ...sump(s2 + s3 + s4 / 2) }),
    );

    // Торцы — концы резьбы, глубина — длина резьбы. В gl2 точки — в центрах резьбы.
    const common = { depth: x1, nominal: params.r1, joint: 'thread', gender: 'internal' } as const;
    return MeshModel.create({
      title: `Фильтр косой ${params.r1}(в-в)`,
      ...merger.merge(),
      connectors: [
        { id: 'left', position: at(-(s1 / 2 + x1)), ...ConnectorFrame.left, ...common },
        { id: 'right', position: at(s1 / 2 + x1), ...ConnectorFrame.right, ...common },
      ],
    }, this.materials);
  }

  /** Вызывать только для известного номинала. */
  private threadLength(nominal: string): number {
    return Math.max(0.02 * ThreadSizes.diameters(nominal, 'internal')!.n * 20, MIN_THREAD_LENGTH);
  }
}
