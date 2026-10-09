import type { ExtrudedShapeBuilder } from '../geometry/ExtrudedShapeBuilder';
import type { GeometryPart } from '../geometry/MaterialGroupMerger';
import type { SleeveGeometryBuilder } from '../geometry/SleeveGeometryBuilder';
import type { PartDiameters } from '../sizes/ThreadSizes';
import { ThreadSizes } from '../sizes/ThreadSizes';

/** Индексы материалов кранов: metal_1, rezba_1, metal_1_edge, red_1 в gl2. */
export const VALVE_MATERIALS = { metal: 0, thread: 1, metalFlat: 2, red: 3 } as const;

/** Длина конуса корпуса справа от оси (x_1R в gl2), м. */
export const VALVE_BODY_STEP = 0.002;
/** Толщина ручки-бабочки (w1 в gl2), м. */
const HANDLE_THICKNESS = 0.005;
/** Описанный диаметр гайки — n × 1.236. */
export const VALVE_NUT_SCALE = 1.236;
/** Кольца сгона (x_3, x_4 в gl2), м. */
const UNION_RING = 0.002;

/** Итог построения сгона: куски и торец его наружной резьбы. */
export interface UnionResult {
  parts: GeometryPart[];
  /** X торца наружной резьбы сгона. */
  end: number;
  /** Длина резьбы сгона (x_5/2 + x_2). */
  threadLength: number;
}

/**
 * Общие части шаровых кранов (shar_kran.js): корпус, шток с ручкой-бабочкой,
 * сгон (shar_kran_obj_sgon_1). Ручка — часть геометрии, без поворота (решение 9 октября 2026).
 */
export class BallValveParts {
  constructor(
    private readonly sleeves: SleeveGeometryBuilder,
    private readonly shapes: ExtrudedShapeBuilder,
  ) {}

  /** Резьба крана: 0,4 наружного диаметра, не меньше 12 мм (x_1 в gl2). */
  static threadLength(d: PartDiameters): number {
    return Math.max(0.02 * d.n * 20, 0.012);
  }

  /** Высота штока над стенкой прохода (h1 в gl2). */
  static stemHeight(d: PartDiameters): number {
    return Math.max(0.015 * d.n * 20, 0.015) + 0.015;
  }

  /**
   * Корпус: слева два участка длиной leftHalf/2 (x_1L, x_2L) Ø n + 10 мм,
   * справа конус 2 мм и участок right (x_2R) Ø n + 15 мм.
   */
  body(d: PartDiameters, leftHalf: number, right: number): GeometryPart[] {
    const quarter = leftHalf / 2;
    const at = (x: number) => ({ x, y: 0, z: 0 });
    const narrow = { outerDiameter: d.n + 0.01, innerDiameter: d.v };
    const wide = { outerDiameter: d.n + 0.015, innerDiameter: d.v };
    return [
      ...this.sleeves.build({ ...narrow, length: quarter, center: at(-(quarter + quarter / 2)) }),
      ...this.sleeves.build({ ...narrow, length: quarter, center: at(-quarter / 2) }),
      ...this.sleeves.build({ ...wide, length: VALVE_BODY_STEP, outerDiameterStart: d.n + 0.01, innerDiameterStart: d.v, center: at(VALVE_BODY_STEP / 2) }),
      ...this.sleeves.build({ ...wide, length: right, center: at(VALVE_BODY_STEP + right / 2) }),
    ];
  }

  /** Шток над корпусом и ручка-бабочка длиной handleLength (t1 в gl2). */
  stemAndHandle(d: PartDiameters, handleLength: number): GeometryPart[] {
    const { red } = VALVE_MATERIALS;
    const h1 = BallValveParts.stemHeight(d);
    const base = d.v / 2;
    const up = { x: 0, y: 0, z: -Math.PI / 2 };
    const down = { x: 0, y: 0, z: Math.PI / 2 };
    const at = (y: number) => ({ x: 0, y, z: 0 });
    const all = { outer: red, inner: red, start: red, end: red };
    const handleY = base + h1 - 0.01 - 0.006 / 2;

    // Бабочка: контур в долях половины длины, как в shar_kran_babochka_1.
    const scale = handleLength / 2;
    const outline: [number, number][] = [[0, 0], [1, 0], [1, 0.6], [0.8, 0.6], [0, 0.3], [-0.8, 0.6], [-1, 0.6], [-1, 0]];

    return [
      ...this.sleeves.build({ length: h1 / 2, outerDiameter: 0.015, innerDiameter: 0, rotation: up, center: at(base + h1 / 4) }),
      ...this.sleeves.build({ length: h1 / 2, outerDiameter: 0.01, innerDiameter: 0, rotation: up, center: at(base + (3 * h1) / 4) }),
      ...this.sleeves.build({
        length: 0.01,
        outerDiameter: 0.013,
        innerDiameter: 0.011,
        outerDiameterStart: 0.021,
        innerDiameterStart: 0.019,
        rotation: down,
        center: at(base + h1 - 0.01 / 2),
        materials: all,
      }),
      ...this.sleeves.build({ length: 0.006, outerDiameter: 0.021, innerDiameter: 0.019, rotation: down, center: at(handleY), materials: all }),
      this.shapes.build({
        points: outline.map(([x, y]) => ({ x: x * scale, y: y * scale })),
        depth: HANDLE_THICKNESS,
        position: { x: 0, y: handleY, z: -HANDLE_THICKNESS / 2 },
        materialIndex: red,
      }),
    ];
  }

  /**
   * Сгон (shar_kran_obj_sgon_1) от offset по +X: накидная гайка с внутренней резьбой nutNominal
   * на патрубке с наружной резьбой pipeNominal длиной length (m в gl2). Вызывать для известных номиналов.
   */
  union(nutNominal: string, pipeNominal: string, length: number, offset: number): UnionResult {
    const { thread, metalFlat } = VALVE_MATERIALS;
    const d1 = ThreadSizes.diameters(nutNominal, 'internal')!;
    const d2 = ThreadSizes.diameters(pipeNominal, 'external')!;
    const x1 = 0.02 * d1.n * 20;
    const x2 = 0.02 * d2.n * 20;
    const x5 = x2;
    const x3R = BallValveParts.unionPipeLength(pipeNominal, length);
    const x6 = x1 - UNION_RING;
    const nut = { outerDiameter: d1.n * VALVE_NUT_SCALE, outerSegments: 6 };
    const pipe = { outerDiameter: d2.n, innerDiameter: d2.v };
    const at = (x: number) => ({ x: offset + x, y: 0, z: 0 });

    const parts = [
      ...this.sleeves.build({ ...nut, length: x1, innerDiameter: d1.v + 0.001, center: at(x1 / 2), materials: { outer: metalFlat, inner: thread } }),
      ...this.sleeves.build({ ...nut, length: UNION_RING, innerDiameter: d2.n + 0.001, center: at(x1 + UNION_RING / 2), materials: { outer: metalFlat } }),
      ...this.sleeves.build({ length: UNION_RING, outerDiameter: d1.v, innerDiameter: d2.v - 0.001, center: at(x6 + UNION_RING / 2) }),
      ...this.sleeves.build({ ...pipe, length: x3R, center: at(x6 + UNION_RING + x3R / 2) }),
      ...this.sleeves.build({ ...pipe, length: x5 / 2, center: at(x6 + UNION_RING + x3R + x5 / 4), materials: { outer: thread } }),
      ...this.sleeves.build({ ...pipe, length: x2, center: at(x6 + UNION_RING + x3R + x5 / 2 + x2 / 2), materials: { outer: thread } }),
    ];
    return { parts, end: offset + x6 + UNION_RING + x3R + x5 / 2 + x2, threadLength: x5 / 2 + x2 };
  }

  /** Гладкий участок патрубка сгона (x_3R); не больше нуля — длина сгона слишком мала. */
  static unionPipeLength(pipeNominal: string, length: number): number {
    const x2 = 0.02 * ThreadSizes.diameters(pipeNominal, 'external')!.n * 20;
    return length - x2 - x2 / 2 - UNION_RING;
  }
}
