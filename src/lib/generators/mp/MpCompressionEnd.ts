import type { ConnectorEnd } from '../../core/connector';
import type { ParamSpec } from '../../core/contracts';
import type { GeometryPart } from '../../geometry/MaterialGroupMerger';
import { sleeves } from '../../geometry/SleeveGeometryBuilder';
import { spheres } from '../../geometry/SphereGeometryBuilder';
import { MpPipeSizes } from '../../sizes/MpPipeSizes';

/**
 * Обжимной конец МП по образцу VALTEC VTm.300 (Технический каталог VALTEC 2017, с. 30–38):
 * никелированный корпус со штуцером, никелированная накидная гайка, латунное разрезное кольцо.
 * Габариты фитингов (A, B) — по таблицам каталога; размеры деталей конца — по эскизам, условно.
 * Труба надевается на штуцер до буртика; торец гайки совпадает с торцом штуцера (плоскость порта).
 */
export interface CompressionSize {
  /** Наружный диаметр трубы, м. */
  pipe: number;
  /** Длина гайки = глубина ввода трубы до буртика, м. */
  nutLength: number;
  /** Шестигранник гайки по вершинам, м. */
  nutOuter: number;
  /** Отверстие гайки под кольцо, м. */
  nutInner: number;
  /** Корпус за гайкой, м. */
  bodyOuter: number;
  /** Штуцер внутри трубы: наружный диаметр (внутренний диаметр трубы) и проходной канал, м. */
  insertOuter: number;
  channel: number;
}

/** Ряд труб VTm.300 и толщина их стенки, м (каталог, с. 30: 16×2, 20×2, 26×3, 32×3). */
const PIPE_WALL: Readonly<Record<string, number>> = { '16': 0.002, '20': 0.002, '26': 0.003, '32': 0.003 };
export const COMPRESSION_NOMINALS: readonly string[] = Object.keys(PIPE_WALL);
/** Наименьший корпус между гайкой и осью фитинга без поперечного плеча, м. */
export const MIN_COMPRESSION_BODY = 0.004;

export class MpCompressionEnd {
  /** Номинал трубы обжимного конца: ряд VTm.300. */
  static nominalSpec(key: string, label = 'Труба, мм'): ParamSpec {
    return { kind: 'choice', key, label, options: COMPRESSION_NOMINALS };
  }

  static size(nominal: string): CompressionSize {
    const pipe = MpPipeSizes.require(nominal).v;
    const insertOuter = pipe - 2 * PIPE_WALL[nominal];
    return {
      pipe,
      // Гайка по эскизу VTm.303: 13,2 мм у трубы 16.
      nutLength: 0.0036 + 0.6 * pipe,
      // Под ключ 24 / 28 / 36 / 41 мм у 16 / 20 / 26 / 32 — по вершинам примерно 1,25 d + 8 мм.
      nutOuter: 1.25 * pipe + 0.008,
      nutInner: pipe + 0.003,
      bodyOuter: pipe + 0.004,
      insertOuter,
      channel: insertOuter - 0.002,
    };
  }

  /** Разъём конца: внутренний, система mp-compression, номинал — наружный диаметр трубы. */
  static end(nominal: string, size: CompressionSize): ConnectorEnd {
    return { depth: size.nutLength, nominal, joint: 'mp-compression', gender: 'internal' };
  }

  /**
   * Плечо по +X от начала координат до торца гайки reach: никелированный корпус, гайка
   * (шестигранник), латунное разрезное кольцо в гайке и штуцер под трубу. Корпус — от 0 до гайки.
   */
  static arm(size: CompressionSize, reach: number): GeometryPart[] {
    const nutStart = reach - size.nutLength;
    const ring = size.nutLength * 0.35;
    return [
      ...sleeves.build({ material: 'metal', length: nutStart, outerDiameter: size.bodyOuter, innerDiameter: size.channel,
        center: { x: nutStart / 2, y: 0, z: 0 } }),
      ...sleeves.build({ material: 'metal', length: size.nutLength, outerDiameter: size.nutOuter, innerDiameter: size.nutInner,
        outerSegments: 6, center: { x: nutStart + size.nutLength / 2, y: 0, z: 0 }, materials: { outer: 'metalFlat' } }),
      ...sleeves.build({ material: 'bronze', length: ring, outerDiameter: size.nutInner, innerDiameter: size.pipe,
        center: { x: reach - size.nutLength * 0.6, y: 0, z: 0 } }),
      ...sleeves.build({ material: 'metal', length: size.nutLength, outerDiameter: size.insertOuter, innerDiameter: size.channel,
        center: { x: nutStart + size.nutLength / 2, y: 0, z: 0 } }),
    ];
  }

  /**
   * Наименьшее плечо: гайка не заходит на корпус поперечного плеча диаметром crossBody;
   * без поперечного плеча — гайка и корпус не короче MIN_COMPRESSION_BODY.
   */
  static minReach(size: CompressionSize, crossBody = 0): number {
    return size.nutLength + Math.max(MIN_COMPRESSION_BODY, crossBody / 2);
  }

  /** Скругление угла между плечами +X и +Y: четверти сфер корпуса и канала. */
  static corner(size: CompressionSize): GeometryPart[] {
    const quarter = { phiLength: Math.PI / 2, rotation: { x: Math.PI / 2, y: 0, z: 0 } };
    return [
      spheres.build({ material: 'metal', ...quarter, radius: size.bodyOuter / 2 }),
      spheres.build({ material: 'metal', ...quarter, radius: size.channel / 2 }),
    ];
  }
}
