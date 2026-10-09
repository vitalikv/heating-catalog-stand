import { connector } from '../../core/connector';
import { ConnectorFrame } from '../../core/ConnectorFrame';
import type { Connector } from '../../core/contracts';
import type { GeometryPart } from '../../geometry/MaterialGroupMerger';
import { sleeves } from '../../geometry/SleeveGeometryBuilder';
import type { PartDiameters } from '../../sizes/ThreadSizes';

/** Длина резьбы на концах трубы и выходах (w1, w2 в gl2), м. */
export const COLLECTOR_THREAD = 0.015;
/** Шаг выходов, м. */
export const COLLECTOR_STEP = 0.036;
/** Длина кольца перед правой резьбой (dl в gl2), м. */
export const COLLECTOR_RIGHT_RING = 0.0033;
/** Зазор колец по внутреннему диаметру (kf в gl2), м. */
export const COLLECTOR_RING_GAP = 0.0001;

/**
 * Горизонтальная труба стального коллектора (crTubeGorz в st_collector_1 и st_collector_2):
 * слева внутренняя резьба r1 под шестигранной гайкой, справа наружная резьба r1.
 */
export class SteelCollectorPipe {
  constructor() {}

  /** d1 — левая (внутренняя), d3 — правая (наружная) резьба, dc — наибольший из диаметров коллектора. */
  build(m1: number, d1: PartDiameters, d3: PartDiameters, dc: PartDiameters): GeometryPart[] {
    const w = COLLECTOR_THREAD;
    const s1 = m1 / 2 - w;
    const at = (x: number) => ({ x, y: 0, z: 0 });

    return [
      // Слева: резьба, гайка поверх неё, конус к наибольшему диаметру
      ...sleeves.build({ length: w, outerDiameter: d1.n, innerDiameter: d1.v, center: at(-(s1 + w / 2)), material: 'metal', materials: { inner: 'thread' } }),
      ...sleeves.build({
        length: w,
        outerDiameter: d1.n + 0.236 * d1.n,
        innerDiameter: d1.v + COLLECTOR_RING_GAP,
        outerSegments: 6,
        center: at(-(s1 + w / 2)),
        material: 'metalFlat',
      }),
      ...sleeves.build({ length: s1, outerDiameter: dc.n, innerDiameter: dc.v, outerDiameterStart: d1.n, innerDiameterStart: d1.v, center: at(-s1 / 2), material: 'metal' }),
      // Справа: труба, кольцо, наружная резьба
      ...sleeves.build({ length: s1, outerDiameter: dc.n, innerDiameter: dc.v, center: at(s1 / 2), rotation: { x: 0, y: Math.PI, z: 0 }, material: 'metal' }),
      ...sleeves.build({
        length: COLLECTOR_RIGHT_RING,
        outerDiameter: dc.n + d1.n / 10,
        innerDiameter: d3.v + COLLECTOR_RING_GAP,
        center: at(s1 + COLLECTOR_RIGHT_RING / 2),
        material: 'metal',
      }),
      ...sleeves.build({ length: w, outerDiameter: d3.n, innerDiameter: d3.v, center: at(s1 + w / 2), material: 'metal', materials: { outer: 'thread' } }),
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
      connector('left', left, m1 / 2, { depth: COLLECTOR_THREAD, gender: 'internal', ...common }),
      ...outlets,
      connector('right', right, m1 / 2, { depth: COLLECTOR_THREAD - COLLECTOR_RIGHT_RING, gender: 'external', ...common }),
    ];
  }
}
