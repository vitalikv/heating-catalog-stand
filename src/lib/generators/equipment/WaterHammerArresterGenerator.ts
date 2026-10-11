import { BaseGenerator } from '../../core/BaseGenerator';
import { connector } from '../../core/connector';
import { ConnectorFrame } from '../../core/ConnectorFrame';
import type { GeneratedModel, ParamSpec } from '../../core/contracts';
import { createMeshModel } from '../../core/MeshModel';
import { MaterialGroupMerger } from '../../geometry/MaterialGroupMerger';
import type { GeometryPart } from '../../geometry/MaterialGroupMerger';
import { sleeves } from '../../geometry/SleeveGeometryBuilder';
import { spheres } from '../../geometry/SphereGeometryBuilder';
import { ThreadSizes } from '../../sizes/ThreadSizes';
import { gaugeHead } from './GaugeGenerator';

export interface WaterHammerArresterParams {
  /** VT.CAR19 — шар с ниппелем подкачки, VT.CAR20 — стакан с краном и манометром. */
  model: 'CAR19' | 'CAR20';
}

/** Присоединение — G1/2 наружная у обеих моделей. */
const NOMINAL = '1/2';
/** Вертикальная втулка: ось +X заготовки → +Y. */
const up = { x: 0, y: 0, z: Math.PI / 2 };
const span = (from: number, to: number) => ({ length: to - from, rotation: up, center: { x: 0, y: (from + to) / 2, z: 0 } });

/**
 * VALTEC VT.CAR19 (технический каталог 2017, с. 434): H 112, Ø 84; VT.CAR20 (с. 435): H 135, корпус Ø62,
 * обод Ø99, резьба 20 мм, манометр Ø41. Остальное — условно.
 */
const CAR19 = { thread: 0.012, hex: 0.006, radius: 0.036, rim: 0.084, valve: 0.012, cap: 0.01 };
const CAR20 = { thread: 0.02, hex: 0.006, body: 0.062, rim: 0.099, cupTop: 0.075, rimThickness: 0.004, dome: 0.004, block: 0.011,
  gauge: 0.041, gaugeDepth: 0.02, height: 0.135 };

/**
 * Гаситель гидравлических ударов мембранный (позиция 111) по VALTEC VT.CAR19 / VT.CAR20: нержавеющий корпус
 * с воздушной камерой над мембраной, снизу штуцер G1/2 (н). У VT.CAR19 сверху ниппель подкачки,
 * у VT.CAR20 — шаровой кран с манометром (циферблат вперёд, +Z) и воздушный клапан под углом.
 * Монтаж в любом положении; заготовка — штуцером вниз, порт inlet в начале координат.
 */
export class WaterHammerArresterGenerator extends BaseGenerator<WaterHammerArresterParams> {
  readonly id = 'equipment.water-hammer-arrester';
  readonly version = 1;
  readonly title = 'Гаситель гидроударов';
  readonly paramSpecs: readonly ParamSpec[] = [
    { kind: 'choice', key: 'model', label: 'Модель', options: ['CAR19', 'CAR20'], optionLabels: { CAR19: 'VT.CAR19', CAR20: 'VT.CAR20 с манометром' } },
  ];
  readonly defaults: WaterHammerArresterParams = { model: 'CAR19' };

  protected create(p: WaterHammerArresterParams): GeneratedModel {
    const thread = ThreadSizes.require(NOMINAL, 'external');
    const length = p.model === 'CAR19' ? CAR19.thread : CAR20.thread;
    const merger = new MaterialGroupMerger();
    merger.add(
      // Штуцер: резьба и шестигранник.
      ...sleeves.build({ material: 'metal', ...span(0, length), outerDiameter: thread.n, innerDiameter: thread.v, materials: { outer: 'thread' } }),
      ...sleeves.build({ material: 'metal', ...span(length, length + CAR19.hex), outerDiameter: thread.n * 1.4, innerDiameter: thread.v,
        outerSegments: 6, materials: { outer: 'metalFlat' } }),
      ...(p.model === 'CAR19' ? this.car19(length + CAR19.hex) : this.car20(length + CAR20.hex)),
    );
    return createMeshModel({
      title: `Гаситель гидроударов VT.${p.model}, G${NOMINAL}(н)`,
      ...merger.merge(),
      connectors: [connector('inlet', ConnectorFrame.bottom, { x: 0, y: 0, z: 0 }, { nominal: NOMINAL, joint: 'thread', gender: 'external', depth: length })],
    });
  }

  /** Шар Ø72 с ободом Ø84 по экватору, сверху ниппель подкачки с чёрным колпачком; верх — H = 112 мм. */
  private car19(base: number): GeometryPart[] {
    const c = CAR19;
    const center = base + c.radius;
    const top = center + c.radius;
    return [
      spheres.build({ material: 'metal', radius: c.radius, center: { x: 0, y: center, z: 0 } }),
      ...sleeves.build({ material: 'metal', ...span(center - 0.0015, center + 0.0015), outerDiameter: c.rim, innerDiameter: 0 }),
      ...sleeves.build({ material: 'metal', ...span(top - 0.002, top + c.valve), outerDiameter: 0.008, innerDiameter: 0 }),
      ...sleeves.build({ material: 'black', ...span(top + c.valve, top + c.valve + c.cap), outerDiameter: 0.01, innerDiameter: 0, outerSegments: 12 }),
    ];
  }

  /**
   * Стакан Ø62 с полусферическим дном, обод Ø99 и крышка; на крышке — блок крана с манометром Ø41
   * (верх — H = 135 мм) и воздушный клапан под 45°.
   */
  private car20(base: number): GeometryPart[] {
    const c = CAR20;
    const radius = c.body / 2;
    const cupBottom = base + radius;
    const blockTop = c.cupTop + c.rimThickness + c.dome + c.block;
    const gaugeCenter = c.height - c.gauge / 2;
    const face = gaugeHead(c.gauge, c.gaugeDepth, 'manometer');
    for (const { geometry } of face) geometry.translate(0, gaugeCenter, c.gaugeDepth / 2);
    const vent = sleeves.build({ material: 'metal', length: 0.022, outerDiameter: 0.008, innerDiameter: 0,
      rotation: { x: 0, y: 0, z: Math.PI / 4 }, center: { x: 0.016, y: blockTop - 0.004, z: 0 } });
    return [
      spheres.build({ material: 'metal', radius, center: { x: 0, y: cupBottom, z: 0 } }),
      ...sleeves.build({ material: 'metal', ...span(cupBottom, c.cupTop), outerDiameter: c.body, innerDiameter: 0 }),
      ...sleeves.build({ material: 'metal', ...span(c.cupTop, c.cupTop + c.rimThickness), outerDiameter: c.rim, innerDiameter: 0 }),
      ...sleeves.build({ material: 'metal', ...span(c.cupTop + c.rimThickness, c.cupTop + c.rimThickness + c.dome), outerDiameterStart: c.rim * 0.9,
        outerDiameter: c.body * 0.5, innerDiameter: 0 }),
      // Блок крана: корпус, рычажок вбок, шейка до манометра.
      ...sleeves.build({ material: 'metal', ...span(blockTop - c.block, blockTop), outerDiameter: 0.018, innerDiameter: 0, outerSegments: 6,
        materials: { outer: 'metalFlat' } }),
      ...sleeves.build({ material: 'black', length: 0.02, outerDiameter: 0.006, innerDiameter: 0, center: { x: -0.016, y: blockTop - c.block / 2, z: 0 } }),
      ...sleeves.build({ material: 'metal', ...span(blockTop, gaugeCenter - c.gauge / 2 + 0.002), outerDiameter: 0.01, innerDiameter: 0 }),
      ...vent,
      ...face,
    ];
  }
}
