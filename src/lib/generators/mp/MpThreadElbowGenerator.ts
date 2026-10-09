import { BaseGenerator } from '../../core/BaseGenerator';
import { connector } from '../../core/connector';
import { ConnectorFrame } from '../../core/ConnectorFrame';
import type { GeneratedModel, ParamSpec, ThreadGender, ValidationError } from '../../core/contracts';
import { createMeshModel } from '../../core/MeshModel';
import { MaterialGroupMerger } from '../../geometry/MaterialGroupMerger';
import { sleeves } from '../../geometry/SleeveGeometryBuilder';
import { spheres } from '../../geometry/SphereGeometryBuilder';
import { ParamSchema } from '../../params/ParamSchema';
import { specs } from '../../params/specs';
import { MpPipeSizes } from '../../sizes/MpPipeSizes';
import { ThreadSizes } from '../../sizes/ThreadSizes';
import type { PartDiameters } from '../../sizes/ThreadSizes';
import { MpPressEnd } from './MpPressEnd';

export interface MpThreadElbowParams {
  /** Сторона резьбы справа. */
  threadGender: ThreadGender;
  /** Наружный диаметр металлопластиковой трубы, мм, строкой. */
  pipeNominal: string;
  /** Дюймовый номинал резьбы. */
  threadNominal: string;
  /** Длина плеча с пресс-концом (вверх), м. */
  armLength: number;
  /** Длина плеча с резьбой (вправо) до гайки, м. */
  threadArmLength: number;
}

/** Длина резьбы (w2 в gl2), м. */
const THREAD_LENGTH = 0.015;
/** Длина шестигранной гайки (w22 в gl2), м. */
const NUT_LENGTH = 0.007;

/** Пресс-конец d1 с гильзой w1 и резьба d2. */
interface ThreadElbowLayout {
  d1: PartDiameters;
  d2: PartDiameters;
  w1: number;
}

/**
 * Металлопластиковый угол 90° с резьбой (перенос mpl_ugol_rezba_1): вверх — пресс-конец,
 * вправо — шестигранная гайка и резьба.
 */
export class MpThreadElbowGenerator extends BaseGenerator<MpThreadElbowParams, ThreadElbowLayout> {
  readonly id = 'mp.elbow-thread';
  readonly version = 1;
  readonly title = 'Угол металлопластиковый с резьбой';
  readonly paramSpecs: readonly ParamSpec[] = [
    specs.threadGender(),
    specs.mpNominal('pipeNominal'),
    specs.threadNominal('threadNominal', 'Номинал резьбы'),
    specs.length('armLength', 'Плечо под пресс'),
    specs.length('threadArmLength', 'Плечо с резьбой'),
  ];
  readonly defaults: MpThreadElbowParams = {
    threadGender: 'external',
    pipeNominal: '16',
    threadNominal: '1/2',
    armLength: 0.042,
    threadArmLength: 0.028,
  };

  private readonly ends = new MpPressEnd();

  protected override layout(params: MpThreadElbowParams): ThreadElbowLayout {
    const d1 = MpPipeSizes.require(params.pipeNominal);
    const d2 = ThreadSizes.require(params.threadNominal, params.threadGender);
    return { d1, d2, w1: MpPressEnd.pressLength(d1) };
  }

  protected override relations(params: MpThreadElbowParams, { w1 }: ThreadElbowLayout): ValidationError[] {
    // Плечи до гильзы и до гайки (s1, s2 в gl2) были бы нулевой или отрицательной длины.
    const errors: ValidationError[] = [];
    if (params.armLength <= w1) errors.push(ParamSchema.tooShort('armLength', w1));
    if (params.threadArmLength <= THREAD_LENGTH) errors.push(ParamSchema.tooShort('threadArmLength', THREAD_LENGTH));
    return errors;
  }

  protected create(params: MpThreadElbowParams, { d1, d2, w1 }: ThreadElbowLayout): GeneratedModel {
    const internal = params.threadGender === 'internal';
    const w2 = THREAD_LENGTH;
    const s1 = params.armLength - w1;
    const s2 = params.threadArmLength - w2;
    const pipe = { outerDiameter: d1.n, innerDiameter: d1.v };
    const quarter = { phiLength: Math.PI / 2, rotation: { x: Math.PI / 2, y: 0, z: 0 } };

    const merger = new MaterialGroupMerger();
    merger.add(
      ...this.ends.build(d1, s1, w1, MpPressEnd.top),
      ...sleeves.build({ material: 'bronze', ...pipe, length: s1, center: { x: 0, y: s1 / 2, z: 0 }, rotation: { x: 0, y: 0, z: -Math.PI / 2 } }),
      ...sleeves.build({ material: 'bronze', ...pipe, length: s2, center: { x: s2 / 2, y: 0, z: 0 } }),
      // Гайка: в gl2 внутренний диаметр — n/2 резьбы (tb2.n), перенесено как есть
      ...sleeves.build({
        material: 'bronze',
        length: NUT_LENGTH,
        outerDiameter: d2.n + 0.01,
        innerDiameter: d2.n / 2,
        outerSegments: 6,
        center: { x: s2 + NUT_LENGTH / 2, y: 0, z: 0 },
        materials: { outer: 'bronzeFlat' },
      }),
      ...sleeves.build({
        material: 'bronze',
        length: w2,
        outerDiameter: d2.n,
        innerDiameter: d2.v,
        center: { x: s2 + NUT_LENGTH + w2 / 2, y: 0, z: 0 },
        materials: internal ? { inner: 'bronzeThread' } : { outer: 'bronzeThread' },
      }),
      spheres.build({ material: 'bronze', ...quarter, radius: d1.n / 2 }),
      spheres.build({ material: 'bronze', ...quarter, radius: d1.v / 2 }),
    );

    // Резьба: торец — конец резьбы за гайкой, глубина — длина резьбы. Пресс: торец — конец гильзы.
    // В gl2 точки стояли в центрах резьбы и гильзы.
    const face = params.threadArmLength + NUT_LENGTH;
    const suffix = internal ? '(в)' : '(н)';
    return createMeshModel({
      title: `Угол ${params.pipeNominal}x${params.threadNominal}${suffix}`,
      ...merger.merge(),
      connectors: [
        connector('right', ConnectorFrame.right, face, { depth: w2, nominal: params.threadNominal, joint: 'thread', gender: internal ? 'internal' : 'external' }),
        connector('top', ConnectorFrame.top, params.armLength, { depth: w1, nominal: params.pipeNominal, joint: 'mp-press', gender: 'internal' }),
      ],
    });
  }
}
