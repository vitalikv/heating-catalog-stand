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
import type { ThreadedSize } from '../ThreadedParts';

export interface CheckValveParams { nominal: string; length: number; flow: 'left-to-right' | 'right-to-left' }

/** Обобщённый пружинный клапан; направление потока показано стрелкой, без гидравлического расчёта. */
export class CheckValveGenerator extends BaseGenerator<CheckValveParams, ThreadedSize> {
  readonly id = 'valve.check';
  readonly version = 1;
  readonly title = 'Клапан обратный';
  readonly defaults: CheckValveParams = { nominal: '1/2', length: 0.055, flow: 'left-to-right' };
  readonly paramSpecs: readonly ParamSpec[] = [specs.threadNominal('nominal', 'Резьба'), specs.length('length', 'Длина'),
    { kind: 'choice', key: 'flow', label: 'Поток', options: ['left-to-right', 'right-to-left'],
      optionLabels: { 'left-to-right': 'слева направо', 'right-to-left': 'справа налево' } }];
  protected override layout(p: CheckValveParams) { return threadedSize(p.nominal, 'internal'); }
  protected override relations(p: CheckValveParams, d: ThreadedSize): ValidationError[] {
    return p.length <= 2 * d.depth + 0.012 ? [ParamSchema.tooShort('length', 2 * d.depth + 0.012)] : [];
  }
  protected create(p: CheckValveParams, d: ThreadedSize): GeneratedModel {
    const merger = new MaterialGroupMerger();
    const bodyLength = p.length - 2 * d.depth;
    merger.add(...threadedArm(d, 'internal', p.length / 2, 'bronze'),
      ...orientParts(threadedArm(d, 'internal', p.length / 2, 'bronze'), ConnectorFrame.left.direction),
      ...sleeves.build({ material: 'bronze', length: bodyLength, outerDiameter: d.n * 1.5, innerDiameter: d.v }),
      ...sleeves.build({ material: 'bronzeFlat', length: 0.006, outerDiameter: d.n * 1.85, innerDiameter: d.n * 1.5,
        outerSegments: 6, center: { x: -bodyLength / 2 + 0.003, y: 0, z: 0 } }));
    const a = Math.min(0.008, bodyLength / 4);
    merger.add(shapes.build({ material: 'black', depth: 0.001,
      points: [{ x: -a, y: -0.001 }, { x: a / 3, y: -0.001 }, { x: a / 3, y: -0.003 },
        { x: a, y: 0 }, { x: a / 3, y: 0.003 }, { x: a / 3, y: 0.001 }, { x: -a, y: 0.001 }],
      rotation: { x: 0, y: 0, z: p.flow === 'left-to-right' ? 0 : Math.PI }, position: { x: 0, y: 0, z: d.n * 0.75 - 0.0002 } }));
    const end = { nominal: p.nominal, gender: 'internal', joint: 'thread', depth: d.depth } as const;
    return createMeshModel({ title: `Клапан обратный ${p.nominal} ${p.flow === 'left-to-right' ? '→' : '←'}`, ...merger.merge(), connectors: [
      connector('left', ConnectorFrame.left, p.length / 2, end), connector('right', ConnectorFrame.right, p.length / 2, end),
    ] });
  }
}
