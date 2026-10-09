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

export interface SteelBushingParams { outerNominal: string; innerNominal: string; length: number }
type Layout = { outer: ReturnType<typeof threadedSize>; inner: ReturnType<typeof threadedSize> };

export class SteelBushingGenerator extends BaseGenerator<SteelBushingParams, Layout> {
  readonly id = 'steel.bushing';
  readonly version = 1;
  readonly title = 'Футорка резьбовая';
  readonly defaults: SteelBushingParams = { outerNominal: '3/4', innerNominal: '1/2', length: 0.022 };
  readonly paramSpecs: readonly ParamSpec[] = [specs.threadNominal('outerNominal', 'Наружная резьба'),
    specs.threadNominal('innerNominal', 'Внутренняя резьба'), specs.length('length', 'Длина')];
  protected override layout(p: SteelBushingParams): Layout {
    return { outer: threadedSize(p.outerNominal, 'external'), inner: threadedSize(p.innerNominal, 'internal') };
  }
  protected override relations(p: SteelBushingParams, d: Layout): ValidationError[] {
    const errors: ValidationError[] = [];
    if (d.outer.n - d.inner.v < 0.002) errors.push({ code: 'wall_too_thin', param: 'innerNominal', message: 'Внутренняя резьба слишком велика для наружной' });
    if (p.length <= Math.max(d.outer.depth + 0.005, d.inner.depth)) errors.push(ParamSchema.tooShort('length', Math.max(d.outer.depth + 0.005, d.inner.depth)));
    return errors;
  }
  protected create(p: SteelBushingParams, d: Layout): GeneratedModel {
    const merger = new MaterialGroupMerger();
    merger.add(
      ...sleeves.build({ material: 'metal', length: p.length - 0.005, outerDiameter: d.outer.n, innerDiameter: d.inner.v,
        center: { x: -0.0025, y: 0, z: 0 }, materials: { outer: 'thread', inner: 'thread' } }),
      ...sleeves.build({ material: 'metal', length: 0.005, outerDiameter: d.outer.n * 1.4, innerDiameter: d.inner.v,
        outerSegments: 6, center: { x: p.length / 2 - 0.0025, y: 0, z: 0 }, materials: { outer: 'metalFlat', inner: 'thread' } }),
    );
    return createMeshModel({ title: `Футорка ${p.outerNominal}(н) × ${p.innerNominal}(в)`, ...merger.merge(), connectors: [
      connector('left', ConnectorFrame.left, p.length / 2, { nominal: p.outerNominal, joint: 'thread', gender: 'external', depth: d.outer.depth }),
      connector('right', ConnectorFrame.right, p.length / 2, { nominal: p.innerNominal, joint: 'thread', gender: 'internal', depth: d.inner.depth }),
    ] });
  }
}
