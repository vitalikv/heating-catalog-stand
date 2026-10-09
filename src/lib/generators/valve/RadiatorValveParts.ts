import { connector } from '../../core/connector';
import { ConnectorFrame } from '../../core/ConnectorFrame';
import type { GeneratedModel, ValidationError } from '../../core/contracts';
import { createMeshModel } from '../../core/MeshModel';
import { MaterialGroupMerger } from '../../geometry/MaterialGroupMerger';
import { sleeves } from '../../geometry/SleeveGeometryBuilder';
import { ParamSchema } from '../../params/ParamSchema';
import { orientParts, threadedArm, threadedSize, unionNut, valveHead } from '../ThreadedParts';

export interface RadiatorValveDimensions { nominal: string; armLength: number }
export function radiatorValveLayout(p: RadiatorValveDimensions) {
  return { inner: threadedSize(p.nominal, 'internal'), outer: threadedSize(p.nominal, 'external') };
}
export type RadiatorValveLayout = ReturnType<typeof radiatorValveLayout>;

export function radiatorValveErrors(p: RadiatorValveDimensions, d: RadiatorValveLayout): ValidationError[] {
  const min = Math.max(d.inner.depth + d.inner.n / 2, 2 * d.outer.depth + 0.004);
  return p.armLength <= min ? [ParamSchema.tooShort('armLength', min)] : [];
}

/** Общий корпус с полусгоном: выход к радиатору +X, вход −X либо −Y, головка +Y. */
export function createRadiatorValve(p: RadiatorValveDimensions, d: RadiatorValveLayout,
  angle: boolean, thermostatic: boolean, title: string): GeneratedModel {
  const input = angle ? ConnectorFrame.bottom : ConnectorFrame.left;
  const merger = new MaterialGroupMerger();
  merger.add(...orientParts(threadedArm(d.inner, 'internal', p.armLength), input.direction),
    ...threadedArm(d.outer, 'external', p.armLength), ...unionNut(d.outer, p.armLength - 1.5 * d.outer.depth),
    ...sleeves.build({ material: 'metal', length: d.inner.n, outerDiameter: d.inner.n * 1.2,
      innerDiameter: 0, rotation: { x: 0, y: 0, z: Math.PI / 2 } }),
    ...valveHead(d.inner.n / 2, thermostatic));
  return createMeshModel({ title: `${title} ${p.nominal}`, ...merger.merge(), connectors: [
    connector('inlet', input, p.armLength, { nominal: p.nominal, joint: 'thread', gender: 'internal', depth: d.inner.depth }),
    connector('radiator', ConnectorFrame.right, p.armLength, { nominal: p.nominal, joint: 'thread', gender: 'external', depth: d.outer.depth }),
  ] });
}
