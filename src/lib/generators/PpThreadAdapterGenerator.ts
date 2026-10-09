import type { GeneratedModel, ModelGenerator, ParamSpec, ValidationError } from '../contracts';
import { GeneratorParamsError } from '../GeneratorParamsError';
import { MaterialGroupMerger } from '../geometry/MaterialGroupMerger';
import { SleeveGeometryBuilder } from '../geometry/SleeveGeometryBuilder';
import type { MaterialLibrary } from '../materials/MaterialLibrary';
import { ParamSchema } from '../params/ParamSchema';
import { PpPipeSizes } from '../sizes/PpPipeSizes';
import { ThreadSizes } from '../sizes/ThreadSizes';
import { ConnectorFrame } from './ConnectorFrame';
import { MeshModel } from './MeshModel';
import { PP_THREAD_MATERIALS, PpThreadInsert } from './PpThreadInsert';
import type { ThreadSideCode } from './SteelElbowGenerator';

/** Параметры в формате cdm из gl2. */
export interface PpThreadAdapterParams {
  /** Сторона резьбы справа. */
  side: ThreadSideCode;
  /** Наружный диаметр ПП-трубы слева, мм, строкой. */
  r1: string;
  /** Дюймовый номинал резьбы справа. */
  r2: string;
  /** Длина, м. */
  m1: number;
}

/** Длины раструба и резьбы — 0,3 наружного диаметра, не меньше 12 мм. */
const MIN_PART_LENGTH = 0.012;

/**
 * Полипропиленовый соединитель с резьбой (перенос pl_perehod_rezba_1): слева раструб
 * под пайку, справа металлическая резьбовая вставка в 12-гранном корпусе.
 */
export class PpThreadAdapterGenerator implements ModelGenerator<PpThreadAdapterParams> {
  readonly id = 'pl_perehod_rezba_1';
  readonly title = 'Соединитель ПП с резьбой';
  readonly paramSpecs: readonly ParamSpec[] = [
    { kind: 'choice', key: 'side', label: 'Резьба', options: ['v', 'n'], optionLabels: { v: 'внутренняя', n: 'наружная' } },
    { kind: 'choice', key: 'r1', label: 'Труба, мм', options: PpPipeSizes.nominals },
    { kind: 'choice', key: 'r2', label: 'Номинал резьбы', options: ThreadSizes.nominals },
    { kind: 'length', key: 'm1', label: 'Длина', min: 0.001, max: 0.2, step: 0.0005 },
  ];

  private readonly sleeves = new SleeveGeometryBuilder();

  constructor(private readonly materials: MaterialLibrary) {}

  validate(params: PpThreadAdapterParams): ValidationError[] {
    const errors = ParamSchema.validate(this.paramSpecs, params);
    if (errors.length === 0) {
      const { x1, x2 } = this.layout(params);
      if (params.m1 / 2 <= Math.max(x1, x2)) errors.push(ParamSchema.tooShort('m1', 2 * Math.max(x1, x2)));
    }
    return errors;
  }

  build(params: PpThreadAdapterParams): GeneratedModel {
    const errors = this.validate(params);
    if (errors.length > 0) throw new GeneratorParamsError(this.id, errors);

    const d1 = PpPipeSizes.diameters(params.r1)!;
    const insert = new PpThreadInsert(params.side, params.r2, d1);
    const { x1, x2 } = this.layout(params);
    const x3L = params.m1 / 2 - x1;
    const x3R = params.m1 / 2 - x2;
    const pipe = { outerDiameter: d1.n, innerDiameter: d1.v };
    const body = { outerDiameter: insert.body.n, innerDiameter: insert.body.v };
    const at = (x: number) => ({ x, y: 0, z: 0 });
    const bodyCenter = x3R + x2 / 2;

    const merger = new MaterialGroupMerger();
    merger.add(
      // Слева: раструб и гладкая часть
      ...this.sleeves.build({ ...pipe, length: x1, center: at(-(x3L + x1 / 2)) }),
      ...this.sleeves.build({ ...pipe, length: x3L, center: at(-x3L / 2) }),
      // Центр и корпус вставки
      ...this.sleeves.build({ ...body, length: Math.max(d1.n, insert.thread.n) / 7 }),
      ...this.sleeves.build({ ...body, length: x3R, center: at(x3R / 2) }),
      ...this.sleeves.build({ ...body, length: x2, outerSegments: 12, center: at(bodyCenter), materials: { outer: PP_THREAD_MATERIALS.plasticFlat } }),
      // Резьбовая втулка
      ...this.sleeves.build({
        length: x2,
        outerDiameter: insert.thread.n,
        innerDiameter: insert.thread.v,
        center: at(insert.insertCenter(bodyCenter, x2)),
        materials: insert.materials,
      }),
    );

    // Раструб: торец −m1/2, глубина — длина раструба. Резьба: торец — край втулки, глубина — её длина.
    // В gl2 точки стояли в центрах раструба и втулки.
    return MeshModel.create({
      title: `Соединитель ${params.r1}х${params.r2}${insert.suffix}`,
      geometry: merger.merge(),
      materials: [this.materials.get('plastic'), this.materials.get('plasticFlat'), this.materials.get('metal'), this.materials.get('thread')],
      connectors: [
        { id: 'left', position: at(-params.m1 / 2), ...ConnectorFrame.left, depth: x1, nominal: params.r1, joint: 'pp-socket', gender: 'internal' },
        {
          id: 'right',
          position: at(insert.face(params.m1 / 2, x2)),
          ...ConnectorFrame.right,
          depth: x2,
          nominal: params.r2,
          joint: 'thread',
          gender: insert.gender,
        },
      ],
    });
  }

  /** Длины раструба (x_1) и резьбы (x_2); вызывать только для известных номиналов. */
  private layout(params: PpThreadAdapterParams): { x1: number; x2: number } {
    const d2 = ThreadSizes.diameters(params.r2, params.side === 'v' ? 'internal' : 'external')!;
    return {
      x1: Math.max(0.015 * PpPipeSizes.diameters(params.r1)!.n * 20, MIN_PART_LENGTH),
      x2: Math.max(0.015 * d2.n * 20, MIN_PART_LENGTH),
    };
  }
}
