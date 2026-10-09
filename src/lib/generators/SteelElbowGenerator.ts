import type { GeneratedModel, ModelGenerator, ParamSpec, ValidationError } from '../contracts';
import { GeneratorParamsError } from '../GeneratorParamsError';
import { MaterialGroupMerger } from '../geometry/MaterialGroupMerger';
import { SleeveGeometryBuilder } from '../geometry/SleeveGeometryBuilder';
import type { SleeveMaterials, SleeveShape } from '../geometry/SleeveGeometryBuilder';
import { SphereGeometryBuilder } from '../geometry/SphereGeometryBuilder';
import type { MaterialLibrary } from '../materials/MaterialLibrary';
import { ParamSchema } from '../params/ParamSchema';
import { ThreadSizes } from '../sizes/ThreadSizes';
import { ConnectorFrame } from './ConnectorFrame';
import { MeshModel } from './MeshModel';

/** Сторона резьбы в формате gl2: 'v' — внутренняя, 'n' — наружная. */
export type ThreadSideCode = 'v' | 'n';

/** Параметры в формате cdm из gl2. */
export interface SteelElbowParams {
  side: ThreadSideCode;
  /** Дюймовый номинал резьбы, например '1/2'. */
  r1: string;
  /** Длина плеча от оси до конца резьбы, м. */
  m1: number;
}

/** Длина резьбы (w1 в gl2), м. */
const THREAD_LENGTH = 0.015;

/**
 * Стальной угол 90° с резьбой (перенос st_ugol_90_1). Плечи по +X и +Y,
 * на каждом — гладкая часть, резьба и кольцо; внешний угол — четверть сферы.
 */
export class SteelElbowGenerator implements ModelGenerator<SteelElbowParams> {
  readonly id = 'st_ugol_90_1';
  readonly title = 'Угол стальной 90°';
  readonly paramSpecs: readonly ParamSpec[] = [
    { kind: 'choice', key: 'side', label: 'Резьба', options: ['v', 'n'], optionLabels: { v: 'внутренняя', n: 'наружная' } },
    { kind: 'choice', key: 'r1', label: 'Номинал', options: ThreadSizes.nominals },
    { kind: 'length', key: 'm1', label: 'Длина плеча', min: 0.001, max: 0.2, step: 0.0005 },
  ];

  private readonly sleeves = new SleeveGeometryBuilder();
  private readonly spheres = new SphereGeometryBuilder();

  constructor(private readonly materials: MaterialLibrary) {}

  validate(params: SteelElbowParams): ValidationError[] {
    const errors = ParamSchema.validate(this.paramSpecs, params);
    // Гладкая часть плеча (s1 в gl2) была бы нулевой или отрицательной длины.
    if (errors.length === 0 && params.m1 <= THREAD_LENGTH) errors.push(ParamSchema.tooShort('m1', THREAD_LENGTH));
    return errors;
  }

  build(params: SteelElbowParams): GeneratedModel {
    const errors = this.validate(params);
    if (errors.length > 0) throw new GeneratorParamsError(this.id, errors);

    const internal = params.side === 'v';
    const d = ThreadSizes.diameters(params.r1, internal ? 'internal' : 'external')!;
    const w1 = THREAD_LENGTH;
    const ring = d.n / 10;
    const s1 = params.m1 - w1;
    // Внутренняя резьба: кольцо за концом резьбы; наружная — у начала резьбы, поверх неё.
    const ringCenter = internal ? s1 + w1 + ring / 2 : s1 + ring / 2;
    const thread: Partial<SleeveMaterials> = internal ? { inner: 'thread' } : { outer: 'thread' };
    const pipe = { outerDiameter: d.n, innerDiameter: d.v };

    // Плечо по +X; вертикальное — те же куски, повёрнутые как в gl2.
    const arm = (axis: 'x' | 'y'): SleeveShape[] => {
      const at = (offset: number) => (axis === 'x' ? { x: offset, y: 0, z: 0 } : { x: 0, y: offset, z: 0 });
      const turned = axis === 'x' ? {} : { rotation: { x: 0, y: Math.PI, z: Math.PI / 2 } };
      const pipeTurn = axis === 'x' ? {} : { rotation: { x: 0, y: 0, z: -Math.PI / 2 } };
      return [
        { ...pipe, ...turned, length: w1, center: at(s1 + w1 / 2), materials: thread },
        { ...turned, length: ring, outerDiameter: d.n + ring, innerDiameter: d.v, center: at(ringCenter) },
        { ...pipe, ...pipeTurn, length: s1, center: at(s1 / 2) },
      ];
    };

    const quarter = { phiLength: Math.PI / 2, rotation: { x: Math.PI / 2, y: 0, z: 0 } };
    const merger = new MaterialGroupMerger();
    for (const sleeve of [...arm('y'), ...arm('x')]) merger.add(...this.sleeves.build({ material: 'metal', ...sleeve }));
    merger.add(this.spheres.build({ material: 'metal', ...quarter, radius: d.n / 2 }), this.spheres.build({ material: 'metal', ...quarter, radius: d.v / 2 }));

    // Внутренняя резьба: торец — наружная грань кольца, глубина — резьба и кольцо.
    // Наружная: торец — конец резьбы, глубина — резьба без кольца у её начала.
    // В gl2 точки стояли в центрах резьбы. ID — по стороне выхода.
    const face = internal ? params.m1 + ring : params.m1;
    const common = { depth: internal ? w1 + ring : w1 - ring, nominal: params.r1, joint: 'thread', gender: internal ? 'internal' : 'external' } as const;
    const suffix = internal ? '(в)' : '(н)';
    return MeshModel.create({
      title: `Угол ${params.r1}${suffix}`,
      ...merger.merge(),
      connectors: [
        { id: 'right', position: ConnectorFrame.point(ConnectorFrame.right, face), ...ConnectorFrame.right, ...common },
        { id: 'top', position: ConnectorFrame.point(ConnectorFrame.top, face), ...ConnectorFrame.top, ...common },
      ],
    }, this.materials);
  }
}
