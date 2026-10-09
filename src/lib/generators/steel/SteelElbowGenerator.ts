import { BaseGenerator } from '../../core/BaseGenerator';
import { connector } from '../../core/connector';
import { ConnectorFrame } from '../../core/ConnectorFrame';
import type { GeneratedModel, ParamSpec, ThreadGender, ValidationError } from '../../core/contracts';
import { createMeshModel } from '../../core/MeshModel';
import { MaterialGroupMerger } from '../../geometry/MaterialGroupMerger';
import { sleeves } from '../../geometry/SleeveGeometryBuilder';
import type { SleeveMaterials, SleeveShape } from '../../geometry/SleeveGeometryBuilder';
import { spheres } from '../../geometry/SphereGeometryBuilder';
import { ParamSchema } from '../../params/ParamSchema';
import { specs } from '../../params/specs';
import { ThreadSizes } from '../../sizes/ThreadSizes';
import type { PartDiameters } from '../../sizes/ThreadSizes';

export interface SteelElbowParams {
  threadGender: ThreadGender;
  /** Дюймовый номинал резьбы, например '1/2'. */
  nominal: string;
  /** Длина плеча от оси до конца резьбы, м. */
  armLength: number;
}

/** Длина резьбы (w1 в gl2), м. */
const THREAD_LENGTH = 0.015;

/**
 * Стальной угол 90° с резьбой (перенос st_ugol_90_1). Плечи по +X и +Y,
 * на каждом — гладкая часть, резьба и кольцо; внешний угол — четверть сферы.
 */
export class SteelElbowGenerator extends BaseGenerator<SteelElbowParams, PartDiameters> {
  readonly id = 'steel.elbow-90';
  readonly version = 1;
  readonly title = 'Угол стальной 90°';
  readonly paramSpecs: readonly ParamSpec[] = [
    specs.threadGender(),
    specs.threadNominal('nominal', 'Номинал'),
    specs.length('armLength', 'Длина плеча'),
  ];
  readonly defaults: SteelElbowParams = { threadGender: 'internal', nominal: '1/2', armLength: 0.023 };

  protected override layout(params: SteelElbowParams): PartDiameters {
    return ThreadSizes.require(params.nominal, params.threadGender);
  }

  protected override relations(params: SteelElbowParams): ValidationError[] {
    // Гладкая часть плеча (s1 в gl2) была бы нулевой или отрицательной длины.
    return params.armLength <= THREAD_LENGTH ? [ParamSchema.tooShort('armLength', THREAD_LENGTH)] : [];
  }

  protected create(params: SteelElbowParams, d: PartDiameters): GeneratedModel {
    const internal = params.threadGender === 'internal';
    const w1 = THREAD_LENGTH;
    const ring = d.n / 10;
    const s1 = params.armLength - w1;
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
    for (const sleeve of [...arm('y'), ...arm('x')]) merger.add(...sleeves.build({ material: 'metal', ...sleeve }));
    merger.add(spheres.build({ material: 'metal', ...quarter, radius: d.n / 2 }), spheres.build({ material: 'metal', ...quarter, radius: d.v / 2 }));

    // Внутренняя резьба: торец — наружная грань кольца, глубина — резьба и кольцо.
    // Наружная: торец — конец резьбы, глубина — резьба без кольца у её начала.
    // В gl2 точки стояли в центрах резьбы. ID — по стороне выхода.
    const face = internal ? params.armLength + ring : params.armLength;
    const end = { depth: internal ? w1 + ring : w1 - ring, nominal: params.nominal, joint: 'thread', gender: internal ? 'internal' : 'external' } as const;
    return createMeshModel({
      title: `Угол ${params.nominal}${internal ? '(в)' : '(н)'}`,
      ...merger.merge(),
      connectors: [connector('right', ConnectorFrame.right, face, end), connector('top', ConnectorFrame.top, face, end)],
    });
  }
}
