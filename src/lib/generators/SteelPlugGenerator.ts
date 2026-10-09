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

const THREAD = 1;

/** Стальная заглушка с наружной резьбой и сплошным шестигранником (перенос st_zagl_nr). */
export class SteelPlugGenerator implements ModelGenerator<SteelPlugParams> {
  readonly id = 'st_zagl_nr';
  readonly title = 'Заглушка стальная (н)';
  readonly paramSpecs: readonly ParamSpec[] = [
    { kind: 'choice', key: 'r1', label: 'Резьба', options: ThreadSizes.nominals },
    { kind: 'length', key: 'm1', label: 'Длина', min: 0.001, max: 0.2, step: 0.0005 },
  ];

  private readonly sleeves = new SleeveGeometryBuilder();

  constructor(private readonly materials: MaterialLibrary) {}

  validate(params: SteelPlugParams): ValidationError[] {
    const errors = ParamSchema.validate(this.paramSpecs, params);
    if (errors.length === 0) {
      // Гладкий участок нулевой длины считается ошибкой, как у ниппеля.
      const x1 = this.threadLength(params.r1);
      if (params.m1 / 2 <= x1) errors.push(ParamSchema.tooShort('m1', 2 * x1));
    }
    return errors;
  }

  build(params: SteelPlugParams): GeneratedModel {
    const errors = this.validate(params);
    if (errors.length > 0) throw new GeneratorParamsError(this.id, errors);

    const d1 = ThreadSizes.diameters(params.r1, 'external')!;
    const x1 = this.threadLength(params.r1);
    const x3L = params.m1 / 2 - x1;
    const at = (x: number) => ({ x, y: 0, z: 0 });

    const merger = new MaterialGroupMerger();
    merger.add(
      // Резьба и гладкая часть
      ...this.sleeves.build({ length: x1, outerDiameter: d1.n, innerDiameter: d1.v, center: at(-(x3L + x1 / 2)), materials: { outer: THREAD } }),
      ...this.sleeves.build({ length: x3L, outerDiameter: d1.n, innerDiameter: d1.v, center: at(-x3L / 2) }),
      // Сплошной шестигранник: длина n/7, описанный диаметр n + n/4
      ...this.sleeves.build({ length: d1.n / 7, outerDiameter: d1.n + d1.n / 4, innerDiameter: 0, outerSegments: HEX_SEGMENTS }),
    );

    // Торец — конец резьбы (−m1/2), глубина — длина резьбы. В gl2 точка — в центре резьбы.
    const left = ConnectorFrame.left;
    return MeshModel.create({
      title: `Заглушка ${params.r1}(н)`,
      geometry: merger.merge(),
      materials: [this.materials.get('metal'), this.materials.get('thread')],
      connectors: [
        { id: 'left', position: at(-params.m1 / 2), ...left, depth: x1, nominal: params.r1, joint: 'thread', gender: 'external' },
      ],
    });
  }

  /** Вызывать только для известного номинала. */
  private threadLength(nominal: string): number {
    const n = ThreadSizes.diameters(nominal, 'external')!.n;
    return Math.min(Math.max(0.015 * n * 20, MIN_THREAD_LENGTH), MAX_THREAD_LENGTH);
  }
}
