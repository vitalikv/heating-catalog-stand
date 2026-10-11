import { BaseGenerator } from '../../core/BaseGenerator';
import { connector } from '../../core/connector';
import { ConnectorFrame } from '../../core/ConnectorFrame';
import type { GeneratedModel, ParamSpec, ValidationError } from '../../core/contracts';
import { createMeshModel } from '../../core/MeshModel';
import { MaterialGroupMerger } from '../../geometry/MaterialGroupMerger';
import { sleeves } from '../../geometry/SleeveGeometryBuilder';
import { ParamSchema } from '../../params/ParamSchema';
import { specs } from '../../params/specs';
import { MpPipeSizes } from '../../sizes/MpPipeSizes';
import type { PartDiameters } from '../../sizes/ThreadSizes';
import { threadedSize } from '../ThreadedParts';
import type { ThreadedSize } from '../ThreadedParts';
import { MpPressEnd } from './MpPressEnd';

export interface MpNutAdapterParams {
  pipeNominal: string;
  threadNominal: string;
  /** Между торцами A, м. */
  length: number;
}

type Layout = { pipe: PartDiameters; press: number; thread: ThreadedSize; nut: number };

/** Буртик корпуса в гайке, м: часть гайки перед резьбой (длина гайки — резьба + 4 мм). */
const COLLAR = 0.004;

/**
 * МП-соединитель пресс × накидная гайка (позиция 82) по VALTEC VTm.222 (каталог 2017, с. 50): пресс-конец слева (−X),
 * накидная гайка с внутренней резьбой справа (+X); 16 × 1/2, 20 × 3/4, 32 × 1 1/4. Углового исполнения с накидной гайкой
 * у VALTEC нет — не добавлено. Гайка — шестигранник, длина — резьба и 4 мм, условно.
 */
export class MpNutAdapterGenerator extends BaseGenerator<MpNutAdapterParams, Layout> {
  readonly id = 'mp.nut-adapter';
  readonly version = 1;
  readonly title = 'Соединитель МП пресс с накидной гайкой';
  readonly defaults: MpNutAdapterParams = { pipeNominal: '16', threadNominal: '1/2', length: 0.045 };
  readonly paramSpecs: readonly ParamSpec[] = [specs.mpNominal('pipeNominal'), specs.threadNominal('threadNominal', 'Резьба гайки'), specs.length('length', 'Длина')];

  protected override layout(p: MpNutAdapterParams): Layout {
    const pipe = MpPipeSizes.require(p.pipeNominal);
    const thread = threadedSize(p.threadNominal, 'internal');
    return { pipe, press: MpPressEnd.pressLength(pipe), thread, nut: thread.depth + 0.004 };
  }

  protected override relations(p: MpNutAdapterParams, l: Layout): ValidationError[] {
    const min = l.press + l.nut + 0.002;
    return p.length <= min ? [ParamSchema.tooShort('length', min)] : [];
  }

  protected create(p: MpNutAdapterParams, l: Layout): GeneratedModel {
    const half = p.length / 2;
    const pressStart = half - l.press;
    const nutStart = half - l.nut;
    const merger = new MaterialGroupMerger();
    merger.add(
      ...new MpPressEnd().build(l.pipe, pressStart, l.press, MpPressEnd.left),
      ...sleeves.build({ material: 'bronze', length: pressStart + nutStart, outerDiameter: l.pipe.n, innerDiameter: l.pipe.v * 0.6,
        center: { x: (nutStart - pressStart) / 2, y: 0, z: 0 } }),
      // Буртик корпуса внутри гайки перед резьбой: гайка сидит на нём, а не висит вокруг корпуса.
      ...sleeves.build({ material: 'bronze', length: COLLAR, outerDiameter: l.thread.n, innerDiameter: l.pipe.v * 0.6,
        center: { x: nutStart + COLLAR / 2, y: 0, z: 0 } }),
      ...sleeves.build({ material: 'bronze', length: l.nut, outerDiameter: l.thread.n * 1.3, innerDiameter: l.thread.n, outerSegments: 6,
        center: { x: half - l.nut / 2, y: 0, z: 0 }, materials: { outer: 'bronzeFlat', inner: 'bronzeThread' } }),
    );
    return createMeshModel({
      title: `Соединитель пресс ${p.pipeNominal} × гайка ${p.threadNominal}`,
      ...merger.merge(),
      connectors: [
        connector('pipe', ConnectorFrame.left, half, { nominal: p.pipeNominal, joint: 'mp-press', gender: 'internal', depth: l.press }),
        connector('nut', ConnectorFrame.right, half, { nominal: p.threadNominal, joint: 'thread', gender: 'internal', depth: l.thread.depth }),
      ],
    });
  }
}
