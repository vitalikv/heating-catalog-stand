import type { Box3, Group } from 'three';

/** Вектор как простые данные: сериализуется и не зависит от классов Three.js. */
export interface Vector3Data {
  x: number;
  y: number;
  z: number;
}

/** Разъём модели. Координаты локальны относительно корня, в метрах. */
export interface Connector {
  /** Устойчивый ID по назначению ('left', 'right'), а не по порядку обхода. */
  id: string;
  position: Vector3Data;
  /** Единичный вектор выхода наружу. */
  direction: Vector3Data;
  /** Номинал резьбы или трубы, например '1/2'. */
  nominal: string;
  gender: 'internal' | 'external';
}

export interface ValidationError {
  code: string;
  param: string;
  message: string;
}

export interface GeneratedModel {
  root: Group;
  connectors: Connector[];
  bounds: Box3;
  warnings: string[];
  /** Освобождает собственные ресурсы модели; повторный вызов безопасен. */
  dispose(): void;
}

export interface ModelGenerator<TParams> {
  readonly id: string;
  readonly title: string;
  validate(params: TParams): ValidationError[];
  build(params: TParams): GeneratedModel;
}
