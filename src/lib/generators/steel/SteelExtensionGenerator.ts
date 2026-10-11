import { BaseGenerator } from '../../core/BaseGenerator';
import { connector } from '../../core/connector';
import { ConnectorFrame } from '../../core/ConnectorFrame';
import type { GeneratedModel, ParamSpec, ValidationError } from '../../core/contracts';
import { createMeshModel } from '../../core/MeshModel';
import { MaterialGroupMerger } from '../../geometry/MaterialGroupMerger';
import { sleeves } from '../../geometry/SleeveGeometryBuilder';
import { ParamSchema } from '../../params/ParamSchema';
import { specs } from '../../params/specs';
import { armBodyDiameter, threadedSize } from '../ThreadedParts';
import type { ThreadedSize } from '../ThreadedParts';
import { hexDiameter } from './SteelLocknutGenerator';

export interface SteelExtensionParams {
  nominal: string;
  /** Общая длина A, м. */
  length: number;
}

type Layout = { inner: ThreadedSize; outer: ThreadedSize; external: number; hex: number };

/**
 * VALTEC VTr.197 / VTr.198.C (каталог 2017, с. 69): длина наружной резьбы A − B, мм; шестигранник
 * S = 24 мм у 1/2. Для других номиналов — резьба 1,2 глубины посадки и шестигранник по корпусу, условно.
 */
const EXTERNAL_THREAD: Record<string, number> = { '1/2': 10, '3/4': 11, '1': 12 };
const HEX: Record<string, number> = { '1/2': 24 };

/**
 * Удлинитель В–Н (позиция 11): шестигранный корпус с внутренней резьбой слева (−X)
 * и наружной справа (+X). Порты на торцах ±length/2.
 */
export class SteelExtensionGenerator extends BaseGenerator<SteelExtensionParams, Layout> {
  readonly id = 'steel.extension';
  readonly version = 1;
  readonly title = 'Удлинитель резьбовой В–Н';
  readonly defaults: SteelExtensionParams = { nominal: '1/2', length: 0.03 };
  readonly paramSpecs: readonly ParamSpec[] = [specs.threadNominal('nominal', 'Резьба'), specs.length('length', 'Длина')];

  protected override layout(p: SteelExtensionParams): Layout {
    const inner = threadedSize(p.nominal, 'internal');
    const outer = threadedSize(p.nominal, 'external');
    const external = EXTERNAL_THREAD[p.nominal] !== undefined ? EXTERNAL_THREAD[p.nominal] / 1000 : outer.depth * 1.2;
    const hex = HEX[p.nominal] !== undefined ? hexDiameter(HEX[p.nominal]) : armBodyDiameter(inner, 'internal') / Math.cos(Math.PI / 6);
    return { inner, outer, external, hex };
  }

  protected override relations(p: SteelExtensionParams, d: Layout): ValidationError[] {
    const min = d.external + d.inner.depth;
    return p.length <= min ? [ParamSchema.tooShort('length', min)] : [];
  }

  protected create(p: SteelExtensionParams, d: Layout): GeneratedModel {
    const half = p.length / 2;
    const body = p.length - d.external;
    const merger = new MaterialGroupMerger();
    merger.add(
      ...sleeves.build({ material: 'metal', length: d.inner.depth, outerDiameter: d.hex, innerDiameter: d.inner.n, outerSegments: 6,
        center: { x: -half + d.inner.depth / 2, y: 0, z: 0 }, materials: { outer: 'metalFlat', inner: 'thread' } }),
      ...sleeves.build({ material: 'metal', length: body - d.inner.depth, outerDiameter: d.hex, innerDiameter: d.outer.v, outerSegments: 6,
        center: { x: -half + (body + d.inner.depth) / 2, y: 0, z: 0 }, materials: { outer: 'metalFlat' } }),
      ...sleeves.build({ material: 'metal', length: d.external, outerDiameter: d.outer.n, innerDiameter: d.outer.v,
        center: { x: half - d.external / 2, y: 0, z: 0 }, materials: { outer: 'thread' } }),
    );
    return createMeshModel({
      title: `Удлинитель ${p.nominal} × ${Math.round(body * 1000)}`,
      ...merger.merge(),
      connectors: [
        connector('left', ConnectorFrame.left, half, { nominal: p.nominal, joint: 'thread', gender: 'internal', depth: d.inner.depth }),
        connector('right', ConnectorFrame.right, half, { nominal: p.nominal, joint: 'thread', gender: 'external', depth: Math.min(d.outer.depth, d.external) }),
      ],
    });
  }
}
