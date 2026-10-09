import type { Connector } from '../contracts';
import type { GeometryPart } from '../geometry/MaterialGroupMerger';
import type { SleeveGeometryBuilder } from '../geometry/SleeveGeometryBuilder';
import type { PartDiameters } from '../sizes/ThreadSizes';
import { ConnectorFrame } from './ConnectorFrame';

/** Длина резьбы на концах трубы и выходах (w1, w2 в gl2), м. */
export const COLLECTOR_THREAD = 0.015;
/** Шаг выходов, м. */
export const COLLECTOR_STEP = 0.036;
/** Длина кольца перед правой резьбой (dl в gl2), м. */
export const COLLECTOR_RIGHT_RING = 0.0033;
/** Зазор колец по внутреннему диаметру (kf в gl2), м. */
export const COLLECTOR_RING_GAP = 0.0001;

/** Индексы материалов, общие для коллекторов. */
export const COLLECTOR_MATERIALS = { metal: 0, thread: 1, metalFlat: 2 } as const;

/**
 * Горизонтальная труба стального коллектора (crTubeGorz в st_collector_1 и st_collector_2):
 * слева внутренняя резьба r1 под шестигранной гайкой, справа наружная резьба r1.
 */
export class SteelCollectorPipe {
  constructor(private readonly sleeves: SleeveGeometryBuilder) {}

  /** d1 — левая (внутренняя), d3 — правая (наружная) резьба, dc — наибольший из диаметров коллектора. */
  build(m1: number, d1: PartDiameters, d3: PartDiameters, dc: PartDiameters): GeometryPart[] {
    const { thread, metalFlat } = COLLECTOR_MATERIALS;
    const w = COLLECTOR_THREAD;
    const s1 = m1 / 2 - w;
    const at = (x: number) => ({ x, y: 0, z: 0 });
    const flat = { outer: metalFlat, inner: metalFlat, start: metalFlat, end: metalFlat };

    return [
      // Слева: резьба, гайка поверх неё, конус к наибольшему диаметру
      ...this.sleeves.build({ length: w, outerDiameter: d1.n, innerDiameter: d1.v, center: at(-(s1 + w / 2)), materials: { inner: thread } }),
      ...this.sleeves.build({
        length: w,
        outerDiameter: d1.n + 0.236 * d1.n,
        innerDiameter: d1.v + COLLECTOR_RING_GAP,
        outerSegments: 6,
        center: at(-(s1 + w / 2)),
        materials: flat,
      }),
      ...this.sleeves.build({ length: s1, outerDiameter: dc.n, innerDiameter: dc.v, outerDiameterStart: d1.n, innerDiameterStart: d1.v, center: at(-s1 / 2) }),
      // Справа: труба, кольцо, наружная резьба
      ...this.sleeves.build({ length: s1, outerDiameter: dc.n, innerDiameter: dc.v, center: at(s1 / 2), rotation: { x: 0, y: Math.PI, z: 0 } }),
      ...this.sleeves.build({
        length: COLLECTOR_RIGHT_RING,
        outerDiameter: dc.n + d1.n / 10,
        innerDiameter: d3.v + COLLECTOR_RING_GAP,
        center: at(s1 + COLLECTOR_RIGHT_RING / 2),
      }),
      ...this.sleeves.build({ length: w, outerDiameter: d3.n, innerDiameter: d3.v, center: at(s1 + w / 2), materials: { outer: thread } }),
    ];
  }

  /** X выходов: шаг 36 мм, ряд по центру трубы. */
  static outletPositions(count: number): number[] {
    return Array.from({ length: count }, (_, i) => COLLECTOR_STEP * i - (COLLECTOR_STEP * (count - 1)) / 2);
  }

  /**
   * Разъёмы в порядке gl2: левый конец трубы (внутренняя резьба), выходы, правый конец
   * (наружная резьба, глубина — без кольца у её начала). В gl2 точки стояли в центрах резьбы.
   */
  static connectors(m1: number, r1: string, outlets: Connector[]): Connector[] {
    const { left, right } = ConnectorFrame;
    const common = { nominal: r1, joint: 'thread' } as const;
    return [
      { id: 'left', position: ConnectorFrame.point(left, m1 / 2), ...left, depth: COLLECTOR_THREAD, gender: 'internal', ...common },
      ...outlets,
      { id: 'right', position: ConnectorFrame.point(right, m1 / 2), ...right, depth: COLLECTOR_THREAD - COLLECTOR_RIGHT_RING, gender: 'external', ...common },
    ];
  }
}
