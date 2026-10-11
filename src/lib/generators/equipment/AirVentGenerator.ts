import { BaseGenerator } from '../../core/BaseGenerator';
import { connector } from '../../core/connector';
import { ConnectorFrame } from '../../core/ConnectorFrame';
import type { GeneratedModel, ParamSpec } from '../../core/contracts';
import { createMeshModel } from '../../core/MeshModel';
import { MaterialGroupMerger } from '../../geometry/MaterialGroupMerger';
import type { GeometryPart } from '../../geometry/MaterialGroupMerger';
import { sleeves } from '../../geometry/SleeveGeometryBuilder';
import { orientParts, threadedSize } from '../ThreadedParts';
import type { ThreadedSize } from '../ThreadedParts';

/** Исполнения VALTEC VT.502: NH — снизу, выпуск сбоку; NV — снизу, выпуск сверху; NA — сбоку, выпуск сверху. */
export type AirVentExecution = 'NH' | 'NV' | 'NA';

export interface AirVentParams {
  execution: AirVentExecution;
}

/**
 * VALTEC VT.502 (технический каталог 2017, с. 444; фото-каталог, с. 136), м: G1/2 НР, высота
 * от торца резьбы до верха 57, резьба 10,5, колба Ø40, боковой выпуск NH — 32,5 от оси.
 * Шестигранник, доли колбы и крышки, выпуск NV и NA, корпус NA — условно (чертёж только у NH).
 */
const HEIGHT = 0.057;
const THREAD = 0.0105;
const HEX = { length: 0.006, corners: 0.03 };
const BODY = 0.04;
const SIDE_OUTLET = 0.0325;
/** Выпуск: штуцер и колпачок, высота бокового выпуска к высоте корпуса — условно. */
const NOZZLE = { diameter: 0.008, cap: 0.01, capLength: 0.006, length: 0.012 };
const SIDE_OUTLET_SHARE = 0.8;
const NOMINAL = '1/2';

const alongY = { x: 0, y: 0, z: Math.PI / 2 };
const spanY = (from: number, to: number, x = 0) => ({ length: to - from, center: { x, y: (from + to) / 2, z: 0 }, rotation: alongY });

const TITLES: Readonly<Record<AirVentExecution, string>> = {
  NH: 'вертикальный, выпуск сбоку', NV: 'прямой, выпуск сверху', NA: 'угловой, выпуск сверху',
};

/**
 * Автоматический поплавковый воздухоотводчик (позиция 109) по образцу VALTEC VT.502: латунь
 * никелированная, колба вертикально, выпуск воздуха — свободная граница. Монтаж строго вертикально:
 * NH и NV ставятся на выход вверх, NA — на боковой выход. Перед ним — отсекающий клапан 110.
 */
export class AirVentGenerator extends BaseGenerator<AirVentParams, ThreadedSize> {
  readonly id = 'equipment.air-vent';
  readonly version = 1;
  readonly title = 'Воздухоотводчик автоматический';
  readonly paramSpecs: readonly ParamSpec[] = [
    { kind: 'choice', key: 'execution', label: 'Исполнение', options: ['NH', 'NV', 'NA'], optionLabels: TITLES },
  ];
  readonly defaults: AirVentParams = { execution: 'NH' };

  protected override layout(): ThreadedSize {
    return threadedSize(NOMINAL, 'external');
  }

  protected create(p: AirVentParams, thread: ThreadedSize): GeneratedModel {
    const side = p.execution === 'NA';
    // Низ колбы: у NH и NV — над шестигранником, у NA — колба опущена так, что ось бокового входа на её середине.
    const bodyHeight = HEIGHT - THREAD - HEX.length;
    const bodyBottom = side ? -bodyHeight / 2 : THREAD + HEX.length;
    const top = bodyBottom + bodyHeight;
    const merger = new MaterialGroupMerger();

    merger.add(
      // Колба чуть уже крышки; крышка — верхняя треть.
      ...sleeves.build({ material: 'metal', ...spanY(bodyBottom, top - bodyHeight / 3), outerDiameter: BODY * 0.95, innerDiameter: 0 }),
      ...sleeves.build({ material: 'metal', ...spanY(top - bodyHeight / 3, top), outerDiameter: BODY, innerDiameter: 0 }),
      ...orientParts(this.inlet(thread), side ? ConnectorFrame.left.direction : ConnectorFrame.bottom.direction,
        side ? { x: -(BODY * 0.95 / 2 - 0.001), y: 0, z: 0 } : { x: 0, y: THREAD + HEX.length, z: 0 }),
    );
    if (p.execution === 'NH') {
      merger.add(...orientParts(this.nozzle(SIDE_OUTLET - (BODY / 2 - 0.001)), ConnectorFrame.right.direction,
        { x: BODY / 2 - 0.001, y: bodyBottom + bodyHeight * SIDE_OUTLET_SHARE, z: 0 }));
    } else {
      merger.add(...orientParts(this.nozzle(NOZZLE.length), ConnectorFrame.top.direction, { x: 0, y: top - 0.001, z: 0 }));
    }

    const at = side ? { x: -(BODY * 0.95 / 2 - 0.001) - HEX.length - THREAD, y: 0, z: 0 } : { x: 0, y: 0, z: 0 };
    return createMeshModel({
      title: `Воздухоотводчик автоматический ${NOMINAL}(н) ${TITLES[p.execution]} (VT.502.${p.execution})`,
      ...merger.merge(),
      connectors: [connector('inlet', side ? ConnectorFrame.left : ConnectorFrame.bottom, at,
        { nominal: NOMINAL, joint: 'thread', gender: 'external', depth: THREAD })],
    });
  }

  /** Вход по +X от корпуса (начало — у колбы): шестигранник под ключ, затем наружная резьба до торца. */
  private inlet(thread: ThreadedSize): GeometryPart[] {
    return [
      ...sleeves.build({ material: 'metal', length: HEX.length + 0.001, outerDiameter: HEX.corners, innerDiameter: 0, outerSegments: 6,
        center: { x: (HEX.length - 0.001) / 2, y: 0, z: 0 }, materials: { outer: 'metalFlat' } }),
      ...sleeves.build({ material: 'metal', length: THREAD, outerDiameter: thread.n, innerDiameter: thread.v * 0.5,
        center: { x: HEX.length + THREAD / 2, y: 0, z: 0 }, materials: { outer: 'thread' } }),
    ];
  }

  /** Выпуск воздуха по +X: штуцер от корпуса и чёрный колпачок на конце длиной reach. */
  private nozzle(reach: number): GeometryPart[] {
    const stem = reach - NOZZLE.capLength;
    return [
      ...sleeves.build({ material: 'metal', length: stem + 0.001, outerDiameter: NOZZLE.diameter, innerDiameter: 0, center: { x: (stem - 0.001) / 2, y: 0, z: 0 } }),
      ...sleeves.build({ material: 'black', length: NOZZLE.capLength, outerDiameter: NOZZLE.cap, innerDiameter: 0, outerSegments: 12,
        center: { x: stem + NOZZLE.capLength / 2, y: 0, z: 0 }, materials: { outer: 'blackFlat' } }),
    ];
  }
}
