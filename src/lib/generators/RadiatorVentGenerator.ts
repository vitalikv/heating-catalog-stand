import type { GeneratedModel, ModelGenerator, ParamSpec, ValidationError } from '../contracts';
import { GeneratorParamsError } from '../GeneratorParamsError';
import { ExtrudedShapeBuilder } from '../geometry/ExtrudedShapeBuilder';
import { MaterialGroupMerger } from '../geometry/MaterialGroupMerger';
import { SleeveGeometryBuilder } from '../geometry/SleeveGeometryBuilder';
import type { MaterialLibrary } from '../materials/MaterialLibrary';
import { ParamSchema } from '../params/ParamSchema';
import { ThreadSizes } from '../sizes/ThreadSizes';
import { ConnectorFrame } from './ConnectorFrame';
import { MeshModel } from './MeshModel';

/** vsd — воздухоотводчик, zgl — пробка без него (в gl2 — любой type, кроме 'vsd'). */
export type RadiatorVentType = 'vsd' | 'zgl';

/** Параметры в формате cdm из gl2; r2 и m1 в gl2 не влияют на модель и не переносятся. */
export interface RadiatorVentParams {
  /** Дюймовый номинал наружной резьбы, например '1/2'. */
  r1: string;
  type: RadiatorVentType;
}

/** Длины, м: резьба (x_1) и гайка (x_2). */
const THREAD_LENGTH = 0.008;
const NUT_LENGTH = 0.005;
/** Описанный диаметр гайки — n × 1.3. */
const NUT_SCALE = 1.3;
/** Воздухоотводчик: диск и «бабочка», м. */
const VENT = { disk: 0.001, diameter: 0.02, height: 0.016, width: 0.007, thickness: 0.004 };

/** Индексы материалов меша. */
const PLASTIC = 0;
const THREAD = 1;
const PLASTIC_FLAT = 2;
const METAL = 3;

/**
 * Радиаторный воздухоотводчик с наружной трубной резьбой (перенос rad_vozduhotvod_1):
 * ставится в переходник радиатора. Резьба по −X, сплошная гайка, диск и бабочка по +X.
 */
export class RadiatorVentGenerator implements ModelGenerator<RadiatorVentParams> {
  readonly id = 'rad_vozduhotvod_1';
  readonly title = 'Воздухоотводчик радиаторный';
  readonly paramSpecs: readonly ParamSpec[] = [
    { kind: 'choice', key: 'type', label: 'Тип', options: ['vsd', 'zgl'], optionLabels: { vsd: 'воздухоотводчик', zgl: 'заглушка' } },
    { kind: 'choice', key: 'r1', label: 'Резьба (н)', options: ThreadSizes.nominals },
  ];

  private readonly sleeves = new SleeveGeometryBuilder();
  private readonly shapes = new ExtrudedShapeBuilder();

  constructor(private readonly materials: MaterialLibrary) {}

  validate(params: RadiatorVentParams): ValidationError[] {
    return ParamSchema.validate(this.paramSpecs, params);
  }

  build(params: RadiatorVentParams): GeneratedModel {
    const errors = this.validate(params);
    if (errors.length > 0) throw new GeneratorParamsError(this.id, errors);

    const d = ThreadSizes.diameters(params.r1, 'external')!;
    const at = (x: number) => ({ x, y: 0, z: 0 });

    const merger = new MaterialGroupMerger();
    merger.add(
      ...this.sleeves.build({ length: THREAD_LENGTH, outerDiameter: d.n, innerDiameter: d.v, center: at(-THREAD_LENGTH / 2), materials: { outer: THREAD } }),
      // Сплошная гайка-шестигранник
      ...this.sleeves.build({
        length: NUT_LENGTH,
        outerDiameter: d.n * NUT_SCALE,
        innerDiameter: 0,
        outerSegments: 6,
        center: at(NUT_LENGTH / 2),
        materials: { outer: PLASTIC_FLAT },
      }),
    );

    if (params.type === 'vsd') {
      const p = (x: number, y: number) => ({ x, y });
      merger.add(
        ...this.sleeves.build({
          length: VENT.disk,
          outerDiameter: VENT.diameter,
          innerDiameter: 0,
          center: at(NUT_LENGTH + VENT.disk / 2),
          materials: { outer: METAL, inner: METAL, start: METAL, end: METAL },
        }),
        // В gl2 бабочка сливается со смещением индекса 0 и получает white_1.
        this.shapes.build({
          points: [p(0, -VENT.height / 2), p(0, VENT.height / 2), p(VENT.width, VENT.height / 2), p(VENT.width / 2, 0), p(VENT.width, -VENT.height / 2)],
          depth: VENT.thickness,
          position: { x: NUT_LENGTH + VENT.disk, y: 0, z: -VENT.thickness / 2 },
          materialIndex: PLASTIC,
        }),
      );
    }

    // Торец — конец резьбы, глубина — её длина. В gl2 точка стояла в центре резьбы.
    return MeshModel.create({
      title: params.type === 'vsd' ? `воздухоотв.радиаторный ${params.r1}` : `заглушка радиаторная ${params.r1}`,
      geometry: merger.merge(),
      materials: [this.materials.get('plastic'), this.materials.get('thread'), this.materials.get('plasticFlat'), this.materials.get('metal')],
      connectors: [
        {
          id: 'left',
          position: at(-THREAD_LENGTH),
          ...ConnectorFrame.left,
          depth: THREAD_LENGTH,
          nominal: params.r1,
          joint: 'thread',
          gender: 'external',
        },
      ],
    });
  }
}
