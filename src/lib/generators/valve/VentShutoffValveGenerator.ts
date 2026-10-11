import { BaseGenerator } from '../../core/BaseGenerator';
import { connector } from '../../core/connector';
import { ConnectorFrame } from '../../core/ConnectorFrame';
import type { GeneratedModel, ParamSpec } from '../../core/contracts';
import { createMeshModel } from '../../core/MeshModel';
import { MaterialGroupMerger } from '../../geometry/MaterialGroupMerger';
import { sleeves } from '../../geometry/SleeveGeometryBuilder';
import { threadedSize } from '../ThreadedParts';

export type VentShutoffValveParams = Record<string, never>;

/**
 * VALTEC VT.539 (технический каталог 2017, с. 445), м: G1/2 Н снизу × G1/2 В сверху, высота 26,
 * шестигранник под ключ 23. Длина наружной резьбы и глубина внутренней — условно.
 */
const LENGTH = 0.026;
const HEX_ACROSS_FLATS = 0.023;
const THREAD = 0.009;
const NOMINAL = '1/2';

const alongY = { x: 0, y: 0, z: Math.PI / 2 };
const spanY = (from: number, to: number) => ({ length: to - from, center: { x: 0, y: (from + to) / 2, z: 0 }, rotation: alongY });

/**
 * Отсекающий клапан воздухоотводчика (позиция 110) по образцу VALTEC VT.539: снизу наружная резьба
 * в порт трубопровода или коллектора, сверху внутренняя под воздухоотводчик. Подпружиненный
 * золотник открывается, когда воздухоотводчик ввёрнут, и закрывается при его снятии — геометрия
 * от этого не меняется. Латунь никелированная.
 */
export class VentShutoffValveGenerator extends BaseGenerator<VentShutoffValveParams> {
  readonly id = 'valve.vent-shutoff';
  readonly version = 1;
  readonly title = 'Клапан отсекающий для воздухоотводчика';
  readonly paramSpecs: readonly ParamSpec[] = [];
  readonly defaults: VentShutoffValveParams = {};

  protected create(): GeneratedModel {
    const external = threadedSize(NOMINAL, 'external');
    const internal = threadedSize(NOMINAL, 'internal');
    const corners = HEX_ACROSS_FLATS / Math.cos(Math.PI / 6);
    const merger = new MaterialGroupMerger();
    merger.add(
      ...sleeves.build({ material: 'metal', ...spanY(0, THREAD), outerDiameter: external.n, innerDiameter: external.v, materials: { outer: 'thread' } }),
      ...sleeves.build({ material: 'metal', ...spanY(THREAD, LENGTH), outerDiameter: corners, innerDiameter: internal.v, outerSegments: 6,
        materials: { outer: 'metalFlat', inner: 'thread' } }),
      // Золотник из полиамида — белая тарелка в канале под внутренней резьбой.
      ...sleeves.build({ material: 'plastic', ...spanY(THREAD - 0.002, THREAD + 0.002), outerDiameter: external.v * 0.9, innerDiameter: 0 }),
    );
    return createMeshModel({
      title: `Клапан отсекающий для воздухоотводчика ${NOMINAL}(н) × ${NOMINAL}(в) (VT.539)`,
      ...merger.merge(),
      connectors: [
        connector('inlet', ConnectorFrame.bottom, { x: 0, y: 0, z: 0 }, { nominal: NOMINAL, joint: 'thread', gender: 'external', depth: THREAD }),
        connector('vent', ConnectorFrame.top, { x: 0, y: LENGTH, z: 0 }, { nominal: NOMINAL, joint: 'thread', gender: 'internal', depth: LENGTH - THREAD }),
      ],
    });
  }
}
