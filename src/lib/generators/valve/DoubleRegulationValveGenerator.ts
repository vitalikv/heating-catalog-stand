import { BaseGenerator } from '../../core/BaseGenerator';
import { connector } from '../../core/connector';
import { ConnectorFrame } from '../../core/ConnectorFrame';
import type { GeneratedModel, ParamSpec, ValidationError } from '../../core/contracts';
import { createMeshModel } from '../../core/MeshModel';
import { MaterialGroupMerger } from '../../geometry/MaterialGroupMerger';
import { sleeves } from '../../geometry/SleeveGeometryBuilder';
import { ParamSchema } from '../../params/ParamSchema';
import { specs } from '../../params/specs';
import { armBodyDiameter, orientParts, threadedArm, threadedSize } from '../ThreadedParts';
import type { ThreadedSize } from '../ThreadedParts';
import { radiatorHandle } from './RadiatorValveParts';

export interface DoubleRegulationValveParams {
  nominal: string;
  /** Между торцами, A по каталогу. */
  length: number;
  /** От низа корпуса до верха ручки, H по каталогу. */
  height: number;
}

type Layout = { thread: ThreadedSize; body: number };

/** Крышка корпуса (шестигранник) и шейка под ручкой, м — условно. */
const BONNET = { neck: 0.012, height: 0.01 };
/** Высота ручки над крышкой не меньше этой, м. */
const MIN_HANDLE = 0.015;

/**
 * Кран радиаторный двойной регулировки (КРДП, позиция 99) по VALTEC VT.004 (технический каталог 2017,
 * с. 523–524): прямой, муфтовый В–В, монтажная настройка пробкой и пользовательская — шибером с ручкой.
 * Ручка вверх (+Y), проход по X. Полусгона и евроконусного исполнения у VT.004 нет.
 */
export class DoubleRegulationValveGenerator extends BaseGenerator<DoubleRegulationValveParams, Layout> {
  readonly id = 'valve.double-regulation';
  readonly version = 1;
  readonly title = 'Кран радиаторный двойной регулировки';
  readonly defaults: DoubleRegulationValveParams = { nominal: '1/2', length: 0.052, height: 0.082 };
  readonly paramSpecs: readonly ParamSpec[] = [specs.threadNominal('nominal', 'Резьба'), specs.length('length', 'Длина'),
    specs.length('height', 'Высота')];

  protected override layout(p: DoubleRegulationValveParams): Layout {
    const thread = threadedSize(p.nominal, 'internal');
    return { thread, body: armBodyDiameter(thread, 'internal') };
  }

  protected override relations(p: DoubleRegulationValveParams, d: Layout): ValidationError[] {
    const errors: ValidationError[] = [];
    const length = 2 * d.thread.depth + d.body;
    if (p.length <= length) errors.push(ParamSchema.tooShort('length', length));
    const height = d.body + BONNET.neck + BONNET.height + MIN_HANDLE;
    if (p.height <= height) errors.push(ParamSchema.tooShort('height', height));
    return errors;
  }

  protected create(p: DoubleRegulationValveParams, d: Layout): GeneratedModel {
    const half = p.length / 2;
    const top = p.height - d.body / 2;
    const neckTop = d.body / 2 + BONNET.neck;
    const bonnetTop = neckTop + BONNET.height;
    const merger = new MaterialGroupMerger();
    merger.add(...threadedArm(d.thread, 'internal', half), ...orientParts(threadedArm(d.thread, 'internal', half), ConnectorFrame.left.direction),
      ...orientParts([
        ...sleeves.build({ material: 'metal', length: neckTop, outerDiameter: d.body, innerDiameter: 0, center: { x: neckTop / 2, y: 0, z: 0 } }),
        ...sleeves.build({ material: 'metal', length: BONNET.height, outerDiameter: d.body * 1.1, innerDiameter: 0, outerSegments: 6,
          center: { x: neckTop + BONNET.height / 2, y: 0, z: 0 }, materials: { outer: 'metalFlat' } }),
        ...radiatorHandle(bonnetTop, top, Math.max(0.03, d.body * 1.2)),
      ], ConnectorFrame.top.direction));
    const port = { nominal: p.nominal, joint: 'thread', gender: 'internal', depth: d.thread.depth } as const;
    return createMeshModel({
      title: `Кран двойной регулировки ${p.nominal}`,
      ...merger.merge(),
      connectors: [connector('left', ConnectorFrame.left, half, port), connector('right', ConnectorFrame.right, half, port)],
    });
  }
}
