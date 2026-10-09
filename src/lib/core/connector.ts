import type { Connector, ConnectorJoint, Vector3Data } from './contracts';
import { ConnectorFrame } from './ConnectorFrame';
import type { Frame } from './ConnectorFrame';

/** Соединительный участок разъёма: всё, кроме положения и направления. */
export interface ConnectorEnd {
  depth: number;
  nominal: string;
  joint: ConnectorJoint;
  gender: 'internal' | 'external';
}

/**
 * Разъём с направлением и up из frame. Торец — точка at или, если at — число,
 * точка на оси выхода на этом расстоянии от начала координат.
 */
export function connector(id: string, frame: Frame, at: number | Vector3Data, end: ConnectorEnd): Connector {
  const position = typeof at === 'number' ? ConnectorFrame.point(frame, at) : at;
  return { id, position, direction: frame.direction, up: frame.up, ...end };
}
