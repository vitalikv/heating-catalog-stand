import { BaseGenerator } from '../../core/BaseGenerator';
import { connector } from '../../core/connector';
import { ConnectorFrame } from '../../core/ConnectorFrame';
import type { GeneratedModel, ParamSpec, ValidationError } from '../../core/contracts';
import { createMeshModel } from '../../core/MeshModel';
import { MaterialGroupMerger } from '../../geometry/MaterialGroupMerger';
import { sleeves } from '../../geometry/SleeveGeometryBuilder';
import { ParamSchema } from '../../params/ParamSchema';
import { specs } from '../../params/specs';
import { threadedSize } from '../ThreadedParts';
import type { ThreadedSize } from '../ThreadedParts';

export interface SteelCapParams { nominal: string; length: number }

/** Глухая заглушка с внутренней резьбой, открытый торец слева. */
export class SteelCapGenerator extends BaseGenerator<SteelCapParams, ThreadedSize> {
  readonly id = 'steel.cap';
  readonly version = 1;
  readonly title = 'Заглушка стальная (в)';
  readonly defaults: SteelCapParams = { nominal: '1/2', length: 0.022 };
  readonly paramSpecs: readonly ParamSpec[] = [specs.threadNominal('nominal', 'Резьба'), specs.length('length', 'Длина')];
  protected override layout(p: SteelCapParams) { return threadedSize(p.nominal, 'internal'); }
  protected override relations(p: SteelCapParams, d: ThreadedSize): ValidationError[] {
    return p.length <= d.depth + 0.003 ? [ParamSchema.tooShort('length', d.depth + 0.003)] : [];
  }
  protected create(p: SteelCapParams, d: ThreadedSize): GeneratedModel {
    const merger = new MaterialGroupMerger();
    const wall = 0.003;
    merger.add(
      ...sleeves.build({ material: 'metal', length: p.length - wall, outerDiameter: d.n * 1.35, innerDiameter: d.v,
        outerSegments: 6, center: { x: -wall / 2, y: 0, z: 0 }, materials: { outer: 'metalFlat', inner: 'thread' } }),
      ...sleeves.build({ material: 'metalFlat', length: wall, outerDiameter: d.n * 1.35, innerDiameter: 0,
        outerSegments: 6, center: { x: (p.length - wall) / 2, y: 0, z: 0 } }),
    );
    return createMeshModel({ title: `Заглушка ${p.nominal}(в)`, ...merger.merge(), connectors: [
      connector('left', ConnectorFrame.left, p.length / 2, { nominal: p.nominal, gender: 'internal', joint: 'thread', depth: d.depth }),
    ] });
  }
}
