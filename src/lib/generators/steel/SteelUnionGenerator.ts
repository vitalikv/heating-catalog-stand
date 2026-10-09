import { BaseGenerator } from '../../core/BaseGenerator';
import { connector } from '../../core/connector';
import { ConnectorFrame } from '../../core/ConnectorFrame';
import type { GeneratedModel, ParamSpec, ValidationError } from '../../core/contracts';
import { createMeshModel } from '../../core/MeshModel';
import { MaterialGroupMerger } from '../../geometry/MaterialGroupMerger';
import { spheres } from '../../geometry/SphereGeometryBuilder';
import { ParamSchema } from '../../params/ParamSchema';
import { specs } from '../../params/specs';
import { orientParts, threadedArm, threadedSize, unionNut } from '../ThreadedParts';

export interface SteelUnionParams { nominal: string; armLength: number; configuration: 'straight' | 'angle' }
type Layout = { inner: ReturnType<typeof threadedSize>; outer: ReturnType<typeof threadedSize> };

/** Полная американка В–Н. armLength — расстояние от центра корпуса до каждого торца. */
export class SteelUnionGenerator extends BaseGenerator<SteelUnionParams, Layout> {
  readonly id = 'steel.union';
  readonly version = 1;
  readonly title = 'Американка прямая / угловая';
  readonly defaults: SteelUnionParams = { nominal: '1/2', armLength: 0.035, configuration: 'straight' };
  readonly paramSpecs: readonly ParamSpec[] = [specs.threadNominal('nominal', 'Резьба'), specs.length('armLength', 'Плечо'),
    { kind: 'choice', key: 'configuration', label: 'Исполнение', options: ['straight', 'angle'], optionLabels: { straight: 'прямая', angle: 'угловая' } }];
  protected override layout(p: SteelUnionParams): Layout {
    return { inner: threadedSize(p.nominal, 'internal'), outer: threadedSize(p.nominal, 'external') };
  }
  protected override relations(p: SteelUnionParams, d: Layout): ValidationError[] {
    const min = Math.max(d.inner.depth + d.inner.n / 2, 2 * d.outer.depth + 0.004);
    return p.armLength <= min ? [ParamSchema.tooShort('armLength', min)] : [];
  }
  protected create(p: SteelUnionParams, d: Layout): GeneratedModel {
    const first = p.configuration === 'straight' ? ConnectorFrame.left : ConnectorFrame.bottom;
    const merger = new MaterialGroupMerger();
    merger.add(...orientParts(threadedArm(d.inner, 'internal', p.armLength), first.direction),
      ...threadedArm(d.outer, 'external', p.armLength), ...unionNut(d.outer, p.armLength - 1.5 * d.outer.depth));
    if (p.configuration === 'angle') merger.add(spheres.build({ material: 'metal', radius: d.inner.n * 0.58 }));
    return createMeshModel({ title: `Американка ${p.nominal} ${p.configuration === 'straight' ? 'прямая' : 'угловая'}`, ...merger.merge(), connectors: [
      connector('inlet', first, p.armLength, { nominal: p.nominal, joint: 'thread', gender: 'internal', depth: d.inner.depth }),
      connector('outlet', ConnectorFrame.right, p.armLength, { nominal: p.nominal, joint: 'thread', gender: 'external', depth: d.outer.depth }),
    ] });
  }
}
