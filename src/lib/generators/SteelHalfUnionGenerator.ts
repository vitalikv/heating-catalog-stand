import type { GeneratedModel, ModelGenerator, ParamSpec, ValidationError } from '../contracts';
import { GeneratorParamsError } from '../GeneratorParamsError';
import { MaterialGroupMerger } from '../geometry/MaterialGroupMerger';
import { SleeveGeometryBuilder } from '../geometry/SleeveGeometryBuilder';
import type { MaterialLibrary } from '../materials/MaterialLibrary';
import { ParamSchema } from '../params/ParamSchema';
import { ThreadSizes } from '../sizes/ThreadSizes';
import { ConnectorFrame } from './ConnectorFrame';
import { MeshModel } from './MeshModel';

/** Параметры в формате cdm из gl2. */
export interface SteelHalfUnionParams {
  /** Номинал внутренней резьбы накидной гайки, например '3/4'. */
  r1: string;
  /** Номинал наружной резьбы патрубка, например '1/2'. */
  r2: string;
  /** Длина от гайки до конца патрубка, м. */
  m1: number;
}

/** Толщина колец (x_3, x_4 в gl2), м. */
const RING = 0.002;
/** Сдвиг начала патрубка от гайки (x_3L = −(x_4 + 0.001) в gl2), м. */
const NUT_SHIFT = RING + 0.001;
/** Описанный диаметр гайки — n × 1.236. */
const NUT_SCALE = 1.236;
const HEX_SEGMENTS = 6;

/** Индексы материалов меша. */
const THREAD = 1;
const METAL_FLAT = 2;

/** Размеры полусгона по формулам st_pol_sgon_1. */
interface HalfUnionLayout {
  /** Длина резьбы гайки (x_1) и концевой резьбы патрубка (x_2). */
  x1: number;
  x2: number;
  /** Резьба патрубка перед концевой (x_5). */
  x5: number;
  /** Гладкий участок патрубка (x_3R). */
  x3R: number;
}

/** Стальной полусгон: накидная гайка с внутренней резьбой и патрубок с наружной (перенос st_pol_sgon_1). */
export class SteelHalfUnionGenerator implements ModelGenerator<SteelHalfUnionParams> {
  readonly id = 'st_pol_sgon_1';
  readonly title = 'Полусгон стальной';
  readonly paramSpecs: readonly ParamSpec[] = [
    { kind: 'choice', key: 'r1', label: 'Резьба гайки (в)', options: ThreadSizes.nominals },
    { kind: 'choice', key: 'r2', label: 'Резьба патрубка (н)', options: ThreadSizes.nominals },
    { kind: 'length', key: 'm1', label: 'Длина', min: 0.001, max: 0.2, step: 0.0005 },
  ];

  private readonly sleeves = new SleeveGeometryBuilder();

  constructor(private readonly materials: MaterialLibrary) {}

  validate(params: SteelHalfUnionParams): ValidationError[] {
    const errors = ParamSchema.validate(this.paramSpecs, params);
    if (errors.length === 0) {
      const { x2, x5, x3R } = this.layout(params);
      // Гладкий участок патрубка нулевой длины считается ошибкой.
      if (x3R <= 0) errors.push(ParamSchema.tooShort('m1', x2 + x5 + RING));
    }
    return errors;
  }

  build(params: SteelHalfUnionParams): GeneratedModel {
    const errors = this.validate(params);
    if (errors.length > 0) throw new GeneratorParamsError(this.id, errors);

    const d1 = ThreadSizes.diameters(params.r1, 'internal')!;
    const d2 = ThreadSizes.diameters(params.r2, 'external')!;
    const { x1, x2, x5, x3R } = this.layout(params);
    const nut = { outerDiameter: d1.n * NUT_SCALE, outerSegments: HEX_SEGMENTS };
    const pipe = { outerDiameter: d2.n, innerDiameter: d2.v };
    const at = (x: number) => ({ x, y: 0, z: 0 });
    // Корпус гайки кончается в −(x_3L + x_3) = 0.001, дальше — кольцо-упор до 0.003.
    const nutEnd = NUT_SHIFT - RING;

    const merger = new MaterialGroupMerger();
    merger.add(
      // Гайка: резьбовая часть, гладкая часть и кольцо-упор вокруг патрубка
      ...this.sleeves.build({ ...nut, length: x1, innerDiameter: d1.v, center: at(nutEnd - x1), materials: { outer: METAL_FLAT, inner: THREAD } }),
      ...this.sleeves.build({ ...nut, length: x1 / 2, innerDiameter: d1.v, center: at(nutEnd - x1 / 4), materials: { outer: METAL_FLAT } }),
      ...this.sleeves.build({ ...nut, length: RING, innerDiameter: d2.n + 0.001, center: at(NUT_SHIFT - RING / 2), materials: { outer: METAL_FLAT } }),
      // Патрубок: буртик, гладкая часть, две резьбовые части
      ...this.sleeves.build({ length: RING, outerDiameter: d1.v, innerDiameter: d2.v - 0.001, center: at(RING / 2) }),
      ...this.sleeves.build({ ...pipe, length: x3R, center: at(RING + x3R / 2) }),
      ...this.sleeves.build({ ...pipe, length: x5, center: at(RING + x3R + x5 / 2), materials: { outer: THREAD } }),
      ...this.sleeves.build({ ...pipe, length: x2, center: at(RING + x3R + x5 + x2 / 2), materials: { outer: THREAD } }),
    );

    // Торцы: открытый край гайки и конец патрубка. Глубина — резьба гайки и вся резьба патрубка.
    // В gl2 точки стояли в центрах резьбы гайки и концевой резьбы.
    return MeshModel.create({
      title: `Полусгон ${params.r2}`,
      geometry: merger.merge(),
      materials: [this.materials.get('metal'), this.materials.get('thread'), this.materials.get('metalFlat')],
      connectors: [
        { id: 'nut', position: at(nutEnd - 1.5 * x1), ...ConnectorFrame.left, depth: x1, nominal: params.r1, joint: 'thread', gender: 'internal' },
        { id: 'pipe', position: at(params.m1), ...ConnectorFrame.right, depth: x5 + x2, nominal: params.r2, joint: 'thread', gender: 'external' },
      ],
    });
  }

  /** Вызывать только для известных номиналов. */
  private layout(params: SteelHalfUnionParams): HalfUnionLayout {
    const x1 = 0.02 * ThreadSizes.diameters(params.r1, 'internal')!.n * 20;
    const x2 = 0.02 * ThreadSizes.diameters(params.r2, 'external')!.n * 20;
    const x5 = x2 * 1.3;
    return { x1, x2, x5, x3R: params.m1 - x2 - x5 - RING };
  }
}
