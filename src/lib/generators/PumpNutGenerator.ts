import type { GeneratedModel, ModelGenerator, ParamSpec, ValidationError } from '../contracts';
import { GeneratorParamsError } from '../GeneratorParamsError';
import { MaterialGroupMerger } from '../geometry/MaterialGroupMerger';
import { SleeveGeometryBuilder } from '../geometry/SleeveGeometryBuilder';
import type { MaterialLibrary } from '../materials/MaterialLibrary';
import { ParamSchema } from '../params/ParamSchema';
import { ThreadSizes } from '../sizes/ThreadSizes';
import { ConnectorFrame } from './ConnectorFrame';
import { MeshModel } from './MeshModel';

/** Параметры в формате cdm из gl2 (m1 в gl2 передаётся, но на геометрию не влияет). */
export interface PumpNutParams {
  /** Внутренняя резьба со стороны насоса (слева), например '1 1/4'. */
  r1: string;
  /** Внутренняя резьба со стороны трубы (справа), например '1'. */
  r2: string;
}

/** Длина гайки — 0,3 наружного диаметра резьбы, не меньше 12 мм. */
const MIN_NUT_LENGTH = 0.012;
/** Перемычка между гайками, м. */
const WEB = 0.001;
/** Толщина гайки — 0,236 n. */
const NUT_WALL = 0.236;
const HEX_SEGMENTS = 6;

/** Индексы материалов меша. */
const THREAD = 1;
const METAL_FLAT = 2;

/** Гайка для насоса: две шестигранные гайки с внутренней резьбой (перенос cr_gaika_nasos_1). */
export class PumpNutGenerator implements ModelGenerator<PumpNutParams> {
  readonly id = 'cr_gaika_nasos_1';
  readonly title = 'Гайка для насоса';
  readonly paramSpecs: readonly ParamSpec[] = [
    { kind: 'choice', key: 'r1', label: 'Резьба к насосу (в)', options: ThreadSizes.nominals },
    { kind: 'choice', key: 'r2', label: 'Резьба к трубе (в)', options: ThreadSizes.nominals },
  ];

  private readonly sleeves = new SleeveGeometryBuilder();

  constructor(private readonly materials: MaterialLibrary) {}

  validate(params: PumpNutParams): ValidationError[] {
    return ParamSchema.validate(this.paramSpecs, params);
  }

  build(params: PumpNutParams): GeneratedModel {
    const errors = this.validate(params);
    if (errors.length > 0) throw new GeneratorParamsError(this.id, errors);

    const d1 = ThreadSizes.diameters(params.r1, 'internal')!;
    const d2 = ThreadSizes.diameters(params.r2, 'internal')!;
    const x1 = Math.max(0.015 * d1.n * 20, MIN_NUT_LENGTH);
    const x2 = Math.max(0.015 * d2.n * 20, MIN_NUT_LENGTH);
    const at = (x: number) => ({ x, y: 0, z: 0 });
    const nut = { outerSegments: HEX_SEGMENTS, materials: { outer: METAL_FLAT, inner: THREAD, start: METAL_FLAT, end: METAL_FLAT } };

    const merger = new MaterialGroupMerger();
    merger.add(
      ...this.sleeves.build({ ...nut, length: x1, outerDiameter: d1.n * (1 + NUT_WALL), innerDiameter: d1.v, center: at(-x1 / 2) }),
      // Перемычка: наружный — внутренний диаметр гайки с большим n, внутренний — меньший v − 1 мм
      ...this.sleeves.build({ length: WEB, outerDiameter: d1.n > d2.n ? d1.v : d2.v, innerDiameter: Math.min(d1.v, d2.v) - 0.001, center: at(-WEB / 2) }),
      ...this.sleeves.build({ ...nut, length: x2, outerDiameter: d2.n * (1 + NUT_WALL), innerDiameter: d2.v, center: at(x2 / 2) }),
    );

    // Торцы — открытые края гаек, глубина — длина гайки. В gl2 точки — в центрах гаек.
    const common = { joint: 'thread', gender: 'internal' } as const;
    return MeshModel.create({
      title: `Гайка для насоса ${params.r1}(в)х${params.r2}(в)`,
      geometry: merger.merge(),
      materials: [this.materials.get('metal'), this.materials.get('thread'), this.materials.get('metalFlat')],
      connectors: [
        { id: 'pump', position: at(-x1), ...ConnectorFrame.left, depth: x1, nominal: params.r1, ...common },
        { id: 'pipe', position: at(x2), ...ConnectorFrame.right, depth: x2, nominal: params.r2, ...common },
      ],
    });
  }
}
