import { BaseGenerator } from '../../core/BaseGenerator';
import { connector } from '../../core/connector';
import { ConnectorFrame } from '../../core/ConnectorFrame';
import type { GeneratedModel, ParamSpec } from '../../core/contracts';
import { createMeshModel } from '../../core/MeshModel';
import { MaterialGroupMerger } from '../../geometry/MaterialGroupMerger';
import { sleeves } from '../../geometry/SleeveGeometryBuilder';
import { SEAT_DEPTH } from '../manifold/ManifoldInserts';
import { orientParts } from '../ThreadedParts';

/** Положение шкалы: '*' — защита от замерзания (6,5 °C), '5' — 28 °C, шток убран. */
export type ThermostaticHeadSetting = '*' | '1' | '2' | '3' | '4' | '5';

export interface ThermostaticHeadParams {
  setting: ThermostaticHeadSetting;
}

const SETTINGS: readonly ThermostaticHeadSetting[] = ['*', '1', '2', '3', '4', '5'];
/**
 * VALTEC VT.5000 (каталог 2017, с. 576): диаметр 50 мм, высота с гайкой 76–81 мм по положению шкалы.
 * Высота растёт к '5' (шток убран) — линейно, условно. Гайка, шейка и профиль корпуса — условно.
 */
const HEAD = { diameter: 0.05, minHeight: 0.076, maxHeight: 0.081, nut: 0.012, nutDiameter: 0.036 };

const span = (from: number, to: number) => ({ length: to - from, center: { x: (from + to) / 2, y: 0, z: 0 } });

/**
 * Жидкостная термоголовка (позиция 97) отдельной моделью. Ставится на посадочное место M30×1,5
 * радиаторного термоклапана (head 'none') и на термоклапан коллектора без ручки — система valve-head,
 * как привод 69. Основание — торец гайки (y = 0), корпус вверх по +Y.
 */
export class ThermostaticHeadGenerator extends BaseGenerator<ThermostaticHeadParams> {
  readonly id = 'valve.thermostatic-head';
  readonly version = 1;
  readonly title = 'Головка термостатическая';
  readonly paramSpecs: readonly ParamSpec[] = [
    { kind: 'choice', key: 'setting', label: 'Шкала', options: SETTINGS, optionLabels: { '*': '✱ (6,5 °C)', 5: '5 (28 °C)' } },
  ];
  readonly defaults: ThermostaticHeadParams = { setting: '3' };

  protected create(p: ThermostaticHeadParams): GeneratedModel {
    const height = HEAD.minHeight + (HEAD.maxHeight - HEAD.minHeight) * SETTINGS.indexOf(p.setting) / (SETTINGS.length - 1);
    const shoulder = HEAD.nut + 0.02;
    const top = height - 0.006;
    const parts = [
      ...sleeves.build({ material: 'metal', ...span(0, HEAD.nut), outerDiameter: HEAD.nutDiameter, innerDiameter: 0.0302,
        outerSegments: 40, materials: { outer: 'metalFlat' } }),
      ...sleeves.build({ material: 'plastic', ...span(HEAD.nut, HEAD.nut + 0.006), outerDiameter: 0.034, innerDiameter: 0 }),
      ...sleeves.build({ material: 'plastic', ...span(HEAD.nut + 0.006, shoulder - 0.002), outerDiameterStart: 0.04,
        outerDiameter: HEAD.diameter, innerDiameter: 0 }),
      // Тёмное кольцо шкалы между неподвижной и поворотной частями.
      ...sleeves.build({ material: 'black', ...span(shoulder - 0.002, shoulder), outerDiameter: HEAD.diameter, innerDiameter: 0 }),
      ...sleeves.build({ material: 'plastic', ...span(shoulder, top), outerDiameterStart: HEAD.diameter, outerDiameter: HEAD.diameter - 0.003,
        innerDiameter: 0, outerSegments: 24, materials: { outer: 'plasticFlat' } }),
      ...sleeves.build({ material: 'plastic', ...span(top, height), outerDiameterStart: HEAD.diameter - 0.003,
        outerDiameter: HEAD.diameter - 0.012, innerDiameter: 0 }),
    ];
    const merger = new MaterialGroupMerger();
    // Втулки строятся по +X; модель — по +Y.
    merger.add(...orientParts(parts, ConnectorFrame.top.direction));
    return createMeshModel({
      title: `Головка термостатическая M30x1,5, шкала ${p.setting}`,
      ...merger.merge(),
      connectors: [connector('valve', ConnectorFrame.bottom, { x: 0, y: 0, z: 0 }, { nominal: 'M30x1.5', joint: 'valve-head', gender: 'internal', depth: SEAT_DEPTH })],
    });
  }
}
