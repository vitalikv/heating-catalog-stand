import { BaseGenerator } from '../../core/BaseGenerator';
import { connector } from '../../core/connector';
import { ConnectorFrame } from '../../core/ConnectorFrame';
import type { Connector, GeneratedModel, ParamSpec, ValidationError } from '../../core/contracts';
import { createMeshModel } from '../../core/MeshModel';
import { MaterialGroupMerger } from '../../geometry/MaterialGroupMerger';
import { sleeves } from '../../geometry/SleeveGeometryBuilder';
import { ParamSchema } from '../../params/ParamSchema';
import { specs } from '../../params/specs';
import { threadedSize } from '../ThreadedParts';
import type { ThreadedSize } from '../ThreadedParts';
import { locknutThickness } from './SteelLocknutGenerator';

export interface SteelRunningNippleParams {
  nominal: string;
  /** Общая длина A, м. */
  length: number;
  /** Длинная резьба L1 справа, м. */
  longThread: number;
  /** Короткая резьба L2 слева, м. */
  shortThread: number;
}

/**
 * Сгон Н–Н (позиция 12) по VALTEC VTr.653 (каталог 2017, с. 79): трубка с короткой резьбой L2 слева
 * и длинной L1 справа — на длинную резьбу сгоняют муфту и контргайку. Порты left / right — торцы
 * с обычной глубиной посадки. Порт locknut — у начала длинной резьбы: контргайка VTr.656 садится
 * вплотную к гладкой части; есть, только если номинал есть в таблице контргаек.
 */
export class SteelRunningNippleGenerator extends BaseGenerator<SteelRunningNippleParams, ThreadedSize> {
  readonly id = 'steel.running-nipple';
  readonly version = 1;
  readonly title = 'Сгон Н–Н';
  readonly defaults: SteelRunningNippleParams = { nominal: '1/2', length: 0.1, longThread: 0.04, shortThread: 0.01 };
  readonly paramSpecs: readonly ParamSpec[] = [specs.threadNominal('nominal', 'Резьба'), specs.length('length', 'Длина', { max: 0.5 }),
    specs.length('longThread', 'Длинная резьба L1'), specs.length('shortThread', 'Короткая резьба L2', { max: 0.05 })];

  protected override layout(p: SteelRunningNippleParams): ThreadedSize { return threadedSize(p.nominal, 'external'); }

  protected override relations(p: SteelRunningNippleParams, d: ThreadedSize): ValidationError[] {
    const errors: ValidationError[] = [];
    if (p.shortThread < d.depth) errors.push(ParamSchema.tooShort('shortThread', d.depth));
    const long = Math.max(d.depth, locknutThickness(p.nominal) ?? 0);
    if (p.longThread <= long) errors.push(ParamSchema.tooShort('longThread', long));
    if (p.length <= p.longThread + p.shortThread) errors.push(ParamSchema.tooShort('length', p.longThread + p.shortThread));
    return errors;
  }

  protected create(p: SteelRunningNippleParams, d: ThreadedSize): GeneratedModel {
    const half = p.length / 2;
    const smooth = p.length - p.longThread - p.shortThread;
    const merger = new MaterialGroupMerger();
    merger.add(
      ...sleeves.build({ material: 'metal', length: p.shortThread, outerDiameter: d.n, innerDiameter: d.v,
        center: { x: -half + p.shortThread / 2, y: 0, z: 0 }, materials: { outer: 'thread' } }),
      ...sleeves.build({ material: 'metal', length: smooth, outerDiameter: d.n, innerDiameter: d.v,
        center: { x: -half + p.shortThread + smooth / 2, y: 0, z: 0 } }),
      ...sleeves.build({ material: 'metal', length: p.longThread, outerDiameter: d.n, innerDiameter: d.v,
        center: { x: half - p.longThread / 2, y: 0, z: 0 }, materials: { outer: 'thread' } }),
    );
    const port = { nominal: p.nominal, joint: 'thread', gender: 'external' } as const;
    const connectors: Connector[] = [
      connector('left', ConnectorFrame.left, half, { ...port, depth: Math.min(d.depth, p.shortThread) }),
      connector('right', ConnectorFrame.right, half, { ...port, depth: d.depth }),
    ];
    const locknut = locknutThickness(p.nominal);
    if (locknut !== undefined) {
      connectors.push(connector('locknut', ConnectorFrame.right, { x: half - p.longThread + locknut, y: 0, z: 0 }, { ...port, depth: locknut }));
    }
    return createMeshModel({ title: `Сгон ${p.nominal} × ${Math.round(p.length * 1000)}`, ...merger.merge(), connectors });
  }
}
