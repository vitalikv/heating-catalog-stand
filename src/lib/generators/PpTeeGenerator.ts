import type { GeneratedModel, ModelGenerator, ParamSpec, ValidationError } from '../contracts';
import { GeneratorParamsError } from '../GeneratorParamsError';
import { MaterialGroupMerger } from '../geometry/MaterialGroupMerger';
import { SleeveGeometryBuilder } from '../geometry/SleeveGeometryBuilder';
import type { MaterialLibrary } from '../materials/MaterialLibrary';
import { ParamSchema } from '../params/ParamSchema';
import { PpPipeSizes } from '../sizes/PpPipeSizes';
import { ConnectorFrame } from './ConnectorFrame';
import { MeshModel } from './MeshModel';
import type { PpElbowParams } from './PpElbowGenerator';

/** Длина раструба (x_1 в gl2), м. */
const SOCKET_LENGTH = 0.015;

/**
 * Полипропиленовый тройник под пайку (перенос pl_troinik_1): проход длиной m1 по X
 * и отвод высотой m1/2 по +Y — две втулки одного диаметра.
 */
export class PpTeeGenerator implements ModelGenerator<PpElbowParams> {
  readonly id = 'pl_troinik_1';
  readonly title = 'Тройник ПП';
  readonly paramSpecs: readonly ParamSpec[] = [
    { kind: 'choice', key: 'r1', label: 'Труба, мм', options: PpPipeSizes.nominals },
    { kind: 'length', key: 'm1', label: 'Длина прохода', min: 0.001, max: 0.3, step: 0.0005 },
  ];

  private readonly sleeves = new SleeveGeometryBuilder();

  constructor(private readonly materials: MaterialLibrary) {}

  validate(params: PpElbowParams): ValidationError[] {
    const errors = ParamSchema.validate(this.paramSpecs, params);
    // Раструбы прохода не должны перекрываться (x_2 в gl2).
    if (errors.length === 0 && params.m1 <= 2 * SOCKET_LENGTH) errors.push(ParamSchema.tooShort('m1', 2 * SOCKET_LENGTH));
    return errors;
  }

  build(params: PpElbowParams): GeneratedModel {
    const errors = this.validate(params);
    if (errors.length > 0) throw new GeneratorParamsError(this.id, errors);

    const d = PpPipeSizes.diameters(params.r1)!;
    const m2 = params.m1 / 2;
    const pipe = { outerDiameter: d.n, innerDiameter: d.v };

    const merger = new MaterialGroupMerger();
    merger.add(
      ...this.sleeves.build({ material: 'plastic', ...pipe, length: params.m1 }),
      ...this.sleeves.build({ material: 'plastic', ...pipe, length: m2, center: { x: 0, y: m2 / 2, z: 0 }, rotation: { x: 0, y: 0, z: -Math.PI / 2 } }),
    );

    // Торцы — концы прохода и отвода, глубина — длина раструба. В gl2 точки — в центрах раструбов.
    const common = { depth: SOCKET_LENGTH, nominal: params.r1, joint: 'pp-socket', gender: 'internal' } as const;
    const { left, top, right } = ConnectorFrame;
    return MeshModel.create({
      title: `Тройник ${params.r1}`,
      ...merger.merge(),
      connectors: [
        { id: 'left', position: ConnectorFrame.point(left, m2), ...left, ...common },
        { id: 'top', position: ConnectorFrame.point(top, m2), ...top, ...common },
        { id: 'right', position: ConnectorFrame.point(right, m2), ...right, ...common },
      ],
    }, this.materials);
  }
}
