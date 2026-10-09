import type { GeneratedModel, ModelGenerator, ParamSpec, ValidationError } from '../contracts';
import { GeneratorParamsError } from '../GeneratorParamsError';
import { MaterialGroupMerger } from '../geometry/MaterialGroupMerger';
import { SleeveGeometryBuilder } from '../geometry/SleeveGeometryBuilder';
import { SphereGeometryBuilder } from '../geometry/SphereGeometryBuilder';
import type { MaterialLibrary } from '../materials/MaterialLibrary';
import { ParamSchema } from '../params/ParamSchema';
import { PpPipeSizes } from '../sizes/PpPipeSizes';
import { ConnectorFrame } from './ConnectorFrame';
import { MeshModel } from './MeshModel';
import type { PpElbowParams } from './PpElbowGenerator';

/** Длина раструба у торца (x_1 в gl2), м. */
const SOCKET_LENGTH = 0.015;
/** Поворот левого плеча вокруг Z: −45° — плечо уходит влево-вверх. */
const TURN = -Math.PI / 4;

/**
 * Полипропиленовый отвод 45° под пайку (перенос pl_ugol_45_1). Правое плечо по +X,
 * второе — левое плечо, повёрнутое на 45° вверх; внешний угол — сектор сферы.
 */
export class PpElbow45Generator implements ModelGenerator<PpElbowParams> {
  readonly id = 'pl_ugol_45_1';
  readonly title = 'Отвод ПП 45°';
  readonly paramSpecs: readonly ParamSpec[] = [
    { kind: 'choice', key: 'r1', label: 'Труба, мм', options: PpPipeSizes.nominals },
    { kind: 'length', key: 'm1', label: 'Длина плеча', min: 0.001, max: 0.2, step: 0.0005 },
  ];

  private readonly sleeves = new SleeveGeometryBuilder();
  private readonly spheres = new SphereGeometryBuilder();

  constructor(private readonly materials: MaterialLibrary) {}

  validate(params: PpElbowParams): ValidationError[] {
    const errors = ParamSchema.validate(this.paramSpecs, params);
    if (errors.length === 0 && params.m1 <= SOCKET_LENGTH) errors.push(ParamSchema.tooShort('m1', SOCKET_LENGTH));
    return errors;
  }

  build(params: PpElbowParams): GeneratedModel {
    const errors = this.validate(params);
    if (errors.length > 0) throw new GeneratorParamsError(this.id, errors);

    const d = PpPipeSizes.diameters(params.r1)!;
    const x1 = SOCKET_LENGTH;
    const x2 = params.m1 - x1;
    const pipe = { outerDiameter: d.n, innerDiameter: d.v };
    const turned = (x: number) => ({ offset: { x, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: TURN } });
    const sector = { phiLength: Math.PI / 4, rotation: { x: Math.PI / 2, y: 0, z: Math.PI / 4 } };

    // В gl2 плечо и раструб — две втулки одного диаметра; разбиение сохранено.
    const merger = new MaterialGroupMerger();
    merger.add(
      ...this.sleeves.build({ ...pipe, length: x2, center: { x: x2 / 2, y: 0, z: 0 } }),
      ...this.sleeves.build({ ...pipe, length: x1, center: { x: x2 + x1 / 2, y: 0, z: 0 } }),
      ...this.sleeves.build({ ...pipe, ...turned(-x2 / 2), length: x2 }),
      ...this.sleeves.build({ ...pipe, ...turned(-(x2 + x1 / 2)), length: x1 }),
      this.spheres.build({ ...sector, radius: d.n / 2 }),
      this.spheres.build({ ...sector, radius: d.v / 2 }),
    );

    // Торец раструба — конец плеча m1, глубина — длина раструба. В gl2 точки — в центрах раструбов.
    const angled = ConnectorFrame.leftTurned(TURN);
    const common = { depth: x1, nominal: params.r1, joint: 'pp-socket', gender: 'internal' } as const;
    return MeshModel.create({
      title: `Отвод_45 ${params.r1}`,
      geometry: merger.merge(),
      materials: [this.materials.get('plastic')],
      connectors: [
        { id: 'right', position: ConnectorFrame.point(ConnectorFrame.right, params.m1), ...ConnectorFrame.right, ...common },
        { id: 'left', position: ConnectorFrame.point(angled, params.m1), ...angled, ...common },
      ],
    });
  }
}
