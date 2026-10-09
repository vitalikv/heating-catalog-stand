import type { GeneratedModel, ModelGenerator, ParamSpec, ValidationError } from '../contracts';
import { GeneratorParamsError } from '../GeneratorParamsError';
import { MaterialGroupMerger } from '../geometry/MaterialGroupMerger';
import { SleeveGeometryBuilder } from '../geometry/SleeveGeometryBuilder';
import type { MaterialLibrary } from '../materials/MaterialLibrary';
import { ParamSchema } from '../params/ParamSchema';
import { MpPipeSizes } from '../sizes/MpPipeSizes';
import { ThreadSizes } from '../sizes/ThreadSizes';
import { ConnectorFrame } from './ConnectorFrame';
import { MeshModel } from './MeshModel';
import { MP_MATERIALS, MpPressEnd } from './MpPressEnd';
import type { ThreadSideCode } from './SteelElbowGenerator';
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
export class MpThreadTeeGenerator implements ModelGenerator<MpThreadTeeParams> {
  readonly id = 'mpl_troinik_rezba_1';
  readonly title = 'Тройник металлопластиковый с резьбой';
  readonly paramSpecs: readonly ParamSpec[] = [
    { kind: 'choice', key: 'side', label: 'Резьба', options: ['v', 'n'], optionLabels: { v: 'внутренняя', n: 'наружная' } },
    { kind: 'choice', key: 'r1', label: 'Слева, мм', options: MpPipeSizes.nominals },
    { kind: 'choice', key: 'r2', label: 'Резьба отвода', options: ThreadSizes.nominals },
    { kind: 'choice', key: 'r3', label: 'Справа, мм', options: MpPipeSizes.nominals },
    { kind: 'length', key: 'm1', label: 'Длина прохода', min: 0.001, max: 0.3, step: 0.0005 },
    { kind: 'length', key: 'm2', label: 'Высота отвода', min: 0.001, max: 0.2, step: 0.0005 },
  ];

  private readonly sleeves = new SleeveGeometryBuilder();
  private readonly ends = new MpPressEnd(this.sleeves);

  constructor(private readonly materials: MaterialLibrary) {}

  validate(params: MpThreadTeeParams): ValidationError[] {
    const errors = ParamSchema.validate(this.paramSpecs, params);
    if (errors.length === 0) {
      const run = Math.max(...[params.r1, params.r3].map((r) => MpPressEnd.pressLength(MpPipeSizes.diameters(r)!)));
      if (params.m1 / 2 <= run) errors.push(ParamSchema.tooShort('m1', 2 * run));
      // Участки отвода до резьбы (s2 в gl2) были бы нулевой или отрицательной длины.
      if (params.m2 <= THREAD_LENGTH) errors.push(ParamSchema.tooShort('m2', THREAD_LENGTH));
    }
    return errors;
  }

  build(params: MpThreadTeeParams): GeneratedModel {
    const errors = this.validate(params);
    if (errors.length > 0) throw new GeneratorParamsError(this.id, errors);

    const internal = params.side === 'v';
    const d1 = MpPipeSizes.diameters(params.r1)!;
    const d2 = ThreadSizes.diameters(params.r2, internal ? 'internal' : 'external')!;
    const d3 = MpPipeSizes.diameters(params.r3)!;
    const dc = [d1, d2, d3].reduce((max, d) => (d.n > max.n ? d : max));
    const w2 = THREAD_LENGTH;
    const s2 = (params.m2 - w2) / 2;
    const up = { x: 0, y: Math.PI, z: Math.PI / 2 };
    const at = (y: number) => ({ x: 0, y, z: 0 });
    const { bronzeFlat, bronzeThread } = MP_MATERIALS;

    const merger = new MaterialGroupMerger();
    merger.add(
      ...this.ends.buildRun(params.m1, d1, d3, dc),
      ...this.sleeves.build({
        length: s2,
        outerDiameter: dc.n,
        innerDiameter: dc.v,
        outerDiameterStart: d2.n,
        innerDiameterStart: d2.v,
        center: at(s2 / 2),
        rotation: { x: 0, y: 0, z: -Math.PI / 2 },
      }),
      ...this.sleeves.build({ length: s2, outerDiameter: d2.n, innerDiameter: d2.v, center: at(1.5 * s2), rotation: up }),
      // Гайка в конце трубы отвода: в gl2 внутренний диаметр — n/2 резьбы (tb2.n), перенесено как есть
      ...this.sleeves.build({
        length: NUT_LENGTH,
        outerDiameter: d2.n + 0.01,
        innerDiameter: d2.n / 2,
        outerSegments: 6,
        center: at(2 * s2 - NUT_LENGTH / 2),
        rotation: up,
        materials: { outer: bronzeFlat },
      }),
      ...this.sleeves.build({
        length: w2,
        outerDiameter: d2.n,
        innerDiameter: d2.v,
        center: at(2 * s2 + w2 / 2),
        rotation: up,
        materials: internal ? { inner: bronzeThread } : { outer: bronzeThread },
      }),
    );

    // Пресс: торцы — концы гильз. Резьба: торец — конец резьбы (m2), глубина — её длина.
    // В gl2 точки стояли в центрах гильз и резьбы.
    const press = { joint: 'mp-press', gender: 'internal' } as const;
    const suffix = internal ? '(в)' : '(н)';
    const { left, top, right } = ConnectorFrame;
    return MeshModel.create({
      title: `Тройник ${params.r1}x${params.r2}${suffix}x${params.r3}`,
      geometry: merger.merge(),
      materials: MpPressEnd.meshMaterials(this.materials),
      connectors: [
        { id: 'left', position: ConnectorFrame.point(left, params.m1 / 2), ...left, depth: MpPressEnd.pressLength(d1), nominal: params.r1, ...press },
        {
          id: 'top',
          position: ConnectorFrame.point(top, params.m2),
          ...top,
          depth: w2,
          nominal: params.r2,
          joint: 'thread',
          gender: internal ? 'internal' : 'external',
        },
        { id: 'right', position: ConnectorFrame.point(right, params.m1 / 2), ...right, depth: MpPressEnd.pressLength(d3), nominal: params.r3, ...press },
      ],
    });
  }
}
