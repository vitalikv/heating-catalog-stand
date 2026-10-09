import type { Box3, Group } from 'three';

/** Вектор как простые данные: сериализуется и не зависит от классов Three.js. */
export interface Vector3Data {
  x: number;
  y: number;
  z: number;
}

/**
 * Разъём модели. Координаты локальны относительно корня, в метрах.
 * Стыковка (ConnectorMating): направления противоположны, up совпадают,
 * ответная деталь входит внутрь на e = min(depth₁, depth₂) — торец подвижной
 * детали встаёт в position − direction × e неподвижной.
 */
export interface Connector {
  /** Устойчивый ID по назначению ('left', 'right'), а не по порядку обхода. */
  id: string;
  /** Центр торца разъёма — плоскость, где встречаются детали. */
  position: Vector3Data;
  /** Единичный вектор выхода наружу. */
  direction: Vector3Data;
  /**
   * Опорное направление: единичный вектор, перпендикулярный direction.
   * Задаёт поворот детали вокруг оси разъёма при стыковке. У выходов вдоль ±X — +Y;
   * выход вверх, вниз или под углом — это левый выход (−X), повёрнутый вокруг Z,
   * его up — +Y, повёрнутый так же: вверх (+Y) — up +X, вниз (−Y) — up −X.
   */
  up: Vector3Data;
  /**
   * Длина соединительного участка от торца внутрь детали, м: резьбы
   * (внутренней или наружной) или раструба. Конец участка — position − direction × depth.
   */
  depth: number;
  /** Номинал резьбы или трубы, например '1/2' или '20'. */
  nominal: string;
  /**
   * Способ соединения: номинал сравним только внутри одного способа
   * ('20' у ПП-раструба — не то же, что дюймовая резьба).
   */
  joint: ConnectorJoint;
  gender: 'internal' | 'external';
}

/**
 * 'thread' — дюймовая трубная резьба; 'radiator-thread' — резьба портов
 * алюминиевого радиатора, к ней подходят только радиаторные переходники и пробки;
 * 'pp-socket' — раструб под пайку ПП-трубы; 'mp-press' — пресс-обжим
 * металлопластиковой трубы (номинал — наружный диаметр трубы, мм).
 */
export type ConnectorJoint = 'thread' | 'radiator-thread' | 'pp-socket' | 'mp-press';

export interface ValidationError {
  code: string;
  /** Путь параметра, как ParamSpec.key: 'm1', 'size.y'. */
  param: string;
  message: string;
}

/**
 * Описание параметра генератора. По нему проверяются параметры и строится
 * интерфейс (стенд, редактор). key — путь в параметрах: 'r1', 'size.y'.
 */
export type ParamSpec = ParamSpecBase &
  (
    /** optionLabels — подписи вариантов для интерфейса; значение остаётся кодом. */
    | { kind: 'choice'; options: readonly string[]; optionLabels?: Readonly<Record<string, string>> }
    /** Длина в метрах; интерфейс показывает её в миллиметрах. Границы включительно. */
    | { kind: 'length'; min: number; max: number; step: number }
    | { kind: 'integer'; min: number; max: number }
  );

export interface ParamSpecBase {
  key: string;
  label: string;
  /** Параметр нужен, только если параметр key равен одному из values; иначе не проверяется и скрыт. */
  when?: { key: string; values: readonly string[] };
}

export interface GeneratedModel {
  root: Group;
  /** Название для интерфейса: 'Муфта 1/2(в)'. Совпадает с root.name. */
  title: string;
  connectors: Connector[];
  bounds: Box3;
  warnings: string[];
  /** Освобождает собственные ресурсы модели; повторный вызов безопасен. */
  dispose(): void;
}

export interface ModelGenerator<TParams> {
  readonly id: string;
  readonly title: string;
  /** Все параметры генератора; validate() проверяет их по этой схеме. */
  readonly paramSpecs: readonly ParamSpec[];
  validate(params: TParams): ValidationError[];
  build(params: TParams): GeneratedModel;
}
