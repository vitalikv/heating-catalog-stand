import { BaseGenerator } from '../../core/BaseGenerator';
import { connector } from '../../core/connector';
import { ConnectorFrame } from '../../core/ConnectorFrame';
import type { GeneratedModel, ParamSpec, ThreadGender, ValidationError } from '../../core/contracts';
import { createMeshModel } from '../../core/MeshModel';
import { MaterialGroupMerger } from '../../geometry/MaterialGroupMerger';
import { sleeves } from '../../geometry/SleeveGeometryBuilder';
import type { SleeveMaterials } from '../../geometry/SleeveGeometryBuilder';
import { ParamSchema } from '../../params/ParamSchema';
import { specs } from '../../params/specs';
import { MpPipeSizes } from '../../sizes/MpPipeSizes';
import { ThreadSizes } from '../../sizes/ThreadSizes';
import { MP_CAP, MpPressEnd } from './MpPressEnd';

export interface MpThreadAdapterParams {
  /** Сторона резьбы справа. */
  threadGender: ThreadGender;
  /** Наружный диаметр металлопластиковой трубы слева, мм, строкой. */
  pipeNominal: string;
  /** Дюймовый номинал резьбы справа. */
  threadNominal: string;
  /** Длина, м. */
  length: number;
}

/** Длина резьбы (w2 в gl2), м. */
const THREAD_LENGTH = 0.015;
/** У этого соединителя гильза короче — от 20 мм — и не короче 1 мм трубы до неё. */
const MIN_PRESS_LENGTH = 0.02;
const MIN_PIPE_LENGTH = 0.001;

/**
 * Металлопластиковый соединитель с резьбой (перенос mpl_perehod_rezba_1): слева пресс-конец,
 * справа шестигранная гайка и резьба.
 */
export class MpThreadAdapterGenerator extends BaseGenerator<MpThreadAdapterParams> {
  readonly id = 'mp.thread-adapter';
  readonly version = 1;
  readonly title = 'Соединитель металлопластиковый с резьбой';
  readonly paramSpecs: readonly ParamSpec[] = [
    specs.threadGender(),
    specs.mpNominal('pipeNominal'),
    specs.threadNominal('threadNominal', 'Номинал резьбы'),
    specs.length('length', 'Длина'),
  ];
  readonly defaults: MpThreadAdapterParams = { threadGender: 'external', pipeNominal: '16', threadNominal: '1/2', length: 0.048 };

  private readonly ends = new MpPressEnd();

  protected override relations(params: MpThreadAdapterParams): ValidationError[] {
    // Шестигранник между заглушкой и резьбой (s3 в gl2) был бы нулевой или отрицательной длины.
    const minimum = 2 * (THREAD_LENGTH + MP_CAP);
    return params.length <= minimum ? [ParamSchema.tooShort('length', minimum)] : [];
  }

  protected create(params: MpThreadAdapterParams): GeneratedModel {
    const internal = params.threadGender === 'internal';
    const d1 = MpPipeSizes.require(params.pipeNominal);
    const d2 = ThreadSizes.require(params.threadNominal, internal ? 'internal' : 'external');
    const half = params.length / 2;
    // Гильза 0,9 n (не меньше 20 мм); если труба до неё короче 1 мм, гильза укорачивается.
    const s1 = Math.max(half - MpPressEnd.pressLength(d1, MIN_PRESS_LENGTH), MIN_PIPE_LENGTH);
    const w1 = half - s1;
    const w2 = THREAD_LENGTH;
    const s2 = half - w2;
    const s3 = s2 - MP_CAP;
    const at = (x: number) => ({ x, y: 0, z: 0 });
    const flat: Partial<SleeveMaterials> = { outer: 'bronzeFlat' };
    // В gl2 внутренний диаметр гайки — n/2 резьбы (tb2.n), перенесено как есть.
    const nutInner = d2.n / 2;

    const merger = new MaterialGroupMerger();
    merger.add(
      ...this.ends.build(d1, s1, w1, MpPressEnd.left),
      ...sleeves.build({ material: 'bronze', length: s1, outerDiameter: d1.n, innerDiameter: d1.v, center: at(-s1 / 2), rotation: { x: 0, y: Math.PI, z: 0 } }),
      // Буртик и шестигранник
      ...sleeves.build({ material: 'bronze', length: MP_CAP, outerDiameter: d2.n + 0.0025, innerDiameter: nutInner, center: at(MP_CAP / 2), materials: flat }),
      ...sleeves.build({ material: 'bronze', length: s3, outerDiameter: d2.n + 0.01, innerDiameter: nutInner, outerSegments: 6, center: at(MP_CAP + s3 / 2), materials: flat }),
      ...sleeves.build({
        material: 'bronze',
        length: w2,
        outerDiameter: d2.n,
        innerDiameter: d2.v,
        center: at(s2 + w2 / 2),
        materials: internal ? { inner: 'bronzeThread' } : { outer: 'bronzeThread' },
      }),
    );

    // Торцы — концы гильзы и резьбы (±length/2). В gl2 точки стояли в центрах гильзы и резьбы.
    const suffix = internal ? '(в)' : '(н)';
    const { left, right } = ConnectorFrame;
    return createMeshModel({
      title: `Соединитель ${params.pipeNominal}x${params.threadNominal}${suffix}`,
      ...merger.merge(),
      connectors: [
        connector('left', left, half, { depth: w1, nominal: params.pipeNominal, joint: 'mp-press', gender: 'internal' }),
        connector('right', right, half, { depth: w2, nominal: params.threadNominal, joint: 'thread', gender: internal ? 'internal' : 'external' }),
      ],
    });
  }
}
