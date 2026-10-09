import { BaseGenerator } from '../../core/BaseGenerator';
import { connector } from '../../core/connector';
import { ConnectorFrame } from '../../core/ConnectorFrame';
import type { GeneratedModel, ParamSpec, ValidationError } from '../../core/contracts';
import { createMeshModel } from '../../core/MeshModel';
import { MaterialGroupMerger } from '../../geometry/MaterialGroupMerger';
import { sleeves } from '../../geometry/SleeveGeometryBuilder';
import type { SleeveMaterials, SleeveShape } from '../../geometry/SleeveGeometryBuilder';
import { spheres } from '../../geometry/SphereGeometryBuilder';
import { ParamSchema } from '../../params/ParamSchema';
import { specs } from '../../params/specs';
import { ThreadSizes } from '../../sizes/ThreadSizes';
import type { PartDiameters } from '../../sizes/ThreadSizes';

/** Параметры в формате cdm из gl2. */
export interface SteelElbow45Params {
  /** Дюймовый номинал внутренней резьбы, например '1/2'. */
  r1: string;
  /** Длина плеча от оси до конца резьбы, м. */
  m1: number;
}

/** Длина резьбы (x_1 в gl2), м. */
const THREAD_LENGTH = 0.015;
/** Поворот левого плеча вокруг Z: −45° — плечо уходит влево-вверх. */
const TURN = -Math.PI / 4;

/**
 * Стальной угол 45° с внутренней резьбой (перенос st_ugol_45_1). Правое плечо по +X,
 * второе — левое плечо, повёрнутое на 45° вверх; внешний угол — сектор сферы.
 */
export class SteelElbow45Generator extends BaseGenerator<SteelElbow45Params, PartDiameters> {
  readonly id = 'st_ugol_45_1';
  readonly title = 'Угол стальной 45°';
  readonly paramSpecs: readonly ParamSpec[] = [specs.threadNominal('r1', 'Резьба (в)'), specs.length('m1', 'Длина плеча')];

  protected override layout(params: SteelElbow45Params): PartDiameters {
    return ThreadSizes.require(params.r1, 'internal');
  }

  protected override relations(params: SteelElbow45Params): ValidationError[] {
    return params.m1 <= THREAD_LENGTH ? [ParamSchema.tooShort('m1', THREAD_LENGTH)] : [];
  }

  protected create(params: SteelElbow45Params, d: PartDiameters): GeneratedModel {
    const x1 = THREAD_LENGTH;
    const x2 = params.m1 - x1;
    const ring = d.n / 10;
    const pipe = { outerDiameter: d.n, innerDiameter: d.v };
    const ringSize = { outerDiameter: d.n + ring, innerDiameter: d.v };
    const thread: Partial<SleeveMaterials> = { inner: 'thread' };

    // Наклонное плечо: куски вдоль −X (pos1 в gl2), потом поворот на 45°.
    const turned = (x: number) => ({ offset: { x, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: TURN } });
    const at = (x: number) => ({ center: { x, y: 0, z: 0 } });
    const pieces: SleeveShape[] = [
      { ...ringSize, ...turned(-(x2 + x1 + ring / 2)), length: ring },
      { ...pipe, ...turned(-(x2 + x1 / 2)), length: x1, materials: thread },
      { ...pipe, ...turned(-x2 / 2), length: x2 },
      { ...pipe, ...at(x2 / 2), length: x2 },
      { ...pipe, ...at(x2 + x1 / 2), length: x1, materials: thread },
      { ...ringSize, ...at(x2 + x1 + ring / 2), length: ring },
    ];

    const sector = { phiLength: Math.PI / 4, rotation: { x: Math.PI / 2, y: 0, z: Math.PI / 4 } };
    const merger = new MaterialGroupMerger();
    for (const sleeve of pieces) merger.add(...sleeves.build({ material: 'metal', ...sleeve }));
    merger.add(spheres.build({ material: 'metal', ...sector, radius: d.n / 2 }), spheres.build({ material: 'metal', ...sector, radius: d.v / 2 }));

    // Торец — наружная грань кольца за резьбой, глубина — резьба и кольцо.
    // В gl2 точки стояли в центрах резьбы. ID — по стороне выхода.
    const face = params.m1 + ring;
    const angled = ConnectorFrame.leftTurned(TURN);
    const end = { depth: x1 + ring, nominal: params.r1, joint: 'thread', gender: 'internal' } as const;
    return createMeshModel({
      title: `Угол_45 ${params.r1}(в)`,
      ...merger.merge(),
      connectors: [connector('right', ConnectorFrame.right, face, end), connector('left', angled, face, end)],
    });
  }
}
