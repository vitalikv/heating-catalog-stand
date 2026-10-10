import { BaseGenerator } from '../../core/BaseGenerator';
import { connector } from '../../core/connector';
import { ConnectorFrame } from '../../core/ConnectorFrame';
import type { GeneratedModel, ParamSpec, ThreadGender, ValidationError } from '../../core/contracts';
import { createMeshModel } from '../../core/MeshModel';
import { MaterialGroupMerger } from '../../geometry/MaterialGroupMerger';
import { ParamSchema } from '../../params/ParamSchema';
import { specs } from '../../params/specs';
import { armBodyDiameter, orientParts, threadedArm, threadedSize } from '../ThreadedParts';
import type { ThreadedSize } from '../ThreadedParts';
import { MIN_COMPRESSION_BODY, MpCompressionEnd } from './MpCompressionEnd';
import type { CompressionSize } from './MpCompressionEnd';

export interface MpCompressionTeeParams {
  /** Наружные диаметры труб прохода и отвода, мм, строкой. */
  nominal: string;
  nominalBranch: string;
  /** Между торцами гаек прохода, м. */
  length: number;
  /** От оси прохода до торца гайки (резьбы) отвода, м. */
  branchLength: number;
  /** С версии 2: отвод — обжим или трубная резьба. */
  branchEnd?: 'compression' | 'thread';
  /** С версии 2: сторона и номинал резьбы при branchEnd = 'thread'. */
  threadGender?: ThreadGender;
  threadNominal?: string;
}
/** Ровно одно из branch и thread: отвод — обжим или резьба. */
type Layout = { run: CompressionSize; branch: CompressionSize | null; thread: ThreadedSize | null };

/**
 * Обжимной тройник МП (позиция 85) по образцу VALTEC VTm.331 (с. 32): проход по X, отвод вверх;
 * A — между торцами прохода, B — от оси прохода до торца отвода. Корпус никелированный.
 * Версия 2 (позиция 127): отвод — трубная резьба, VTm.332 (внутренняя) и VTm.333 (наружная), с. 34;
 * nominalBranch тогда не используется.
 */
export class MpCompressionTeeGenerator extends BaseGenerator<MpCompressionTeeParams, Layout> {
  readonly id = 'mp.compression-tee';
  readonly version = 2;
  readonly title = 'Тройник МП обжимной';
  readonly paramSpecs: readonly ParamSpec[] = [
    MpCompressionEnd.nominalSpec('nominal', 'Проход, мм'),
    { ...MpCompressionEnd.nominalSpec('nominalBranch', 'Отвод, мм'), when: { key: 'branchEnd', values: ['compression'] } },
    specs.length('length', 'Длина A'),
    specs.length('branchLength', 'Отвод B'),
    { kind: 'choice', key: 'branchEnd', label: 'Отвод', options: ['compression', 'thread'],
      optionLabels: { compression: 'обжим', thread: 'резьба' }, addedIn: 2 },
    { ...specs.threadGender(), when: { key: 'branchEnd', values: ['thread'] }, addedIn: 2 },
    { ...specs.threadNominal('threadNominal', 'Номинал резьбы'), when: { key: 'branchEnd', values: ['thread'] }, addedIn: 2 },
  ];
  readonly defaults: MpCompressionTeeParams = {
    nominal: '16', nominalBranch: '16', length: 0.065, branchLength: 0.032, branchEnd: 'compression', threadGender: 'internal', threadNominal: '1/2',
  };

  protected override layout(p: MpCompressionTeeParams): Layout {
    const thread = p.branchEnd === 'thread' ? threadedSize(p.threadNominal!, p.threadGender!) : null;
    return { run: MpCompressionEnd.size(p.nominal), branch: thread ? null : MpCompressionEnd.size(p.nominalBranch), thread };
  }

  protected override relations(p: MpCompressionTeeParams, d: Layout): ValidationError[] {
    const errors: ValidationError[] = [];
    // Гайки прохода не заходят на корпус отвода, гайка (резьба) отвода — на корпус прохода.
    const branchBody = d.thread ? armBodyDiameter(d.thread, p.threadGender!) : d.branch!.bodyOuter;
    const run = MpCompressionEnd.minReach(d.run, branchBody);
    if (p.length / 2 <= run) errors.push(ParamSchema.tooShort('length', 2 * run));
    const branch = d.thread
      ? d.thread.depth + Math.max(MIN_COMPRESSION_BODY, d.run.bodyOuter / 2)
      : MpCompressionEnd.minReach(d.branch!, d.run.bodyOuter);
    if (p.branchLength <= branch) errors.push(ParamSchema.tooShort('branchLength', branch));
    return errors;
  }

  protected create(p: MpCompressionTeeParams, d: Layout): GeneratedModel {
    const half = p.length / 2;
    const branch = d.thread
      ? threadedArm(d.thread, p.threadGender!, p.branchLength, 'metal')
      : MpCompressionEnd.arm(d.branch!, p.branchLength);
    const merger = new MaterialGroupMerger();
    merger.add(
      ...orientParts(MpCompressionEnd.arm(d.run, half), ConnectorFrame.left.direction),
      ...MpCompressionEnd.arm(d.run, half),
      ...orientParts(branch, ConnectorFrame.top.direction),
    );
    const run = MpCompressionEnd.end(p.nominal, d.run);
    const branchPort = d.thread
      ? { depth: d.thread.depth, nominal: p.threadNominal!, joint: 'thread', gender: p.threadGender! } as const
      : MpCompressionEnd.end(p.nominalBranch, d.branch!);
    const branchLabel = d.thread ? `${p.threadNominal}${p.threadGender === 'internal' ? '(в)' : '(н)'}` : p.nominalBranch;
    const suffix = !d.thread && p.nominal === p.nominalBranch ? p.nominal : `${p.nominal}x${branchLabel}x${p.nominal}`;
    return createMeshModel({
      title: `Тройник обжимной ${suffix}`,
      ...merger.merge(),
      connectors: [
        connector('left', ConnectorFrame.left, half, run),
        connector('right', ConnectorFrame.right, half, run),
        connector('top', ConnectorFrame.top, p.branchLength, branchPort),
      ],
    });
  }
}
