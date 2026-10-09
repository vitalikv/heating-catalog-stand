import type { GeneratedModel, ModelGenerator, ParamSpec, ValidationError } from '../contracts';
import { GeneratorParamsError } from '../GeneratorParamsError';
import { MaterialGroupMerger } from '../geometry/MaterialGroupMerger';
import { SleeveGeometryBuilder } from '../geometry/SleeveGeometryBuilder';
import { SphereGeometryBuilder } from '../geometry/SphereGeometryBuilder';
import { ParamSchema } from '../params/ParamSchema';
import { MpPipeSizes } from '../sizes/MpPipeSizes';
import { ThreadSizes } from '../sizes/ThreadSizes';
import { ConnectorFrame } from './ConnectorFrame';
import { MeshModel } from './MeshModel';
import { MpPressEnd } from './MpPressEnd';
import type { ThreadSideCode } from './SteelElbowGenerator';

/** Параметры в формате cdm из gl2. */
export interface MpThreadElbowParams {
  /** Сторона резьбы справа. */
  side: ThreadSideCode;
  /** Наружный диаметр металлопластиковой трубы, мм, строкой. */
  r1: string;
  /** Дюймовый номинал резьбы. */
  r2: string;
  /** Длина плеча с пресс-концом (вверх), м. */
  m1: number;
  /** Длина плеча с резьбой (вправо) до гайки, м. */
  m2: number;
}

/** Длина резьбы (w2 в gl2), м. */
const THREAD_LENGTH = 0.015;
/** Длина шестигранной гайки (w22 в gl2), м. */
const NUT_LENGTH = 0.007;

/**
 * Металлопластиковый угол 90° с резьбой (перенос mpl_ugol_rezba_1): вверх — пресс-конец,
 * вправо — шестигранная гайка и резьба.
 */
export class MpThreadElbowGenerator implements ModelGenerator<MpThreadElbowParams> {
  readonly id = 'mpl_ugol_rezba_1';
  readonly title = 'Угол металлопластиковый с резьбой';
  readonly paramSpecs: readonly ParamSpec[] = [
    { kind: 'choice', key: 'side', label: 'Резьба', options: ['v', 'n'], optionLabels: { v: 'внутренняя', n: 'наружная' } },
    { kind: 'choice', key: 'r1', label: 'Труба, мм', options: MpPipeSizes.nominals },
    { kind: 'choice', key: 'r2', label: 'Номинал резьбы', options: ThreadSizes.nominals },
    { kind: 'length', key: 'm1', label: 'Плечо под пресс', min: 0.001, max: 0.2, step: 0.0005 },
    { kind: 'length', key: 'm2', label: 'Плечо с резьбой', min: 0.001, max: 0.2, step: 0.0005 },
  ];

  private readonly sleeves = new SleeveGeometryBuilder();
  private readonly spheres = new SphereGeometryBuilder();
  private readonly ends = new MpPressEnd(this.sleeves);

  validate(params: MpThreadElbowParams): ValidationError[] {
    const errors = ParamSchema.validate(this.paramSpecs, params);
    if (errors.length === 0) {
      // Плечи до гильзы и до гайки (s1, s2 в gl2) были бы нулевой или отрицательной длины.
      const w1 = MpPressEnd.pressLength(MpPipeSizes.diameters(params.r1)!);
      if (params.m1 <= w1) errors.push(ParamSchema.tooShort('m1', w1));
      if (params.m2 <= THREAD_LENGTH) errors.push(ParamSchema.tooShort('m2', THREAD_LENGTH));
    }
    return errors;
  }

  build(params: MpThreadElbowParams): GeneratedModel {
    const errors = this.validate(params);
    if (errors.length > 0) throw new GeneratorParamsError(this.id, errors);

    const internal = params.side === 'v';
    const d1 = MpPipeSizes.diameters(params.r1)!;
    const d2 = ThreadSizes.diameters(params.r2, internal ? 'internal' : 'external')!;
    const w1 = MpPressEnd.pressLength(d1);
    const w2 = THREAD_LENGTH;
    const s1 = params.m1 - w1;
    const s2 = params.m2 - w2;
    const pipe = { outerDiameter: d1.n, innerDiameter: d1.v };
    const quarter = { phiLength: Math.PI / 2, rotation: { x: Math.PI / 2, y: 0, z: 0 } };

    const merger = new MaterialGroupMerger();
    merger.add(
      ...this.ends.build(d1, s1, w1, MpPressEnd.top),
      ...this.sleeves.build({ material: 'bronze', ...pipe, length: s1, center: { x: 0, y: s1 / 2, z: 0 }, rotation: { x: 0, y: 0, z: -Math.PI / 2 } }),
      ...this.sleeves.build({ material: 'bronze', ...pipe, length: s2, center: { x: s2 / 2, y: 0, z: 0 } }),
      // Гайка: в gl2 внутренний диаметр — n/2 резьбы (tb2.n), перенесено как есть
      ...this.sleeves.build({
        material: 'bronze',
        length: NUT_LENGTH,
        outerDiameter: d2.n + 0.01,
        innerDiameter: d2.n / 2,
        outerSegments: 6,
        center: { x: s2 + NUT_LENGTH / 2, y: 0, z: 0 },
        materials: { outer: 'bronzeFlat' },
      }),
      ...this.sleeves.build({
        material: 'bronze',
        length: w2,
        outerDiameter: d2.n,
        innerDiameter: d2.v,
        center: { x: s2 + NUT_LENGTH + w2 / 2, y: 0, z: 0 },
        materials: internal ? { inner: 'bronzeThread' } : { outer: 'bronzeThread' },
      }),
      this.spheres.build({ material: 'bronze', ...quarter, radius: d1.n / 2 }),
      this.spheres.build({ material: 'bronze', ...quarter, radius: d1.v / 2 }),
    );

    // Резьба: торец — конец резьбы за гайкой, глубина — длина резьбы. Пресс: торец — конец гильзы.
    // В gl2 точки стояли в центрах резьбы и гильзы.
    const face = params.m2 + NUT_LENGTH;
    const suffix = internal ? '(в)' : '(н)';
    return MeshModel.create({
      title: `Угол ${params.r1}x${params.r2}${suffix}`,
      ...merger.merge(),
      connectors: [
        {
          id: 'right',
          position: ConnectorFrame.point(ConnectorFrame.right, face),
          ...ConnectorFrame.right,
          depth: w2,
          nominal: params.r2,
          joint: 'thread',
          gender: internal ? 'internal' : 'external',
        },
        {
          id: 'top',
          position: ConnectorFrame.point(ConnectorFrame.top, params.m1),
          ...ConnectorFrame.top,
          depth: w1,
          nominal: params.r1,
          joint: 'mp-press',
          gender: 'internal',
        },
      ],
    });
  }
}
