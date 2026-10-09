import { BaseGenerator } from '../../core/BaseGenerator';
import { connector } from '../../core/connector';
import { ConnectorFrame } from '../../core/ConnectorFrame';
import type { GeneratedModel, ParamSpec, ValidationError } from '../../core/contracts';
import { createMeshModel } from '../../core/MeshModel';
import { shapes } from '../../geometry/ExtrudedShapeBuilder';
import { MaterialGroupMerger } from '../../geometry/MaterialGroupMerger';
import { sleeves } from '../../geometry/SleeveGeometryBuilder';
import { ParamSchema } from '../../params/ParamSchema';
import { specs } from '../../params/specs';
import { orientParts, threadedArm, threadedSize } from '../ThreadedParts';

export interface DrainValveParams { nominal: string; hoseNominal: string; length: number }
type Layout = { thread: ReturnType<typeof threadedSize>; hose: number };

/** Кран заполнения/слива: наружная резьба слева, ёлочка под шланг справа. */
export class DrainValveGenerator extends BaseGenerator<DrainValveParams, Layout> {
  readonly id = 'valve.drain';
  readonly version = 1;
  readonly title = 'Кран сливной со штуцером';
  readonly defaults: DrainValveParams = { nominal: '1/2', hoseNominal: '13', length: 0.06 };
  readonly paramSpecs: readonly ParamSpec[] = [specs.threadNominal('nominal', 'Резьба'),
    { kind: 'choice', key: 'hoseNominal', label: 'Шланг, внутренний Ø мм', options: ['13', '16', '20'] }, specs.length('length', 'Длина')];
  protected override layout(p: DrainValveParams): Layout { return { thread: threadedSize(p.nominal, 'external'), hose: Number(p.hoseNominal) / 1000 }; }
  protected override relations(p: DrainValveParams, d: Layout): ValidationError[] {
    const min = Math.max(0.05, 2 * (d.thread.depth + 0.008));
    return p.length <= min ? [ParamSchema.tooShort('length', min)] : [];
  }
  protected create(p: DrainValveParams, d: Layout): GeneratedModel {
    const merger = new MaterialGroupMerger();
    const half = p.length / 2;
    const barbLength = 0.024;
    merger.add(...orientParts(threadedArm(d.thread, 'external', half, 'bronze'), ConnectorFrame.left.direction),
      ...sleeves.build({ material: 'bronze', length: half - barbLength, outerDiameter: Math.max(d.thread.n * 1.25, d.hose * 1.3),
        innerDiameter: Math.min(d.thread.v, d.hose * 0.65), center: { x: (half - barbLength) / 2, y: 0, z: 0 } }),
      ...orientParts(sleeves.build({ material: 'bronze', length: d.thread.n / 2 + 0.01, outerDiameter: 0.01, innerDiameter: 0,
        center: { x: d.thread.n / 4 + 0.005, y: 0, z: 0 } }), ConnectorFrame.top.direction));
    merger.add(shapes.build({ material: 'blue', depth: 0.004,
      points: [{ x: -0.018, y: -0.006 }, { x: -0.004, y: -0.003 }, { x: 0.004, y: -0.003 },
        { x: 0.018, y: -0.006 }, { x: 0.018, y: 0.006 }, { x: 0.004, y: 0.003 },
        { x: -0.004, y: 0.003 }, { x: -0.018, y: 0.006 }],
      rotation: { x: -Math.PI / 2, y: 0, z: 0 }, position: { x: 0, y: d.thread.n / 2 + 0.01, z: 0 } }));
    for (let i = 0; i < 4; i++) merger.add(...sleeves.build({ material: 'bronze', length: barbLength / 4,
      outerDiameterStart: d.hose * 1.04, outerDiameter: d.hose * 0.92, innerDiameter: d.hose * 0.65,
      center: { x: half - barbLength + (i + 0.5) * barbLength / 4, y: 0, z: 0 } }));
    return createMeshModel({ title: `Кран сливной ${p.nominal} × шланг ${p.hoseNominal} мм`, ...merger.merge(), connectors: [
      connector('inlet', ConnectorFrame.left, half, { nominal: p.nominal, joint: 'thread', gender: 'external', depth: d.thread.depth }),
      connector('hose', ConnectorFrame.right, half, { nominal: p.hoseNominal, joint: 'hose-barb', gender: 'external', depth: barbLength }),
    ] });
  }
}
