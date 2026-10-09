import type { Material } from 'three';
import type { Vector3Data } from '../contracts';
import type { GeometryPart } from '../geometry/MaterialGroupMerger';
import type { SleeveGeometryBuilder } from '../geometry/SleeveGeometryBuilder';
import type { MaterialLibrary } from '../materials/MaterialLibrary';
import type { PartDiameters } from '../sizes/ThreadSizes';

/**
 * Индексы материалов металлопластиковых фитингов: корпус bronz_1, заглушки red_1,
 * пресс-гильза metal_1, гайка bronz_1_edge, резьба rezba_2.
 */
export const MP_MATERIALS = { bronze: 0, red: 1, metal: 2, bronzeFlat: 3, bronzeThread: 4 } as const;

/** Толщина красной заглушки (w12 в gl2), м. */
export const MP_CAP = 0.0025;
/** Запас диаметров заглушек над диаметром фитинга (h1, h2 в gl2), м. */
const CAP_EXTRA = { outer: 0.005, inner: 0.0025 };
/** Наименьшая длина пресс-гильзы, м. */
const MIN_PRESS_LENGTH = 0.025;

/** Куда поставить кусок на расстоянии t от начала координат вдоль выхода. */
export type PlaceAlong = (t: number) => { center: Vector3Data; rotation?: Vector3Data };

/**
 * Пресс-конец металлопластикового фитинга (mpl_*): металлическая гильза длиной w поверх
 * трубы, латунная втулка внутри и две красные заглушки у начала гильзы.
 */
export class MpPressEnd {
  constructor(private readonly sleeves: SleeveGeometryBuilder) {}

  /** Длина гильзы: 0,9 наружного диаметра, не меньше minimum (25 мм; у mpl_perehod_rezba_1 — 20 мм). */
  static pressLength(d: PartDiameters, minimum = MIN_PRESS_LENGTH): number {
    return Math.max(0.030 * d.n * 30, minimum);
  }

  /**
   * Куски конца, начинающегося на расстоянии start от начала координат.
   * В gl2 у втулки (tb) диаметр n/2 — половина диаметра фитинга, перенесено как есть.
   */
  build(d: PartDiameters, start: number, length: number, place: PlaceAlong): GeometryPart[] {
    const { bronze, red, metal } = MP_MATERIALS;
    const insert = { n: d.n / 2, v: d.n / 2 - 0.005 * d.n * 30 };
    const all = (index: number) => ({ outer: index, inner: index, start: index, end: index });
    const middle = start + length / 2;

    return [
      ...this.sleeves.build({ ...place(middle), length, outerDiameter: d.n, innerDiameter: d.v, materials: all(metal) }),
      ...this.sleeves.build({ ...place(middle), length, outerDiameter: insert.n, innerDiameter: insert.v, materials: all(bronze) }),
      ...this.sleeves.build({ ...place(start + MP_CAP * 1.5), length: MP_CAP, outerDiameter: d.n + CAP_EXTRA.outer, innerDiameter: insert.n, materials: all(red) }),
      ...this.sleeves.build({ ...place(start + MP_CAP / 2), length: MP_CAP, outerDiameter: d.n + CAP_EXTRA.inner, innerDiameter: insert.n, materials: all(red) }),
    ];
  }

  /**
   * Проход длиной m1 (mpl_perehod_1, mpl_troinik_1, mpl_troinik_rezba_1): пресс-концы d1 слева
   * и d3 справа, между ними трубы и конусы к наибольшему диаметру dc. Половина прохода без гильзы
   * делится пополам: труба s и конус s.
   */
  buildRun(m1: number, d1: PartDiameters, d3: PartDiameters, dc: PartDiameters): GeometryPart[] {
    const w1 = MpPressEnd.pressLength(d1);
    const w3 = MpPressEnd.pressLength(d3);
    const s1 = (m1 / 2 - w1) / 2;
    const s3 = (m1 / 2 - w3) / 2;
    const cone = { outerDiameter: dc.n, innerDiameter: dc.v };
    const at = (x: number) => ({ x, y: 0, z: 0 });

    return [
      ...this.build(d1, 2 * s1, w1, MpPressEnd.left),
      ...this.sleeves.build({ length: s1, outerDiameter: d1.n, innerDiameter: d1.v, center: at(-1.5 * s1) }),
      ...this.sleeves.build({ ...cone, length: s1, outerDiameterStart: d1.n, innerDiameterStart: d1.v, center: at(-s1 / 2) }),
      ...this.sleeves.build({ ...cone, length: s3, outerDiameterStart: d3.n, innerDiameterStart: d3.v, center: at(s3 / 2), rotation: { x: 0, y: Math.PI, z: 0 } }),
      ...this.sleeves.build({ length: s3, outerDiameter: d3.n, innerDiameter: d3.v, center: at(1.5 * s3) }),
      ...this.build(d3, 2 * s3, w3, MpPressEnd.right),
    ];
  }

  /** Направления кусков, как в gl2: по +X и −X без поворота, вверх — поворот (0, π, π/2). */
  static readonly right: PlaceAlong = (t) => ({ center: { x: t, y: 0, z: 0 } });
  static readonly left: PlaceAlong = (t) => ({ center: { x: -t, y: 0, z: 0 } });
  static readonly top: PlaceAlong = (t) => ({ center: { x: 0, y: t, z: 0 }, rotation: { x: 0, y: Math.PI, z: Math.PI / 2 } });

  /** Материалы меша по индексам MP_MATERIALS. */
  static meshMaterials(materials: MaterialLibrary): Material[] {
    return (['bronze', 'red', 'metal', 'bronzeFlat', 'bronzeThread'] as const).map((key) => materials.get(key));
  }
}
