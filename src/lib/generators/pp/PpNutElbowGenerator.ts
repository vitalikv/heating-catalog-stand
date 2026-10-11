import { BaseGenerator } from '../../core/BaseGenerator';
import { connector } from '../../core/connector';
import { ConnectorFrame } from '../../core/ConnectorFrame';
import type { GeneratedModel, ParamSpec, ValidationError } from '../../core/contracts';
import { createMeshModel } from '../../core/MeshModel';
import { MaterialGroupMerger } from '../../geometry/MaterialGroupMerger';
import { sleeves } from '../../geometry/SleeveGeometryBuilder';
import { spheres } from '../../geometry/SphereGeometryBuilder';
import { ParamSchema } from '../../params/ParamSchema';
import { specs } from '../../params/specs';
import { PpPipeSizes } from '../../sizes/PpPipeSizes';
import type { PartDiameters } from '../../sizes/ThreadSizes';
import { orientParts, threadedSize } from '../ThreadedParts';
import type { ThreadedSize } from '../ThreadedParts';
import { ppBody, ppSocket, ppSocketDepth, ppUnionNut } from './PpUnionParts';

export interface PpNutElbowParams {
  pipeNominal: string;
  threadNominal: string;
  /** От оси выхода с гайкой до торца раструба, A, м. */
  socketArm: number;
  /** От оси раструба до торца гайки, C, м. */
  nutArm: number;
}

type Layout = { d: PartDiameters; socket: number; thread: ThreadedSize; nut: number };

/** Буртик патрубка в гайке, м: часть гайки перед резьбой (длина гайки — резьба + 4 мм). */
const COLLAR = 0.004;
/** Латунный патрубок между углом и гайкой, м — условно. */
const SPIGOT = 0.006;

/**
 * ПП-угольник с накидной гайкой (позиция 81) по VALTEC VTp.758 (каталог 2017, с. 131): раструб вверх (+Y),
 * накидная гайка с внутренней резьбой вправо (+X) — подключение приборов. A, C и глубина раструба B — по каталогу,
 * гайка — условно.
 */
export class PpNutElbowGenerator extends BaseGenerator<PpNutElbowParams, Layout> {
  readonly id = 'pp.nut-elbow';
  readonly version = 1;
  readonly title = 'Угольник ПП с накидной гайкой';
  readonly defaults: PpNutElbowParams = { pipeNominal: '20', threadNominal: '1/2', socketArm: 0.0265, nutArm: 0.048 };
  readonly paramSpecs: readonly ParamSpec[] = [specs.ppNominal('pipeNominal'), specs.threadNominal('threadNominal', 'Резьба гайки'),
    specs.length('socketArm', 'Плечо раструба'), specs.length('nutArm', 'Плечо гайки')];

  protected override layout(p: PpNutElbowParams): Layout {
    const thread = threadedSize(p.threadNominal, 'internal');
    return { d: PpPipeSizes.require(p.pipeNominal), socket: ppSocketDepth(p.pipeNominal), thread, nut: thread.depth + 0.004 };
  }

  protected override relations(p: PpNutElbowParams, l: Layout): ValidationError[] {
    const errors: ValidationError[] = [];
    if (p.socketArm <= l.socket + l.d.n / 2 * 0.5) errors.push(ParamSchema.tooShort('socketArm', l.socket + l.d.n / 4));
    const nutMin = l.d.n / 2 + SPIGOT + l.nut;
    if (p.nutArm <= nutMin) errors.push(ParamSchema.tooShort('nutArm', nutMin));
    return errors;
  }

  protected create(p: PpNutElbowParams, l: Layout): GeneratedModel {
    const socketStart = p.socketArm - l.socket;
    const nutStart = p.nutArm - l.nut;
    const quarter = { phiLength: Math.PI / 2, rotation: { x: Math.PI / 2, y: 0, z: 0 } };
    const merger = new MaterialGroupMerger();
    merger.add(
      ...orientParts([...ppBody(l.d, 0, socketStart), ...ppSocket(l.d, socketStart, p.socketArm)], ConnectorFrame.top.direction),
      ...ppBody(l.d, 0, l.d.n / 2),
      spheres.build({ material: 'plastic', ...quarter, radius: l.d.n / 2 }),
      ...sleeves.build({ material: 'metal', length: nutStart - l.d.n / 2, outerDiameter: l.thread.n * 0.85, innerDiameter: l.thread.v * 0.7,
        center: { x: (l.d.n / 2 + nutStart) / 2, y: 0, z: 0 } }),
      ...ppUnionNut(l.thread.n * 1.2, l.thread.n, nutStart, p.nutArm),
      // Буртик патрубка внутри гайки перед резьбой: гайка сидит на нём, а не висит вокруг патрубка.
      ...sleeves.build({ material: 'metal', length: COLLAR, outerDiameter: l.thread.n, innerDiameter: l.thread.v * 0.7,
        center: { x: nutStart + COLLAR / 2, y: 0, z: 0 } }),
    );
    return createMeshModel({
      title: `Угольник ПП ${p.pipeNominal} × гайка ${p.threadNominal}`,
      ...merger.merge(),
      connectors: [
        connector('socket', ConnectorFrame.top, p.socketArm, { nominal: p.pipeNominal, joint: 'pp-socket', gender: 'internal', depth: l.socket }),
        connector('nut', ConnectorFrame.right, p.nutArm, { nominal: p.threadNominal, joint: 'thread', gender: 'internal', depth: l.thread.depth }),
      ],
    });
  }
}
