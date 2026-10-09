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

/** vent — воздухоотводчик, plug — пробка без него. */
export type RadiatorVentKind = 'vent' | 'plug';

export interface RadiatorVentParams {
  /** Дюймовый номинал наружной резьбы, например '1/2'. */
  nominal: string;
  kind: RadiatorVentKind;
}

/** Длины, м: резьба (x_1) и гайка (x_2). */
const THREAD_LENGTH = 0.008;
const NUT_LENGTH = 0.005;
/** Описанный диаметр гайки — n × 1.3. */
const NUT_SCALE = 1.3;
/** Воздухоотводчик: диск и «бабочка», м. */
const VENT = { disk: 0.001, diameter: 0.02, height: 0.016, width: 0.007, thickness: 0.004 };

/**
 * Радиаторный воздухоотводчик с наружной трубной резьбой (перенос rad_vozduhotvod_1):
 * ставится в переходник радиатора. Резьба по −X, сплошная гайка, диск и бабочка по +X.
 */
export class RadiatorVentGenerator extends BaseGenerator<RadiatorVentParams> {
  readonly id = 'radiator.vent';
  readonly version = 1;
  readonly title = 'Воздухоотводчик радиаторный';
  readonly paramSpecs: readonly ParamSpec[] = [
    { kind: 'choice', key: 'kind', label: 'Тип', options: ['vent', 'plug'], optionLabels: { vent: 'воздухоотводчик', plug: 'заглушка' } },
    specs.threadNominal('nominal', 'Резьба (н)'),
  ];
  readonly defaults: RadiatorVentParams = { nominal: '1/2', kind: 'vent' };

  protected create(params: RadiatorVentParams): GeneratedModel {
    const d = ThreadSizes.require(params.nominal, 'external');
    const at = (x: number) => ({ x, y: 0, z: 0 });

    const merger = new MaterialGroupMerger();
    merger.add(
      ...sleeves.build({ material: 'plastic', length: THREAD_LENGTH, outerDiameter: d.n, innerDiameter: d.v, center: at(-THREAD_LENGTH / 2), materials: { outer: 'thread' } }),
      // Сплошная гайка-шестигранник
      ...sleeves.build({
        material: 'plastic',
        length: NUT_LENGTH,
        outerDiameter: d.n * NUT_SCALE,
        innerDiameter: 0,
        outerSegments: 6,
        center: at(NUT_LENGTH / 2),
        materials: { outer: 'plasticFlat' },
      }),
    );

    if (params.kind === 'vent') {
      const p = (x: number, y: number) => ({ x, y });
      merger.add(
        ...sleeves.build({
          length: VENT.disk,
          outerDiameter: VENT.diameter,
          innerDiameter: 0,
          center: at(NUT_LENGTH + VENT.disk / 2),
          material: 'metal',
        }),
        // В gl2 бабочка получает white_1 (сливается со смещением индекса 0).
        shapes.build({
          points: [p(0, -VENT.height / 2), p(0, VENT.height / 2), p(VENT.width, VENT.height / 2), p(VENT.width / 2, 0), p(VENT.width, -VENT.height / 2)],
          depth: VENT.thickness,
          position: { x: NUT_LENGTH + VENT.disk, y: 0, z: -VENT.thickness / 2 },
          material: 'plastic',
        }),
      );
    }

    // Торец — конец резьбы, глубина — её длина. В gl2 точка стояла в центре резьбы.
    return createMeshModel({
      title: params.kind === 'vent' ? `воздухоотв.радиаторный ${params.nominal}` : `заглушка радиаторная ${params.nominal}`,
      ...merger.merge(),
      connectors: [
        connector('left', ConnectorFrame.left, THREAD_LENGTH, { depth: THREAD_LENGTH, nominal: params.nominal, joint: 'thread', gender: 'external' }),
      ],
    });
  }
}
