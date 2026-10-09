import { BoxGeometry } from 'three';
import { BaseGenerator } from '../../core/BaseGenerator';
import { connector } from '../../core/connector';
import { ConnectorFrame } from '../../core/ConnectorFrame';
import type { GeneratedModel, ParamSpec, Vector3Data } from '../../core/contracts';
import { createMeshModel } from '../../core/MeshModel';
import { MaterialGroupMerger } from '../../geometry/MaterialGroupMerger';
import type { GeometryPart } from '../../geometry/MaterialGroupMerger';
import { sleeves } from '../../geometry/SleeveGeometryBuilder';
import type { SleeveShape } from '../../geometry/SleeveGeometryBuilder';
import { specs } from '../../params/specs';
import { ThreadSizes } from '../../sizes/ThreadSizes';

export interface SafetyGroupParams {
  /** Габарит корпуса-коллектора, м. */
  dimensions: Vector3Data;
  /** Номинал внутренней резьбы гайки снизу, например '1'. */
  nominal: string;
}

/** Описанный диаметр гайки — n × 1.236. */
const NUT_SCALE = 1.236;
const HEX_SEGMENTS = 6;
const CAP_SEGMENTS = 16;
/** Высота гаек на корпусе (h1), м. */
const SEAT = 0.01;

/** Манометр (mtr в gl2), м. */
const GAUGE = { gap: 0.001, thread: 0.01, nut: 0.005, nutDiameter: 0.015, diameter: 0.066, depth: 0.028 };
/** Автоматический воздухоотводчик (vzd в gl2), м. */
const VENT = { thread: 0.01, nut: 0.005, barrel: 0.055, barrelTop: 0.046, barrelBottom: 0.038, lid: 0.05, lidHeight: 0.005, cap: 0.005, capDiameter: 0.008 };
/** Предохранительный клапан (prd в gl2), м. */
const VALVE = { gap: 0.003, step: 0.01, body: 0.03, outlet1: 0.012, outlet2: 0.012, cap: 0.022 };

/**
 * Группа безопасности котла: корпус, на нём манометр, воздухоотводчик и
 * предохранительный клапан; снизу — гайка с внутренней резьбой (перенос gr_bez_1).
 * Резьбы приборов — часть корпуса, не разъёмы.
 */
export class SafetyGroupGenerator extends BaseGenerator<SafetyGroupParams> {
  readonly id = 'equipment.safety-group';
  readonly version = 1;
  readonly title = 'Группа безопасности';
  readonly paramSpecs: readonly ParamSpec[] = [
    specs.length('dimensions.x', 'Длина корпуса', { min: 0.1, max: 0.5, step: 0.001 }),
    specs.length('dimensions.y', 'Высота корпуса', { min: 0.02, step: 0.001 }),
    specs.length('dimensions.z', 'Глубина корпуса', { min: 0.02, step: 0.001 }),
    specs.threadNominal('nominal', 'Резьба снизу (в)'),
  ];
  readonly defaults: SafetyGroupParams = { dimensions: { x: 0.18, y: 0.05, z: 0.05 }, nominal: '1' };

  protected create(params: SafetyGroupParams): GeneratedModel {
    const d1 = ThreadSizes.require(params.nominal, 'internal');
    const x1 = 0.02 * d1.n * 20;
    const { x, y, z } = params.dimensions;

    const indexed = new BoxGeometry(x, y, z);
    const box = indexed.toNonIndexed();
    indexed.dispose();

    const merger = new MaterialGroupMerger();
    merger.add(
      ...this.gauge(-x * 0.35, y / 2),
      ...this.vent(y / 2),
      ...this.valve(x * 0.35, y / 2),
      ...this.seats(x * 0.35, y / 2),
      { geometry: box, material: 'bronze' },
      // Гайка снизу
      ...sleeves.build({
        material: 'bronze',
        length: x1,
        outerDiameter: d1.n * NUT_SCALE,
        innerDiameter: d1.v,
        outerSegments: HEX_SEGMENTS,
        rotation: this.up(),
        center: { x: 0, y: -(y / 2 + x1 / 2), z: 0 },
        materials: { outer: 'bronzeFlat', inner: 'bronzeThread' },
      }),
    );

    // Торец — низ гайки, глубина — её высота. В gl2 точка — в центре гайки.
    return createMeshModel({
      title: 'Группа безопасности',
      ...merger.merge(),
      connectors: [
        connector('bottom', ConnectorFrame.bottom, { x: 0, y: -(y / 2 + x1), z: 0 }, { depth: x1, nominal: params.nominal, joint: 'thread', gender: 'internal' }),
      ],
    });
  }

  /** Манометр на левой гайке: резьба, гайка, корпус с циферблатом. */
  private gauge(x: number, top: number): GeometryPart[] {
    const g = GAUGE;
    const d2 = ThreadSizes.require('3/8', 'internal');
    const center = top + g.gap + g.thread + g.nut + g.diameter / 2;
    const face = { length: 0.001, outerDiameter: g.diameter * 0.9, innerDiameter: 0 };
    return [
      // Циферблат и задняя крышка — диски поперёк Z
      ...sleeves.build({ ...face, rotation: { x: 0, y: -Math.PI / 2, z: 0 }, center: { x, y: center, z: g.depth / 2 - 0.004 }, material: 'manometer' }),
      ...sleeves.build({ ...face, rotation: { x: 0, y: -Math.PI / 2, z: 0 }, center: { x, y: center, z: -g.depth / 2 }, material: 'blackFlat' }),
      ...sleeves.build({
        length: g.depth,
        outerDiameter: g.diameter,
        innerDiameter: g.diameter * 0.9,
        rotation: { x: 0, y: Math.PI / 2, z: 0 },
        center: { x, y: center, z: 0 },
        material: 'blackFlat',
      }),
      ...sleeves.build({
        material: 'bronze',
        length: g.nut,
        outerDiameter: g.nutDiameter,
        innerDiameter: g.nutDiameter * 0.7,
        outerSegments: HEX_SEGMENTS,
        innerSegments: HEX_SEGMENTS,
        rotation: this.up(),
        center: { x, y: top + g.gap + g.thread + g.nut / 2, z: 0 },
        materials: { outer: 'bronzeFlat' },
      }),
      ...sleeves.build({
        material: 'bronze',
        length: g.thread,
        outerDiameter: d2.v,
        innerDiameter: d2.v * 0.8,
        rotation: this.up(),
        center: { x, y: top + g.gap + g.thread / 2, z: 0 },
        materials: { outer: 'bronzeThread' },
      }),
    ];
  }

  /** Воздухоотводчик на средней гайке: резьба, гайка, бочок, крышка и колпачок. */
  private vent(top: number): GeometryPart[] {
    const v = VENT;
    const d2 = ThreadSizes.require('3/8', 'internal');
    const base = top + SEAT + v.thread / 4;
    const up = this.up();
    return [
      ...sleeves.build({
        length: v.cap,
        outerDiameter: v.capDiameter,
        innerDiameter: 0,
        outerSegments: CAP_SEGMENTS,
        rotation: up,
        center: { x: -v.lid / 2 + v.lid * 0.2, y: base + v.nut + v.barrel + v.lidHeight + v.cap / 2, z: 0 },
        material: 'blackFlat',
      }),
      ...sleeves.build({
        material: 'bronze',
        length: v.lidHeight,
        outerDiameter: v.lid,
        innerDiameter: 0,
        outerSegments: CAP_SEGMENTS,
        rotation: up,
        center: { x: 0, y: base + v.nut + v.barrel + v.lidHeight / 2, z: 0 },
        materials: { outer: 'bronzeFlat' },
      }),
      // Бочок — конус: сверху (+X до поворота) шире
      ...sleeves.build({
        material: 'bronze',
        length: v.barrel,
        outerDiameter: v.barrelTop,
        innerDiameter: 0,
        outerDiameterStart: v.barrelBottom,
        rotation: up,
        center: { x: 0, y: base + v.nut + v.barrel / 2, z: 0 },
      }),
      ...sleeves.build({
        material: 'bronze',
        length: v.nut,
        outerDiameter: d2.n * NUT_SCALE,
        innerDiameter: d2.v,
        outerSegments: HEX_SEGMENTS,
        rotation: up,
        center: { x: 0, y: base + v.nut / 2, z: 0 },
        materials: { outer: 'bronzeFlat' },
      }),
      ...sleeves.build({
        material: 'bronze',
        length: v.thread,
        outerDiameter: d2.v,
        innerDiameter: d2.v * 0.8,
        rotation: up,
        center: { x: 0, y: top + SEAT - v.thread / 4, z: 0 },
        materials: { outer: 'bronzeThread' },
      }),
    ];
  }

  /** Предохранительный клапан на правом штуцере: гайка, корпус, боковой выход и красный колпачок. */
  private valve(x: number, top: number): GeometryPart[] {
    const p = VALVE;
    const d4 = ThreadSizes.require('1/2', 'internal');
    const bodyBottom = top + p.gap + p.step * 3;
    const outletY = bodyBottom + p.body / 2;
    const up = this.up();
    return [
      ...sleeves.build({
        length: p.cap,
        outerDiameter: d4.v * 1.3,
        innerDiameter: 0,
        outerDiameterStart: d4.v,
        outerSegments: CAP_SEGMENTS,
        rotation: { x: 0, y: 0, z: -Math.PI / 2 },
        center: { x, y: bodyBottom + p.body + p.cap / 2, z: 0 },
        material: 'redFlat',
      }),
      // Боковой выход вдоль +X: резьба и переход к корпусу
      ...sleeves.build({
        material: 'bronze',
        length: p.outlet2,
        outerDiameter: d4.n,
        innerDiameter: d4.v,
        center: { x: x + p.outlet1 + p.outlet2 / 2, y: outletY, z: 0 },
        materials: { inner: 'bronzeThread' },
      }),
      ...sleeves.build({
        material: 'bronze',
        length: p.outlet1,
        outerDiameter: d4.n,
        innerDiameter: d4.v,
        outerDiameterStart: d4.v,
        innerDiameterStart: d4.v * 0.9,
        center: { x: x + p.outlet1 / 2, y: outletY, z: 0 },
      }),
      ...sleeves.build({ material: 'bronze', length: p.body, outerDiameter: d4.v, innerDiameter: 0, rotation: up, center: { x, y: outletY, z: 0 } }),
      ...sleeves.build({
        material: 'bronze',
        length: p.step,
        outerDiameter: d4.n,
        innerDiameter: 0,
        outerSegments: HEX_SEGMENTS,
        rotation: up,
        center: { x, y: top + p.gap + p.step * 2.5, z: 0 },
        materials: { outer: 'bronzeFlat' },
      }),
      ...sleeves.build({ material: 'bronze', length: p.step, outerDiameter: d4.v, innerDiameter: 0, rotation: up, center: { x, y: top + p.gap + p.step * 1.5, z: 0 } }),
      ...sleeves.build({
        material: 'bronze',
        length: p.step,
        outerDiameter: d4.n * NUT_SCALE,
        innerDiameter: d4.v,
        outerSegments: HEX_SEGMENTS,
        rotation: up,
        center: { x, y: top + p.gap + p.step / 2, z: 0 },
        materials: { outer: 'bronzeFlat', inner: 'bronzeThread' },
      }),
    ];
  }

  /** Гайки под манометр и воздухоотводчик, штуцер под клапан. */
  private seats(valveX: number, top: number): GeometryPart[] {
    const d2 = ThreadSizes.require('3/8', 'internal');
    const d3 = ThreadSizes.require('1/2', 'external');
    const up = this.up();
    const nut = {
      length: SEAT,
      outerDiameter: d2.n * NUT_SCALE,
      innerDiameter: d2.v,
      outerSegments: HEX_SEGMENTS,
      rotation: up,
      materials: { outer: 'bronzeFlat', inner: 'bronzeThread' },
    } satisfies Partial<SleeveShape>;
    return [
      ...sleeves.build({ material: 'bronze', ...nut, center: { x: -valveX, y: top + SEAT / 2, z: 0 } }),
      ...sleeves.build({ material: 'bronze', ...nut, center: { x: 0, y: top + SEAT / 2, z: 0 } }),
      ...sleeves.build({
        material: 'bronze',
        length: SEAT,
        outerDiameter: d3.n,
        innerDiameter: d3.v,
        rotation: up,
        center: { x: valveX, y: top + SEAT / 2, z: 0 },
        materials: { outer: 'bronzeThread' },
      }),
    ];
  }

  /** Ось втулки вертикально (rot.z = π/2 в gl2). */
  private up(): Vector3Data {
    return { x: 0, y: 0, z: Math.PI / 2 };
  }
}
