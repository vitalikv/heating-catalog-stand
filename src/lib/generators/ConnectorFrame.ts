import type { Vector3Data } from '../contracts';

/** Направление выхода и up разъёма (см. Connector.up). */
export interface Frame {
  direction: Vector3Data;
  up: Vector3Data;
}

/**
 * Направления выходов в плоскости XY и их up. Выход вверх, вниз или под углом —
 * левый выход, повёрнутый вокруг Z; up поворачивается вместе с ним.
 */
export class ConnectorFrame {
  static readonly right: Frame = { direction: { x: 1, y: 0, z: 0 }, up: { x: 0, y: 1, z: 0 } };
  static readonly left: Frame = { direction: { x: -1, y: 0, z: 0 }, up: { x: 0, y: 1, z: 0 } };
  static readonly top: Frame = ConnectorFrame.leftTurned(-Math.PI / 2);
  static readonly bottom: Frame = ConnectorFrame.leftTurned(Math.PI / 2);

  /** Левый выход, повёрнутый вокруг Z на angle, рад (как rot.z куска в gl2). */
  static leftTurned(angle: number): Frame {
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    // Компоненты, равные нулю с точностью до округления, обнуляются: направления осей остаются точными.
    const clean = (value: number) => (Math.abs(value) < 1e-12 ? 0 : value);
    return {
      direction: { x: clean(-cos), y: clean(-sin), z: 0 },
      up: { x: clean(-sin), y: clean(cos), z: 0 },
    };
  }

  /** Точка на оси выхода на расстоянии distance от начала координат. */
  static point(frame: Frame, distance: number): Vector3Data {
    const { x, y, z } = frame.direction;
    return { x: x * distance, y: y * distance, z: z * distance };
  }
}
