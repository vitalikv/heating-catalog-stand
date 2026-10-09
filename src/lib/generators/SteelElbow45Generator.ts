import type { GeneratedModel, ModelGenerator, ParamSpec, ValidationError } from '../contracts';
import { GeneratorParamsError } from '../GeneratorParamsError';
import { MaterialGroupMerger } from '../geometry/MaterialGroupMerger';
import { SleeveGeometryBuilder } from '../geometry/SleeveGeometryBuilder';
import type { SleeveOptions } from '../geometry/SleeveGeometryBuilder';
import { SphereGeometryBuilder } from '../geometry/SphereGeometryBuilder';
import type { MaterialLibrary } from '../materials/MaterialLibrary';
import { ParamSchema } from '../params/ParamSchema';
import { ThreadSizes } from '../sizes/ThreadSizes';
import { ConnectorFrame } from './ConnectorFrame';
import { MeshModel } from './MeshModel';

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

const THREAD = 1;

/**
 * Стальной угол 45° с внутренней резьбой (перенос st_ugol_45_1). Правое плечо по +X,
 * второе — левое плечо, повёрнутое на 45° вверх; внешний угол — сектор сферы.
 */
export class SteelElbow45Generator implements ModelGenerator<SteelElbow45Params> {
  readonly id = 'st_ugol_45_1';
  readonly title = 'Угол стальной 45°';
  readonly paramSpecs: readonly ParamSpec[] = [
    { kind: 'choice', key: 'r1', label: 'Резьба (в)', options: ThreadSizes.nominals },
    { kind: 'length', key: 'm1', label: 'Длина плеча', min: 0.001, max: 0.2, step: 0.0005 },
  ];

  private readonly sleeves = new SleeveGeometryBuilder();
  private readonly spheres = new SphereGeometryBuilder();

  constructor(private readonly materials: MaterialLibrary) {}

  validate(params: SteelElbow45Params): ValidationError[] {
    const errors = ParamSchema.validate(this.paramSpecs, params);
    if (errors.length === 0 && params.m1 <= THREAD_LENGTH) errors.push(ParamSchema.tooShort('m1', THREAD_LENGTH));
    return errors;
  }

  build(params: SteelElbow45Params): GeneratedModel {
    const errors = this.validate(params);
    if (errors.length > 0) throw new GeneratorParamsError(this.id, errors);

    const d = ThreadSizes.diameters(params.r1, 'internal')!;
    const x1 = THREAD_LENGTH;
    const x2 = params.m1 - x1;
    const ring = d.n / 10;
    const pipe = { outerDiameter: d.n, innerDiameter: d.v };
    const ringSize = { outerDiameter: d.n + ring, innerDiameter: d.v };
    const thread = { inner: THREAD };

    // Наклонное плечо: куски вдоль −X (pos1 в gl2), потом поворот на 45°.
    const turned = (x: number) => ({ offset: { x, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: TURN } });
    const at = (x: number) => ({ center: { x, y: 0, z: 0 } });
    const sleeves: SleeveOptions[] = [
      { ...ringSize, ...turned(-(x2 + x1 + ring / 2)), length: ring },
      { ...pipe, ...turned(-(x2 + x1 / 2)), length: x1, materials: thread },
      { ...pipe, ...turned(-x2 / 2), length: x2 },
      { ...pipe, ...at(x2 / 2), length: x2 },
      { ...pipe, ...at(x2 + x1 / 2), length: x1, materials: thread },
      { ...ringSize, ...at(x2 + x1 + ring / 2), length: ring },
    ];

    const sector = { phiLength: Math.PI / 4, rotation: { x: Math.PI / 2, y: 0, z: Math.PI / 4 } };
    const merger = new MaterialGroupMerger();
    for (const sleeve of sleeves) merger.add(...this.sleeves.build(sleeve));
    merger.add(this.spheres.build({ ...sector, radius: d.n / 2 }), this.spheres.build({ ...sector, radius: d.v / 2 }));

    // Торец — наружная грань кольца за резьбой, глубина — резьба и кольцо.
    // В gl2 точки стояли в центрах резьбы. ID — по стороне выхода.
    const face = params.m1 + ring;
    const angled = ConnectorFrame.leftTurned(TURN);
    const common = { depth: x1 + ring, nominal: params.r1, joint: 'thread', gender: 'internal' } as const;
    return MeshModel.create({
      title: `Угол_45 ${params.r1}(в)`,
      geometry: merger.merge(),
      materials: [this.materials.get('metal'), this.materials.get('thread')],
      connectors: [
        { id: 'right', position: ConnectorFrame.point(ConnectorFrame.right, face), ...ConnectorFrame.right, ...common },
        { id: 'left', position: ConnectorFrame.point(angled, face), ...angled, ...common },
      ],
    });
  }
}
