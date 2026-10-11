import { BaseGenerator } from '../../core/BaseGenerator';
import { connector } from '../../core/connector';
import { ConnectorFrame } from '../../core/ConnectorFrame';
import type { Connector, GeneratedModel, ParamSpec, ValidationError } from '../../core/contracts';
import { createMeshModel } from '../../core/MeshModel';
import { MaterialGroupMerger } from '../../geometry/MaterialGroupMerger';
import { ParamSchema } from '../../params/ParamSchema';
import { specs } from '../../params/specs';
import { PpPipeSizes } from '../../sizes/PpPipeSizes';
import type { PartDiameters } from '../../sizes/ThreadSizes';
import { brassEnd, brassEndParts, ppBody, ppSocket, ppSocketDepth, ppUnionNut } from './PpUnionParts';
import type { BrassEnd } from './PpUnionParts';

/**
 * Второй конец (справа): socket — раструб, муфта разъёмная VTp.763; external — наружная резьба, VTp.761;
 * internal — внутренняя резьба, VTp.762; nut — накидная гайка, соединитель VTp.708.
 */
export type PpUnionEnd = 'socket' | 'external' | 'internal' | 'nut';

export interface PpUnionParams {
  pipeNominal: string;
  end: PpUnionEnd;
  /** Резьба второго конца; у socket не используется. */
  threadNominal: string;
  /** Общая длина A, м. */
  length: number;
}

type Layout = { d: PartDiameters; socket: number; brass: BrassEnd | null; nut: { diameter: number; length: number } };

/** Наименьшие длины гайки разъёма и пластикового корпуса между раструбом и гайкой, м. */
const MIN_NUT = 0.004;
const MIN_BODY = 0.002;
/** Диаметр накидной гайки муфты разъёмной VTp.763 (B), мм; иначе — по резьбе, условно. */
const SOCKET_NUT_MM: Readonly<Record<string, number>> = { 20: 39, 25: 42, 32: 51, 40: 59, 50: 72, 63: 85 };

/**
 * ПП-разъёмное соединение (позиция 30) по VALTEC VTp.761 / 762 / 763 / 708 (каталог 2017, с. 124, 132):
 * слева раструб под пайку (−X), справа — второй конец по end; разъём с накидной гайкой посередине.
 * A и глубина раструба B — по каталогу; гайки и латунные части — условно.
 */
export class PpUnionGenerator extends BaseGenerator<PpUnionParams, Layout> {
  readonly id = 'pp.union';
  readonly version = 1;
  readonly title = 'Соединитель ПП разъёмный';
  readonly defaults: PpUnionParams = { pipeNominal: '20', end: 'socket', threadNominal: '1/2', length: 0.042 };
  readonly paramSpecs: readonly ParamSpec[] = [specs.ppNominal('pipeNominal'),
    { kind: 'choice', key: 'end', label: 'Второй конец', options: ['socket', 'external', 'internal', 'nut'],
      optionLabels: { socket: 'раструб', external: 'резьба (н)', internal: 'резьба (в)', nut: 'накидная гайка' } },
    { ...specs.threadNominal('threadNominal', 'Резьба'), when: { key: 'end', values: ['external', 'internal', 'nut'] } },
    specs.length('length', 'Длина')];

  protected override layout(p: PpUnionParams): Layout {
    const d = PpPipeSizes.require(p.pipeNominal);
    const socket = ppSocketDepth(p.pipeNominal);
    // Гайка занимает свободную длину между раструбом и латунным концом, но не длиннее 0,35 диаметра.
    if (p.end === 'socket') {
      const diameter = SOCKET_NUT_MM[p.pipeNominal] !== undefined ? SOCKET_NUT_MM[p.pipeNominal] / 1000 : d.n * 1.9;
      return { d, socket, brass: null, nut: { diameter, length: Math.min(d.n * 0.6, p.length - 2 * socket - MIN_BODY) } };
    }
    const brass = brassEnd(p.threadNominal, p.end === 'external' ? 'external' : 'internal');
    const free = p.length - socket - MIN_BODY - (p.end === 'nut' ? 0 : brass.length);
    // Гайка соединителя VTp.708 вмещает резьбу целиком.
    const wanted = p.end === 'nut' ? brass.size.depth + 0.004 : Math.max(MIN_NUT, brass.size.n * 0.35);
    return { d, socket, brass, nut: { diameter: Math.max(d.n, brass.size.n) * 1.45, length: Math.min(free, wanted) } };
  }

  protected override relations(p: PpUnionParams, d: Layout): ValidationError[] {
    // Гайка накидного конца (nut) должна вместить резьбу.
    const nut = p.end === 'nut' && d.brass ? Math.max(MIN_NUT, d.brass.size.depth) : MIN_NUT;
    if (d.nut.length >= nut) return [];
    return [ParamSchema.tooShort('length', p.length - d.nut.length + nut)];
  }

  protected create(p: PpUnionParams, l: Layout): GeneratedModel {
    const half = p.length / 2;
    const left = -half + l.socket;
    const merger = new MaterialGroupMerger();
    merger.add(...ppSocket(l.d, -half, left));
    const port = { nominal: p.pipeNominal, joint: 'pp-socket', gender: 'internal', depth: l.socket } as const;
    const connectors: Connector[] = [connector('left', ConnectorFrame.left, half, port)];
    if (!l.brass) {
      const right = half - l.socket;
      merger.add(...ppBody(l.d, left, right), ...ppSocket(l.d, right, half),
        ...ppUnionNut(l.nut.diameter, l.d.n, -l.nut.length / 2, l.nut.length / 2));
      connectors.push(connector('right', ConnectorFrame.right, half, port));
    } else if (p.end === 'nut') {
      // Накидная гайка на торце: внутренняя резьба на всю глубину посадки.
      const nutStart = half - l.nut.length;
      merger.add(...ppBody(l.d, left, nutStart), ...ppUnionNut(l.nut.diameter, l.brass.size.n, nutStart, half));
      connectors.push(connector('right', ConnectorFrame.right, half,
        { nominal: p.threadNominal, joint: 'thread', gender: 'internal', depth: l.brass.size.depth }));
    } else {
      const endStart = half - l.brass.length;
      const nutStart = endStart - l.nut.length;
      merger.add(...ppBody(l.d, left, nutStart), ...ppUnionNut(l.nut.diameter, l.d.n, nutStart, endStart),
        ...brassEndParts(l.brass, endStart, half));
      connectors.push(connector('right', ConnectorFrame.right, half,
        { nominal: p.threadNominal, joint: 'thread', gender: l.brass.gender, depth: l.brass.size.depth }));
    }
    const ends: Record<PpUnionEnd, string> = { socket: '', external: ` × ${p.threadNominal}(н)`, internal: ` × ${p.threadNominal}(в)`, nut: ` × гайка ${p.threadNominal}` };
    return createMeshModel({ title: `Соединитель ПП разъёмный ${p.pipeNominal}${ends[p.end]}`, ...merger.merge(), connectors });
  }
}
