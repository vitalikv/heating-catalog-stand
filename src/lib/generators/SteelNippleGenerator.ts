import type { Connector, GeneratedModel, ModelGenerator, ParamSpec, ValidationError } from '../contracts';
import { GeneratorParamsError } from '../GeneratorParamsError';
import { MaterialGroupMerger } from '../geometry/MaterialGroupMerger';
import { SleeveGeometryBuilder } from '../geometry/SleeveGeometryBuilder';
import type { SleeveShape } from '../geometry/SleeveGeometryBuilder';
import type { MaterialLibrary } from '../materials/MaterialLibrary';
import { ParamSchema } from '../params/ParamSchema';
import { ThreadSizes } from '../sizes/ThreadSizes';
import { MeshModel } from './MeshModel';

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


/** Стальной ниппель с наружной резьбой с двух сторон (перенос st_nippel_1). */
export class SteelNippleGenerator implements ModelGenerator<SteelNippleParams> {
  readonly id = 'st_nippel_1';
  readonly title = 'Ниппель стальной';
  readonly paramSpecs: readonly ParamSpec[] = [
    { kind: 'choice', key: 'r1', label: 'Резьба слева', options: ThreadSizes.nominals },
    { kind: 'choice', key: 'r2', label: 'Резьба справа', options: ThreadSizes.nominals },
    { kind: 'length', key: 'm1', label: 'Длина', min: 0.001, max: 0.2, step: 0.0005 },
  ];

  private readonly sleeves = new SleeveGeometryBuilder();

  constructor(private readonly materials: MaterialLibrary) {}

  validate(params: SteelNippleParams): ValidationError[] {
    const errors = ParamSchema.validate(this.paramSpecs, params);

    if (errors.length === 0) {
      const { x1, x2 } = this.layout(params);
      // Гладкий участок нулевой длины считается ошибкой, как у муфты.
      if (params.m1 / 2 <= Math.max(x1, x2)) {
        const min = 2 * Math.max(x1, x2);
        errors.push({ code: 'too_short', param: 'm1', message: `Длина m1 должна быть больше ${(min * 1000).toFixed(1)} мм` });
      }
    }

    return errors;
  }

  build(params: SteelNippleParams): GeneratedModel {
    const errors = this.validate(params);
    if (errors.length > 0) throw new GeneratorParamsError(this.id, errors);

    const { x1, x2 } = this.layout(params);
    const d1 = ThreadSizes.diameters(params.r1, 'external')!;
    const d2 = ThreadSizes.diameters(params.r2, 'external')!;
    const x3L = params.m1 / 2 - x1;
    const x3R = params.m1 / 2 - x2;
    const maxN = Math.max(d1.n, d2.n);
    const at = (x: number) => ({ x, y: 0, z: 0 });
    const thread: Partial<SleeveShape> = { materials: { outer: 'thread' } };

    const merger = new MaterialGroupMerger();
    merger.add(
      // Резьба и гладкая часть слева
      ...this.sleeves.build({ material: 'metal', ...thread, length: x1, outerDiameter: d1.n, innerDiameter: d1.v, center: at(-(x3L + x1 / 2)) }),
      ...this.sleeves.build({ material: 'metal', length: x3L, outerDiameter: d1.n, innerDiameter: d1.v, center: at(-x3L / 2) }),
      // Шестигранник: длина n/7, описанный диаметр n + n/4
      ...this.sleeves.build({
        material: 'metal',
        length: maxN / 7,
        outerDiameter: maxN + maxN / 4,
        innerDiameter: Math.min(d1.v, d2.v) + 0.001,
        outerSegments: HEX_SEGMENTS,
      }),
      // Гладкая часть и резьба справа
      ...this.sleeves.build({ material: 'metal', length: x3R, outerDiameter: d2.n, innerDiameter: d2.v, center: at(x3R / 2) }),
      ...this.sleeves.build({ material: 'metal', ...thread, length: x2, outerDiameter: d2.n, innerDiameter: d2.v, center: at(x3R + x2 / 2) }),
    );

    const title = params.r1 === params.r2 ? `Ниппель ${params.r1}(н)` : `Ниппель ${params.r1}(н)х${params.r2}(н)`;

    // Торцы — концы резьбы (±m1/2), глубина — длина резьбового участка.
    // В gl2 точка разъёма стояла в центре резьбового участка.
    const common = { up: { x: 0, y: 1, z: 0 }, joint: 'thread', gender: 'external' } as const;
    const connectors: Connector[] = [
      { id: 'left', position: at(-params.m1 / 2), direction: { x: -1, y: 0, z: 0 }, depth: x1, nominal: params.r1, ...common },
      { id: 'right', position: at(params.m1 / 2), direction: { x: 1, y: 0, z: 0 }, depth: x2, nominal: params.r2, ...common },
    ];

    return MeshModel.create({ title, ...merger.merge(), connectors }, this.materials);
  }

  /** Длины резьбовых участков; вызывать только для известных номиналов. */
  private layout(params: SteelNippleParams): { x1: number; x2: number } {
    const threadLength = (nominal: string) => {
      const n = ThreadSizes.diameters(nominal, 'external')!.n;
      return Math.min(Math.max(0.015 * n * 20, MIN_THREAD_LENGTH), MAX_THREAD_LENGTH);
    };
    return { x1: threadLength(params.r1), x2: threadLength(params.r2) };
  }
}
