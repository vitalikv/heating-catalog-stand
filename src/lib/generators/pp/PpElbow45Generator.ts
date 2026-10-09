import { BaseGenerator } from '../../core/BaseGenerator';
import { connector } from '../../core/connector';
import { ConnectorFrame } from '../../core/ConnectorFrame';
import type { GeneratedModel, ParamSpec, ValidationError } from '../../core/contracts';
import { createMeshModel } from '../../core/MeshModel';
import { MaterialGroupMerger } from '../../geometry/MaterialGroupMerger';
import { sleeves } from '../../geometry/SleeveGeometryBuilder';
import { spheres } from '../../geometry/SphereGeometryBuilder';
import { ParamSchema } from '../../params/ParamSchema';
import { specs } from '../../params/specs';
import { PpPipeSizes } from '../../sizes/PpPipeSizes';
import type { PpElbowParams } from './PpElbowGenerator';

/** Длина раструба у торца (x_1 в gl2), м. */
const SOCKET_LENGTH = 0.015;
/** Поворот левого плеча вокруг Z: −45° — плечо уходит влево-вверх. */
const TURN = -Math.PI / 4;

/**
 * Полипропиленовый отвод 45° под пайку (перенос pl_ugol_45_1). Правое плечо по +X,
 * второе — левое плечо, повёрнутое на 45° вверх; внешний угол — сектор сферы.
 */
export class PpElbow45Generator extends BaseGenerator<PpElbowParams> {
  readonly id = 'pp.elbow-45';
  readonly version = 1;
  readonly title = 'Отвод ПП 45°';
  readonly paramSpecs: readonly ParamSpec[] = [
    specs.ppNominal('nominal'),
    specs.length('armLength', 'Длина плеча'),
  ];
  readonly defaults: PpElbowParams = { nominal: '20', armLength: 0.021 };

  protected override relations(params: PpElbowParams): ValidationError[] {
    return params.armLength <= SOCKET_LENGTH ? [ParamSchema.tooShort('armLength', SOCKET_LENGTH)] : [];
  }

  protected create(params: PpElbowParams): GeneratedModel {
    const d = PpPipeSizes.require(params.nominal);
    const x1 = SOCKET_LENGTH;
    const x2 = params.armLength - x1;
    const pipe = { outerDiameter: d.n, innerDiameter: d.v };
    const turned = (x: number) => ({ offset: { x, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: TURN } });
    const sector = { phiLength: Math.PI / 4, rotation: { x: Math.PI / 2, y: 0, z: Math.PI / 4 } };

    // В gl2 плечо и раструб — две втулки одного диаметра; разбиение сохранено.
    const merger = new MaterialGroupMerger();
    merger.add(
      ...sleeves.build({ material: 'plastic', ...pipe, length: x2, center: { x: x2 / 2, y: 0, z: 0 } }),
      ...sleeves.build({ material: 'plastic', ...pipe, length: x1, center: { x: x2 + x1 / 2, y: 0, z: 0 } }),
      ...sleeves.build({ material: 'plastic', ...pipe, ...turned(-x2 / 2), length: x2 }),
      ...sleeves.build({ material: 'plastic', ...pipe, ...turned(-(x2 + x1 / 2)), length: x1 }),
      spheres.build({ material: 'plastic', ...sector, radius: d.n / 2 }),
      spheres.build({ material: 'plastic', ...sector, radius: d.v / 2 }),
    );

    // Торец раструба — конец плеча armLength, глубина — длина раструба. В gl2 точки — в центрах раструбов.
    const angled = ConnectorFrame.leftTurned(TURN);
    const common = { depth: x1, nominal: params.nominal, joint: 'pp-socket', gender: 'internal' } as const;
    return createMeshModel({
      title: `Отвод_45 ${params.nominal}`,
      ...merger.merge(),
      connectors: [
        connector('right', ConnectorFrame.right, params.armLength, common),
        connector('left', angled, params.armLength, common),
      ],
    });
  }
}
