import { Box3, Group, Mesh } from 'three';
import type { Connector, GeneratedModel, ModelGenerator, ParamSpec, ValidationError } from '../contracts';
import { GeneratorParamsError } from '../GeneratorParamsError';
import { ExtrudedShapeBuilder } from '../geometry/ExtrudedShapeBuilder';
import { MaterialGroupMerger } from '../geometry/MaterialGroupMerger';
import { SleeveGeometryBuilder } from '../geometry/SleeveGeometryBuilder';
import type { MaterialLibrary } from '../materials/MaterialLibrary';
import { ParamSchema } from '../params/ParamSchema';
import { ThreadSizes } from '../sizes/ThreadSizes';

/** prh — переходник на трубную резьбу, zgl — заглушка, vsd — воздухоотводчик. */
export type RadiatorPlugType = 'prh' | 'zgl' | 'vsd';

/** Параметры в формате cdm из gl2. */
export interface RadiatorPlugParams {
  type: RadiatorPlugType;
  /** Номинал резьбы порта радиатора, например '1'. */
  r1: string;
  /** Номинал внутренней трубной резьбы выхода; только для prh. В gl2 у zgl и vsd — 0. */
  r2?: string | 0;
}

/** Длины, м: резьба в радиатор (x_1), гайка (x_2), буртик (x_3). */
const RADIATOR_THREAD = 0.008;
const NUT = 0.005;
const COLLAR = 0.003;
const HEX_SEGMENTS = 6;
/** Воздухоотводчик: диск и «бабочка», м. */
const VENT = { disk: 0.001, diameter: 0.02, height: 0.016, width: 0.007, thickness: 0.004 };

/** Индексы материалов меша. */
const PLASTIC = 0;
const THREAD = 1;
const PLASTIC_FLAT = 2;
const METAL = 3;

const TITLES: Record<RadiatorPlugType, string> = {
  prh: 'перех.радиаторный',
  zgl: 'заглушка радиаторная',
  vsd: 'воздухоотв.радиаторный',
};

/**
 * Радиаторные переходник, заглушка и воздухоотводчик (перенос al_zagl_radiator_1).
 * Сторона в радиатор — резьба radiator-thread, к портам радиатора подходит только она.
 */
export class RadiatorPlugGenerator implements ModelGenerator<RadiatorPlugParams> {
  readonly id = 'al_zagl_radiator_1';
  readonly title = 'Радиаторный переходник / заглушка';
  readonly paramSpecs: readonly ParamSpec[] = [
    {
      kind: 'choice',
      key: 'type',
      label: 'Тип',
      options: ['prh', 'zgl', 'vsd'],
      optionLabels: { prh: 'переходник', zgl: 'заглушка', vsd: 'воздухоотводчик' },
    },
    { kind: 'choice', key: 'r1', label: 'Резьба в радиатор', options: ThreadSizes.nominals },
    { kind: 'choice', key: 'r2', label: 'Резьба выхода', options: ThreadSizes.nominals, when: { key: 'type', values: ['prh'] } },
  ];

  private readonly sleeves = new SleeveGeometryBuilder();
  private readonly shapes = new ExtrudedShapeBuilder();

  constructor(private readonly materials: MaterialLibrary) {}

  validate(params: RadiatorPlugParams): ValidationError[] {
    return ParamSchema.validate(this.paramSpecs, params);
  }

  build(params: RadiatorPlugParams): GeneratedModel {
    const errors = this.validate(params);
    if (errors.length > 0) throw new GeneratorParamsError(this.id, errors);

    const outlet = params.type === 'prh' ? String(params.r2) : null;
    // В gl2 сторона в радиатор считается как внутренняя резьба (side: 'v'): n = d, v = d − t.
    const d1 = ThreadSizes.diameters(params.r1, 'internal')!;
    const d2 = outlet ? ThreadSizes.diameters(outlet, 'external')! : { n: 0, v: 0 };
    const at = (x: number) => ({ x, y: 0, z: 0 });
    const nutX = COLLAR / 2 + NUT / 2;

    const merger = new MaterialGroupMerger();
    merger.add(
      // Резьба в радиатор (наружная)
      ...this.sleeves.build({
        length: RADIATOR_THREAD,
        outerDiameter: d1.n,
        innerDiameter: d1.v,
        center: at(-(COLLAR / 2 + RADIATOR_THREAD / 2)),
        materials: { outer: THREAD, inner: PLASTIC, start: PLASTIC, end: PLASTIC },
      }),
      // Буртик; у заглушки и воздухоотводчика сплошной
      ...this.sleeves.build({ length: COLLAR, outerDiameter: d1.n + 0.003, innerDiameter: d2.v, materials: { outer: PLASTIC } }),
      // Гайка-шестигранник; у заглушки и воздухоотводчика сплошная
      ...this.sleeves.build({
        length: NUT,
        outerDiameter: d1.n,
        innerDiameter: d2.v ? d2.v + 0.001 : 0,
        outerSegments: HEX_SEGMENTS,
        center: at(nutX),
        materials: { outer: PLASTIC_FLAT },
      }),
    );

    if (outlet) {
      // Внутренняя трубная резьба выхода внутри гайки
      merger.add(
        ...this.sleeves.build({ length: NUT, outerDiameter: d2.n, innerDiameter: d2.v, center: at(nutX), materials: { inner: THREAD } }),
      );
    }

    if (params.type === 'vsd') {
      const metal = { outer: METAL, inner: METAL, start: METAL, end: METAL };
      const p = (x: number, y: number) => ({ x, y });
      merger.add(
        ...this.sleeves.build({
          length: VENT.disk,
          outerDiameter: VENT.diameter,
          innerDiameter: 0,
          center: at(COLLAR / 2 + NUT + VENT.disk / 2),
          materials: metal,
        }),
        this.shapes.build({
          points: [p(0, -VENT.height / 2), p(0, VENT.height / 2), p(VENT.width, VENT.height / 2), p(VENT.width / 2, 0), p(VENT.width, -VENT.height / 2)],
          depth: VENT.thickness,
          position: { x: COLLAR / 2 + NUT + VENT.disk, y: 0, z: -VENT.thickness / 2 },
          materialIndex: METAL,
        }),
      );
    }

    const geometry = merger.merge();
    geometry.computeBoundingBox();
    const bounds = new Box3().copy(geometry.boundingBox!);

    const mesh = new Mesh(geometry, [
      this.materials.get('plastic'),
      this.materials.get('thread'),
      this.materials.get('plasticFlat'),
      this.materials.get('metal'),
    ]);
    const root = new Group();
    const title = outlet ? `${TITLES.prh} ${outlet}` : TITLES[params.type];
    root.name = title;
    root.add(mesh);

    // Торцы — конец резьбы в радиатор и торец гайки выхода; глубина — длина резьбы.
    // В gl2 точки стояли в центрах резьбовых участков.
    const connectors: Connector[] = [
      {
        id: 'radiator',
        position: at(-(COLLAR / 2 + RADIATOR_THREAD)),
        direction: { x: -1, y: 0, z: 0 },
        depth: RADIATOR_THREAD,
        nominal: params.r1,
        joint: 'radiator-thread',
        gender: 'external',
      },
    ];
    if (outlet) {
      connectors.push({
        id: 'outlet',
        position: at(COLLAR / 2 + NUT),
        direction: { x: 1, y: 0, z: 0 },
        depth: NUT,
        nominal: outlet,
        joint: 'thread',
        gender: 'internal',
      });
    }

    let disposed = false;
    return {
      root,
      title,
      connectors,
      bounds,
      warnings: [],
      dispose: () => {
        if (disposed) return;
        disposed = true;
        geometry.dispose();
      },
    };
  }
}
