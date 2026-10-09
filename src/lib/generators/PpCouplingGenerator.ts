import type { GeneratedModel, ModelGenerator, ParamSpec, ValidationError } from '../contracts';
import { GeneratorParamsError } from '../GeneratorParamsError';
import { MaterialGroupMerger } from '../geometry/MaterialGroupMerger';
import { SleeveGeometryBuilder } from '../geometry/SleeveGeometryBuilder';
import type { MaterialLibrary } from '../materials/MaterialLibrary';
import { ParamSchema } from '../params/ParamSchema';
import { PpPipeSizes } from '../sizes/PpPipeSizes';
import { ConnectorFrame } from './ConnectorFrame';
import { MeshModel } from './MeshModel';

/** Параметры в формате cdm из gl2. */
export interface PpCouplingParams {
  /** Наружные диаметры ПП-труб слева и справа, мм, строкой. */
  r1: string;
  r2: string;
  /** Длина муфты, м. */
  m1: number;
}

/** Длина раструба — 0,3 наружного диаметра, не меньше 12 мм. */
const MIN_SOCKET_LENGTH = 0.012;

/** Полипропиленовая муфта под пайку, в том числе переходная (перенос pl_mufta_1). */
export class PpCouplingGenerator implements ModelGenerator<PpCouplingParams> {
  readonly id = 'pl_mufta_1';
  readonly title = 'Муфта ПП';
  readonly paramSpecs: readonly ParamSpec[] = [
    { kind: 'choice', key: 'r1', label: 'Труба слева, мм', options: PpPipeSizes.nominals },
    { kind: 'choice', key: 'r2', label: 'Труба справа, мм', options: PpPipeSizes.nominals },
    { kind: 'length', key: 'm1', label: 'Длина', min: 0.001, max: 0.2, step: 0.0005 },
  ];

  private readonly sleeves = new SleeveGeometryBuilder();

  constructor(private readonly materials: MaterialLibrary) {}

  validate(params: PpCouplingParams): ValidationError[] {
    const errors = ParamSchema.validate(this.paramSpecs, params);
    if (errors.length === 0) {
      // Гладкий участок нулевой длины считается ошибкой, как у стальной муфты.
      const longest = Math.max(this.socketLength(params.r1), this.socketLength(params.r2));
      if (params.m1 / 2 <= longest) errors.push(ParamSchema.tooShort('m1', 2 * longest));
    }
    return errors;
  }

  build(params: PpCouplingParams): GeneratedModel {
    const errors = this.validate(params);
    if (errors.length > 0) throw new GeneratorParamsError(this.id, errors);

    const d1 = PpPipeSizes.diameters(params.r1)!;
    const d2 = PpPipeSizes.diameters(params.r2)!;
    const x1 = this.socketLength(params.r1);
    const x2 = this.socketLength(params.r2);
    const x3L = params.m1 / 2 - x1;
    const x3R = params.m1 / 2 - x2;
    const left = { outerDiameter: d1.n, innerDiameter: d1.v };
    const right = { outerDiameter: d2.n, innerDiameter: d2.v };
    const at = (x: number) => ({ x, y: 0, z: 0 });

    const merger = new MaterialGroupMerger();
    merger.add(
      ...this.sleeves.build({ material: 'plastic', ...left, length: x1, center: at(-(x3L + x1 / 2)) }),
      ...this.sleeves.build({ material: 'plastic', ...left, length: x3L, center: at(-x3L / 2) }),
      // Центр: длина n/7, наружный — больший, внутренний — меньший диаметр
      ...this.sleeves.build({ material: 'plastic', length: Math.max(d1.n, d2.n) / 7, outerDiameter: Math.max(d1.n, d2.n), innerDiameter: Math.min(d1.v, d2.v) }),
      ...this.sleeves.build({ material: 'plastic', ...right, length: x3R, center: at(x3R / 2) }),
      ...this.sleeves.build({ material: 'plastic', ...right, length: x2, center: at(x3R + x2 / 2) }),
    );

    // Торцы — концы муфты (±m1/2), глубина — длина раструба. В gl2 точки — в центрах раструбов.
    const common = { joint: 'pp-socket', gender: 'internal' } as const;
    return MeshModel.create({
      title: params.r1 === params.r2 ? `Муфта ${params.r1}` : `Муфта ${params.r1}х${params.r2}`,
      ...merger.merge(),
      connectors: [
        { id: 'left', position: at(-params.m1 / 2), ...ConnectorFrame.left, depth: x1, nominal: params.r1, ...common },
        { id: 'right', position: at(params.m1 / 2), ...ConnectorFrame.right, depth: x2, nominal: params.r2, ...common },
      ],
    }, this.materials);
  }

  /** Вызывать только для известного номинала. */
  private socketLength(nominal: string): number {
    return Math.max(0.015 * PpPipeSizes.diameters(nominal)!.n * 20, MIN_SOCKET_LENGTH);
  }
}
