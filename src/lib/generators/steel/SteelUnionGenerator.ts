import { BaseGenerator } from '../../core/BaseGenerator';
import { connector } from '../../core/connector';
import { ConnectorFrame } from '../../core/ConnectorFrame';
import type { GeneratedModel, ParamSpec, ThreadGender, ValidationError } from '../../core/contracts';
import { createMeshModel } from '../../core/MeshModel';
import { MaterialGroupMerger } from '../../geometry/MaterialGroupMerger';
import { ParamSchema } from '../../params/ParamSchema';
import { specs } from '../../params/specs';
import { angleCorner, orientParts, threadedArm, threadedSize, unionNut } from '../ThreadedParts';

/** Концы американки: В–Н (VALTEC VTr.341), В–В (VTr.340), Н–Н (VTr.728). */
export type SteelUnionEnds = 'internal-external' | 'internal' | 'external';

export interface SteelUnionParams {
  nominal: string;
  armLength: number;
  configuration: 'straight' | 'angle';
  /** Версия 2; только у прямой. Нет — В–Н, прежняя модель. */
  ends?: SteelUnionEnds;
}
type Layout = { inner: ReturnType<typeof threadedSize>; outer: ReturnType<typeof threadedSize> };

const ENDS: Record<Exclude<SteelUnionEnds, 'internal-external'>, ThreadGender> = { internal: 'internal', external: 'external' };

/**
 * Полная американка. armLength — расстояние от центра корпуса до каждого торца.
 * Версия 2: ends — В–В и Н–Н у прямой (позиция 132): одинаковые концы, накидная гайка
 * разъёма посередине. Умолчание В–Н и угловая — прежняя модель.
 */
export class SteelUnionGenerator extends BaseGenerator<SteelUnionParams, Layout> {
  readonly id = 'steel.union';
  readonly version = 2;
  readonly title = 'Американка прямая / угловая';
  readonly defaults: SteelUnionParams = { nominal: '1/2', armLength: 0.035, configuration: 'straight', ends: 'internal-external' };
  readonly paramSpecs: readonly ParamSpec[] = [specs.threadNominal('nominal', 'Резьба'), specs.length('armLength', 'Плечо'),
    { kind: 'choice', key: 'configuration', label: 'Исполнение', options: ['straight', 'angle'], optionLabels: { straight: 'прямая', angle: 'угловая' } },
    { kind: 'choice', key: 'ends', label: 'Концы', options: ['internal-external', 'internal', 'external'],
      optionLabels: { 'internal-external': 'В–Н', internal: 'В–В', external: 'Н–Н' }, when: { key: 'configuration', values: ['straight'] }, addedIn: 2 }];
  protected override layout(p: SteelUnionParams): Layout {
    return { inner: threadedSize(p.nominal, 'internal'), outer: threadedSize(p.nominal, 'external') };
  }
  protected override relations(p: SteelUnionParams, d: Layout): ValidationError[] {
    const same = this.sameEnds(p);
    if (same) {
      // Резьба на торце и половина гайки разъёма посередине не перекрываются.
      const size = same === 'internal' ? d.inner : d.outer;
      const min = size.depth + d.outer.depth / 2;
      return p.armLength <= min ? [ParamSchema.tooShort('armLength', min)] : [];
    }
    const min = Math.max(d.inner.depth + d.inner.n / 2, 2 * d.outer.depth + 0.004);
    return p.armLength <= min ? [ParamSchema.tooShort('armLength', min)] : [];
  }
  protected create(p: SteelUnionParams, d: Layout): GeneratedModel {
    const same = this.sameEnds(p);
    if (same) return this.createSymmetric(p, d, same);
    const first = p.configuration === 'straight' ? ConnectorFrame.left : ConnectorFrame.bottom;
    const merger = new MaterialGroupMerger();
    merger.add(...orientParts(threadedArm(d.inner, 'internal', p.armLength), first.direction),
      ...threadedArm(d.outer, 'external', p.armLength), ...unionNut(d.outer, p.armLength - 1.5 * d.outer.depth));
    // Конус у основания выхода не заходит под гайку.
    if (p.configuration === 'angle') merger.add(...angleCorner(d.inner, d.outer, first.direction, ConnectorFrame.right.direction, p.armLength - 2 * d.outer.depth));
    return createMeshModel({ title: `Американка ${p.nominal} ${p.configuration === 'straight' ? 'прямая' : 'угловая'}`, ...merger.merge(), connectors: [
      connector('inlet', first, p.armLength, { nominal: p.nominal, joint: 'thread', gender: 'internal', depth: d.inner.depth }),
      connector('outlet', ConnectorFrame.right, p.armLength, { nominal: p.nominal, joint: 'thread', gender: 'external', depth: d.outer.depth }),
    ] });
  }

  /** В–В или Н–Н прямой американки; null — прежнее исполнение В–Н или угловая. */
  private sameEnds(p: SteelUnionParams): ThreadGender | null {
    if (p.configuration !== 'straight' || !p.ends || p.ends === 'internal-external') return null;
    return ENDS[p.ends];
  }

  /** Два одинаковых плеча и накидная гайка разъёма по центру; порты inlet (−X) и outlet (+X). */
  private createSymmetric(p: SteelUnionParams, d: Layout, gender: ThreadGender): GeneratedModel {
    const size = gender === 'internal' ? d.inner : d.outer;
    const merger = new MaterialGroupMerger();
    merger.add(...orientParts(threadedArm(size, gender, p.armLength), ConnectorFrame.left.direction),
      ...threadedArm(size, gender, p.armLength), ...unionNut(d.inner, 0));
    const port = { nominal: p.nominal, joint: 'thread', gender, depth: size.depth } as const;
    return createMeshModel({ title: `Американка ${p.nominal} ${gender === 'internal' ? 'В–В' : 'Н–Н'}`, ...merger.merge(), connectors: [
      connector('inlet', ConnectorFrame.left, p.armLength, port),
      connector('outlet', ConnectorFrame.right, p.armLength, port),
    ] });
  }
}
