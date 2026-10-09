import { BaseGenerator } from '../../core/BaseGenerator';
import { connector } from '../../core/connector';
import { ConnectorFrame } from '../../core/ConnectorFrame';
import type { GeneratedModel, ParamSpec, ValidationError } from '../../core/contracts';
import { createMeshModel } from '../../core/MeshModel';
import { MaterialGroupMerger } from '../../geometry/MaterialGroupMerger';
import { sleeves } from '../../geometry/SleeveGeometryBuilder';
import { ParamSchema } from '../../params/ParamSchema';
import { specs } from '../../params/specs';
import type { ThreadSideCode } from '../../params/specs';
import { MpPipeSizes } from '../../sizes/MpPipeSizes';
import { ThreadSizes } from '../../sizes/ThreadSizes';
import { MpPressEnd } from './MpPressEnd';
import type { TeeLayout } from './MpPressEnd';
import type { MpTeeParams } from './MpTeeGenerator';

/** Параметры в формате cdm из gl2: r2 — дюймовый номинал резьбы отвода. */
export interface MpThreadTeeParams extends MpTeeParams {
  side: ThreadSideCode;
}

/** Длина резьбы отвода (w2 в gl2), м. */
const THREAD_LENGTH = 0.012;
/** Длина шестигранной гайки (w22 в gl2), м. */
const NUT_LENGTH = 0.007;

/**
 * Металлопластиковый тройник с резьбой на отводе (перенос mpl_troinik_rezba_1):
 * проход под пресс, отвод — конус, труба, шестигранник и резьба.
 */
export class MpThreadTeeGenerator extends BaseGenerator<MpThreadTeeParams, TeeLayout> {
  readonly id = 'mpl_troinik_rezba_1';
  readonly title = 'Тройник металлопластиковый с резьбой';
  readonly paramSpecs: readonly ParamSpec[] = [
    specs.threadSide(),
    specs.mpNominal('r1', 'Слева, мм'),
    specs.threadNominal('r2', 'Резьба отвода'),
    specs.mpNominal('r3', 'Справа, мм'),
    specs.length('m1', 'Длина прохода', { max: 0.3 }),
    specs.length('m2', 'Высота отвода'),
  ];

  private readonly ends = new MpPressEnd();

  /** Отвод d2 — резьба, проход — пресс-концы. */
  protected override layout(params: MpThreadTeeParams): TeeLayout {
    const d1 = MpPipeSizes.require(params.r1);
    const d2 = ThreadSizes.require(params.r2, params.side === 'v' ? 'internal' : 'external');
    const d3 = MpPipeSizes.require(params.r3);
    return { d1, d2, d3, dc: [d1, d2, d3].reduce((max, d) => (d.n > max.n ? d : max)) };
  }

  protected override relations(params: MpThreadTeeParams, { d1, d3 }: TeeLayout): ValidationError[] {
    const errors: ValidationError[] = [];
    const run = Math.max(MpPressEnd.pressLength(d1), MpPressEnd.pressLength(d3));
    if (params.m1 / 2 <= run) errors.push(ParamSchema.tooShort('m1', 2 * run));
    // Участки отвода до резьбы (s2 в gl2) были бы нулевой или отрицательной длины.
    if (params.m2 <= THREAD_LENGTH) errors.push(ParamSchema.tooShort('m2', THREAD_LENGTH));
    return errors;
  }

  protected create(params: MpThreadTeeParams, { d1, d2, d3, dc }: TeeLayout): GeneratedModel {
    const internal = params.side === 'v';
    const w2 = THREAD_LENGTH;
    const s2 = (params.m2 - w2) / 2;
    const up = { x: 0, y: Math.PI, z: Math.PI / 2 };
    const at = (y: number) => ({ x: 0, y, z: 0 });

    const merger = new MaterialGroupMerger();
    merger.add(
      ...this.ends.buildRun(params.m1, d1, d3, dc),
      ...sleeves.build({
        material: 'bronze',
        length: s2,
        outerDiameter: dc.n,
        innerDiameter: dc.v,
        outerDiameterStart: d2.n,
        innerDiameterStart: d2.v,
        center: at(s2 / 2),
        rotation: { x: 0, y: 0, z: -Math.PI / 2 },
      }),
      ...sleeves.build({ material: 'bronze', length: s2, outerDiameter: d2.n, innerDiameter: d2.v, center: at(1.5 * s2), rotation: up }),
      // Гайка в конце трубы отвода: в gl2 внутренний диаметр — n/2 резьбы (tb2.n), перенесено как есть
      ...sleeves.build({
        material: 'bronze',
        length: NUT_LENGTH,
        outerDiameter: d2.n + 0.01,
        innerDiameter: d2.n / 2,
        outerSegments: 6,
        center: at(2 * s2 - NUT_LENGTH / 2),
        rotation: up,
        materials: { outer: 'bronzeFlat' },
      }),
      ...sleeves.build({
        material: 'bronze',
        length: w2,
        outerDiameter: d2.n,
        innerDiameter: d2.v,
        center: at(2 * s2 + w2 / 2),
        rotation: up,
        materials: internal ? { inner: 'bronzeThread' } : { outer: 'bronzeThread' },
      }),
    );

    // Пресс: торцы — концы гильз. Резьба: торец — конец резьбы (m2), глубина — её длина.
    // В gl2 точки стояли в центрах гильз и резьбы.
    const press = { joint: 'mp-press', gender: 'internal' } as const;
    const suffix = internal ? '(в)' : '(н)';
    const { left, top, right } = ConnectorFrame;
    return createMeshModel({
      title: `Тройник ${params.r1}x${params.r2}${suffix}x${params.r3}`,
      ...merger.merge(),
      connectors: [
        connector('left', left, params.m1 / 2, { depth: MpPressEnd.pressLength(d1), nominal: params.r1, ...press }),
        connector('top', top, params.m2, { depth: w2, nominal: params.r2, joint: 'thread', gender: internal ? 'internal' : 'external' }),
        connector('right', right, params.m1 / 2, { depth: MpPressEnd.pressLength(d3), nominal: params.r3, ...press }),
      ],
    });
  }
}
