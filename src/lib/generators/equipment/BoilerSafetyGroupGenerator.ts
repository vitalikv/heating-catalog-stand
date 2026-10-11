import { BaseGenerator } from '../../core/BaseGenerator';
import { connector } from '../../core/connector';
import { ConnectorFrame } from '../../core/ConnectorFrame';
import type { GeneratedModel, ParamSpec } from '../../core/contracts';
import { createMeshModel } from '../../core/MeshModel';
import { shapes } from '../../geometry/ExtrudedShapeBuilder';
import { MaterialGroupMerger } from '../../geometry/MaterialGroupMerger';
import type { GeometryPart } from '../../geometry/MaterialGroupMerger';
import { sleeves } from '../../geometry/SleeveGeometryBuilder';
import { spheres } from '../../geometry/SphereGeometryBuilder';
import { orientParts, threadedSize } from '../ThreadedParts';

export interface BoilerSafetyGroupParams {
  /** Давление настройки предохранительного клапана, бар: VT.461 — 7 (подпись на ручке). */
  setting: 7;
}

/**
 * VALTEC VT.461 (технический каталог 2017, с. 440–441), м: от оси корпуса до торца входа холодной воды 47,5,
 * до края ручки предохранительного клапана 53; высота от торца слива до торца к бойлеру 151.
 * Положения узлов по высоте, диаметры корпуса и ручек — по эскизу, условно.
 */
const SIZE = { inlet: 0.0475, knob: 0.053, top: 0.056, bottom: 0.095 };
/** Высоты осей: вход холодной воды с краном и обратным клапаном, предохранительный клапан. */
const LEVEL = { inlet: 0.02, valve: -0.03 };
const BODY = 0.032;
const KNOB = { diameter: 0.034, length: 0.026 };

/**
 * Группа безопасности бойлера (позиция 112) по VALTEC VT.461 в монтажном положении: снизу вверх по оси —
 * слив 1 1/4 (н) в дренаж (воронка разрыва струи — свободная граница, отдельной моделью не делается),
 * камера предохранительного клапана (красная ручка вправо, +X), камера обратного клапана с пробкой и сверху
 * патрубок к бойлеру 3/4 (в). Холодная вода входит слева (−X) через шаровой кран с чёрной ручкой вперёд (+Z).
 * Отдельный ID: группа безопасности котла gl2 (equipment.safety-group) — коллектор с манометром и
 * воздухоотводчиком, общего у них нет.
 */
export class BoilerSafetyGroupGenerator extends BaseGenerator<BoilerSafetyGroupParams> {
  readonly id = 'equipment.boiler-safety-group';
  readonly version = 1;
  readonly title = 'Группа безопасности бойлера';
  readonly paramSpecs: readonly ParamSpec[] = [{ kind: 'choice', key: 'setting', label: 'Настройка, бар', options: [7] }];
  readonly defaults: BoilerSafetyGroupParams = { setting: 7 };

  protected create(p: BoilerSafetyGroupParams): GeneratedModel {
    const boiler = threadedSize('3/4', 'internal');
    const cold = threadedSize('3/4', 'external');
    const drain = threadedSize('1 1/4', 'external');
    const up = { x: 0, y: 1, z: 0 };
    const at = (x: number, y = 0) => ({ x, y, z: 0 });
    const along = (from: number, to: number, y = 0) => ({ length: to - from, center: at((from + to) / 2, y) });
    const merger = new MaterialGroupMerger();
    merger.add(
      // Корпус по оси: от слива до гайки бойлера.
      ...orientParts(sleeves.build({ material: 'metal', ...along(-SIZE.bottom + drain.depth, SIZE.top - boiler.depth), outerDiameter: BODY, innerDiameter: 0 }), up),
      // К бойлеру: шестигранник с внутренней резьбой 3/4.
      ...orientParts(sleeves.build({ material: 'metal', ...along(SIZE.top - boiler.depth, SIZE.top), outerDiameter: boiler.n * 1.35,
        innerDiameter: boiler.v, outerSegments: 6, materials: { outer: 'metalFlat', inner: 'thread' } }), up),
      // Слив: наружная резьба 1 1/4.
      ...orientParts(sleeves.build({ material: 'metal', ...along(-SIZE.bottom, -SIZE.bottom + drain.depth), outerDiameter: drain.n,
        innerDiameter: drain.v, materials: { outer: 'thread' } }), up),
      // Вход холодной воды: патрубок, шар крана, наружная резьба 3/4 на конце.
      ...sleeves.build({ material: 'metal', ...along(-SIZE.inlet + cold.depth, 0, LEVEL.inlet), outerDiameter: cold.n + 0.004, innerDiameter: 0 }),
      ...sleeves.build({ material: 'metal', ...along(-SIZE.inlet, -SIZE.inlet + cold.depth, LEVEL.inlet), outerDiameter: cold.n,
        innerDiameter: cold.v, materials: { outer: 'thread' } }),
      spheres.build({ material: 'metal', radius: 0.015, center: at(-0.022, LEVEL.inlet) }),
      ...this.ballHandle(-0.022, LEVEL.inlet),
      // Пробка обратного клапана напротив входа.
      ...sleeves.build({ material: 'metalFlat', ...along(BODY / 2 - 0.002, BODY / 2 + 0.008, LEVEL.inlet), outerDiameter: 0.024, innerDiameter: 0, outerSegments: 6 }),
      // Предохранительный клапан: корпус и рифлёная красная ручка вправо.
      ...sleeves.build({ material: 'metal', ...along(0, SIZE.knob - KNOB.length, LEVEL.valve), outerDiameter: 0.024, innerDiameter: 0 }),
      ...sleeves.build({ material: 'redFlat', ...along(SIZE.knob - KNOB.length, SIZE.knob, LEVEL.valve), outerDiameterStart: KNOB.diameter,
        outerDiameter: KNOB.diameter * 0.85, innerDiameter: 0, outerSegments: 24 }),
    );
    return createMeshModel({
      title: `Группа безопасности бойлера VT.461, ${p.setting} бар`,
      ...merger.merge(),
      connectors: [
        connector('cold', ConnectorFrame.left, at(-SIZE.inlet, LEVEL.inlet), { nominal: '3/4', joint: 'thread', gender: 'external', depth: cold.depth }),
        connector('boiler', ConnectorFrame.top, at(0, SIZE.top), { nominal: '3/4', joint: 'thread', gender: 'internal', depth: boiler.depth }),
        connector('drain', ConnectorFrame.bottom, at(0, -SIZE.bottom), { nominal: '1 1/4', joint: 'thread', gender: 'external', depth: drain.depth }),
      ],
    });
  }

  /** Чёрная ручка шарового крана: шток вперёд и плоский рычаг вниз. */
  private ballHandle(x: number, y: number): GeometryPart[] {
    return [
      ...sleeves.build({ material: 'metal', length: 0.008, outerDiameter: 0.008, innerDiameter: 0, rotation: { x: 0, y: -Math.PI / 2, z: 0 },
        center: { x, y, z: 0.015 + 0.004 } }),
      shapes.build({ material: 'black', depth: 0.005, position: { x, y, z: 0.023 },
        points: [{ x: -0.006, y: 0.004 }, { x: 0.006, y: 0.004 }, { x: 0.004, y: -0.03 }, { x: -0.004, y: -0.03 }] }),
    ];
  }
}
