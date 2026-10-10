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

export interface MpCompressionElbowParams {
  /** Наружный диаметр МП-трубы, мм, строкой. */
  nominal: string;
  /** Обжимное плечо: от оси другого плеча до торца штуцера (гайки), м — A (B у VTm.352/353). */
  armLength: number;
  /** С версии 2: конец по +Y — обжим (как справа) или трубная резьба. */
  topEnd?: 'compression' | 'thread';
  /** С версии 2: сторона и номинал резьбы при topEnd = 'thread'. */
  threadGender?: ThreadGender;
  threadNominal?: string;
  /** С версии 2: резьбовое плечо от оси обжимного до торца резьбы, м (A у VTm.352/353). */
  threadArmLength?: number;
}
type Layout = { pipe: CompressionSize; thread: ThreadedSize | null };

/**
 * Обжимной угол 90° МП (позиция 84) по образцу VALTEC VTm.351 (с. 36): плечи по +X и +Y.
 * Версия 2 (позиция 126): верхний конец может быть трубной резьбой — VTm.352 (внутренняя)
 * и VTm.353 (наружная), плечи разной длины (с. 37). Корпус и резьба никелированные.
 */
export class MpCompressionElbowGenerator extends BaseGenerator<MpCompressionElbowParams, Layout> {
  readonly id = 'mp.compression-elbow';
  readonly version = 2;
  readonly title = 'Угол МП обжимной';
  readonly paramSpecs: readonly ParamSpec[] = [
    MpCompressionEnd.nominalSpec('nominal'),
    specs.length('armLength', 'Плечо обжима'),
    { kind: 'choice', key: 'topEnd', label: 'Второй конец', options: ['compression', 'thread'],
      optionLabels: { compression: 'обжим', thread: 'резьба' }, addedIn: 2 },
    { ...specs.threadGender(), when: { key: 'topEnd', values: ['thread'] }, addedIn: 2 },
    { ...specs.threadNominal('threadNominal', 'Номинал резьбы'), when: { key: 'topEnd', values: ['thread'] }, addedIn: 2 },
    { ...specs.length('threadArmLength', 'Плечо резьбы'), when: { key: 'topEnd', values: ['thread'] }, addedIn: 2 },
  ];
  readonly defaults: MpCompressionElbowParams = {
    nominal: '16', armLength: 0.036, topEnd: 'compression', threadGender: 'internal', threadNominal: '1/2', threadArmLength: 0.027,
  };

  protected override layout(p: MpCompressionElbowParams): Layout {
    const thread = p.topEnd === 'thread' ? threadedSize(p.threadNominal!, p.threadGender!) : null;
    return { pipe: MpCompressionEnd.size(p.nominal), thread };
  }

  protected override relations(p: MpCompressionElbowParams, d: Layout): ValidationError[] {
    const errors: ValidationError[] = [];
    // Гайка не заходит на корпус соседнего плеча, резьба — на корпус обжимного.
    const topBody = d.thread ? armBodyDiameter(d.thread, p.threadGender!) : d.pipe.bodyOuter;
    const arm = MpCompressionEnd.minReach(d.pipe, topBody);
    if (p.armLength <= arm) errors.push(ParamSchema.tooShort('armLength', arm));
    if (d.thread) {
      const threadArm = d.thread.depth + Math.max(MIN_COMPRESSION_BODY, d.pipe.bodyOuter / 2);
      if (p.threadArmLength! <= threadArm) errors.push(ParamSchema.tooShort('threadArmLength', threadArm));
    }
    return errors;
  }

  protected create(p: MpCompressionElbowParams, d: Layout): GeneratedModel {
    const topLength = d.thread ? p.threadArmLength! : p.armLength;
    const top = d.thread
      ? threadedArm(d.thread, p.threadGender!, topLength, 'metal')
      : MpCompressionEnd.arm(d.pipe, topLength);
    const merger = new MaterialGroupMerger();
    merger.add(
      ...MpCompressionEnd.arm(d.pipe, p.armLength),
      ...orientParts(top, ConnectorFrame.top.direction),
      ...MpCompressionEnd.corner(d.pipe),
    );
    const topPort = d.thread
      ? { depth: d.thread.depth, nominal: p.threadNominal!, joint: 'thread', gender: p.threadGender! } as const
      : MpCompressionEnd.end(p.nominal, d.pipe);
    const suffix = d.thread ? `x${p.threadNominal}${p.threadGender === 'internal' ? '(в)' : '(н)'}` : '';
    return createMeshModel({
      title: `Угол обжимной ${p.nominal}${suffix}`,
      ...merger.merge(),
      connectors: [
        connector('right', ConnectorFrame.right, p.armLength, MpCompressionEnd.end(p.nominal, d.pipe)),
        connector('top', ConnectorFrame.top, topLength, topPort),
      ],
    });
  }
}
