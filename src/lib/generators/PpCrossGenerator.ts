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

/** Полипропиленовая крестовина под пайку (перенос pl_krestovina_1): выходы по ±X и ±Y. */
export class PpCrossGenerator implements ModelGenerator<PpElbowParams> {
  readonly id = 'pl_krestovina_1';
  readonly title = 'Крестовина ПП';
  readonly paramSpecs: readonly ParamSpec[] = [
    { kind: 'choice', key: 'r1', label: 'Труба, мм', options: PpPipeSizes.nominals },
    { kind: 'length', key: 'm1', label: 'Размер', min: 0.001, max: 0.3, step: 0.0005 },
  ];

  private readonly sleeves = new SleeveGeometryBuilder();

  constructor(private readonly materials: MaterialLibrary) {}

  validate(params: PpElbowParams): ValidationError[] {
    const errors = ParamSchema.validate(this.paramSpecs, params);
    // Средняя часть (x_2 в gl2) была бы нулевой или отрицательной длины.
    if (errors.length === 0 && params.m1 <= 2 * SOCKET_LENGTH) errors.push(ParamSchema.tooShort('m1', 2 * SOCKET_LENGTH));
    return errors;
  }

  build(params: PpElbowParams): GeneratedModel {
    const errors = this.validate(params);
    if (errors.length > 0) throw new GeneratorParamsError(this.id, errors);

    const d = PpPipeSizes.diameters(params.r1)!;
    const x1 = SOCKET_LENGTH;
    const x2 = params.m1 - 2 * x1;
    const pipe = { outerDiameter: d.n, innerDiameter: d.v };
    const offset = (x2 + x1) / 2;

    // В gl2 раструбы и средняя часть — отдельные втулки одного диаметра; разбиение сохранено.
    const merger = new MaterialGroupMerger();
    for (const vertical of [false, true]) {
      const at = (value: number) => (vertical ? { x: 0, y: value, z: 0 } : { x: value, y: 0, z: 0 });
      const rotation = vertical ? { x: 0, y: 0, z: Math.PI / 2 } : undefined;
      merger.add(
        ...this.sleeves.build({ ...pipe, rotation, length: x1, center: at(-offset) }),
        ...this.sleeves.build({ ...pipe, rotation, length: x2 }),
        ...this.sleeves.build({ ...pipe, rotation, length: x1, center: at(offset) }),
      );
    }

    // Торцы — концы раструбов (±m1/2), глубина — длина раструба. В gl2 точки — в центрах раструбов.
    const common = { depth: x1, nominal: params.r1, joint: 'pp-socket', gender: 'internal' } as const;
    const half = params.m1 / 2;
    const { left, right, bottom, top } = ConnectorFrame;
    return MeshModel.create({
      title: `Крестовина ${params.r1}`,
      geometry: merger.merge(),
      materials: [this.materials.get('plastic')],
      connectors: [
        { id: 'left', position: ConnectorFrame.point(left, half), ...left, ...common },
        { id: 'right', position: ConnectorFrame.point(right, half), ...right, ...common },
        { id: 'bottom', position: ConnectorFrame.point(bottom, half), ...bottom, ...common },
        { id: 'top', position: ConnectorFrame.point(top, half), ...top, ...common },
      ],
    });
  }
}
