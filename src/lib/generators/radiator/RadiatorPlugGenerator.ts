import { BaseGenerator } from '../../core/BaseGenerator';
import { connector } from '../../core/connector';
import { ConnectorFrame } from '../../core/ConnectorFrame';
import type { GeneratedModel, ParamSpec } from '../../core/contracts';
import { createMeshModel } from '../../core/MeshModel';
import { shapes } from '../../geometry/ExtrudedShapeBuilder';
import { MaterialGroupMerger } from '../../geometry/MaterialGroupMerger';
import { sleeves } from '../../geometry/SleeveGeometryBuilder';
import { specs } from '../../params/specs';
import { ThreadSizes } from '../../sizes/ThreadSizes';

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

const TITLES: Record<RadiatorPlugType, string> = {
  prh: 'перех.радиаторный',
  zgl: 'заглушка радиаторная',
  vsd: 'воздухоотв.радиаторный',
};

/**
 * Радиаторные переходник, заглушка и воздухоотводчик (перенос al_zagl_radiator_1).
 * Сторона в радиатор — резьба radiator-thread, к портам радиатора подходит только она.
 */
export class RadiatorPlugGenerator extends BaseGenerator<RadiatorPlugParams> {
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
    specs.threadNominal('r1', 'Резьба в радиатор'),
    { kind: 'choice', key: 'r2', label: 'Резьба выхода', options: ThreadSizes.nominals, when: { key: 'type', values: ['prh'] } },
  ];

  protected create(params: RadiatorPlugParams): GeneratedModel {
    const outlet = params.type === 'prh' ? String(params.r2) : null;
    // В gl2 сторона в радиатор считается как внутренняя резьба (side: 'v'): n = d, v = d − t.
    const d1 = ThreadSizes.require(params.r1, 'internal');
    const d2 = outlet ? ThreadSizes.require(outlet, 'external') : { n: 0, v: 0 };
    const at = (x: number) => ({ x, y: 0, z: 0 });
    const nutX = COLLAR / 2 + NUT / 2;

    const merger = new MaterialGroupMerger();
    merger.add(
      // Резьба в радиатор (наружная)
      ...sleeves.build({
        material: 'plastic',
        length: RADIATOR_THREAD,
        outerDiameter: d1.n,
        innerDiameter: d1.v,
        center: at(-(COLLAR / 2 + RADIATOR_THREAD / 2)),
        materials: { outer: 'thread' },
      }),
      // Буртик; у заглушки и воздухоотводчика сплошной
      ...sleeves.build({ material: 'plastic', length: COLLAR, outerDiameter: d1.n + 0.003, innerDiameter: d2.v }),
      // Гайка-шестигранник; у заглушки и воздухоотводчика сплошная
      ...sleeves.build({
        material: 'plastic',
        length: NUT,
        outerDiameter: d1.n,
        innerDiameter: d2.v ? d2.v + 0.001 : 0,
        outerSegments: HEX_SEGMENTS,
        center: at(nutX),
        materials: { outer: 'plasticFlat' },
      }),
    );

    if (outlet) {
      // Внутренняя трубная резьба выхода внутри гайки
      merger.add(
        ...sleeves.build({ material: 'plastic', length: NUT, outerDiameter: d2.n, innerDiameter: d2.v, center: at(nutX), materials: { inner: 'thread' } }),
      );
    }

    if (params.type === 'vsd') {
      const p = (x: number, y: number) => ({ x, y });
      merger.add(
        ...sleeves.build({
          length: VENT.disk,
          outerDiameter: VENT.diameter,
          innerDiameter: 0,
          center: at(COLLAR / 2 + NUT + VENT.disk / 2),
          material: 'metal',
        }),
        shapes.build({
          points: [p(0, -VENT.height / 2), p(0, VENT.height / 2), p(VENT.width, VENT.height / 2), p(VENT.width / 2, 0), p(VENT.width, -VENT.height / 2)],
          depth: VENT.thickness,
          position: { x: COLLAR / 2 + NUT + VENT.disk, y: 0, z: -VENT.thickness / 2 },
          // В gl2 бабочка получает white_1 (сливается со смещением индекса 0), а не металл, как диск.
          material: 'plastic',
        }),
      );
    }

    const title = outlet ? `${TITLES.prh} ${outlet}` : TITLES[params.type];

    // Торцы — конец резьбы в радиатор и торец гайки выхода; глубина — длина резьбы.
    // В gl2 точки стояли в центрах резьбовых участков.
    const connectors = [
      connector('radiator', ConnectorFrame.left, COLLAR / 2 + RADIATOR_THREAD, {
        depth: RADIATOR_THREAD,
        nominal: params.r1,
        joint: 'radiator-thread',
        gender: 'external',
      }),
    ];
    if (outlet) {
      connectors.push(connector('outlet', ConnectorFrame.right, COLLAR / 2 + NUT, { depth: NUT, nominal: outlet, joint: 'thread', gender: 'internal' }));
    }

    return createMeshModel({ title, ...merger.merge(), connectors });
  }
}
