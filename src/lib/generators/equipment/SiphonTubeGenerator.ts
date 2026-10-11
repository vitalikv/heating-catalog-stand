import { BaseGenerator } from '../../core/BaseGenerator';
import { connector } from '../../core/connector';
import { ConnectorFrame } from '../../core/ConnectorFrame';
import type { GeneratedModel, ParamSpec, ValidationError, Vector3Data } from '../../core/contracts';
import { createMeshModel } from '../../core/MeshModel';
import { MaterialGroupMerger } from '../../geometry/MaterialGroupMerger';
import { PipePathBuilder } from '../../geometry/PipePathBuilder';
import { sleeves } from '../../geometry/SleeveGeometryBuilder';
import { ParamSchema } from '../../params/ParamSchema';
import { threadedSize } from '../ThreadedParts';
import type { ThreadedSize } from '../ThreadedParts';

export interface SiphonTubeParams {
  /** Резьба обоих концов (Dn): штуцер с наружной резьбой к трубопроводу, накидная гайка к прибору. */
  nominal: '1/4' | '3/8' | '1/2';
  /** Расстояние между торцами H, м. */
  length: number;
  /** Наружный диаметр петли D, м. */
  loopDiameter: number;
}
type Layout = { thread: ThreadedSize; nut: ThreadedSize };

/** Трубка: медная никелированная, наружный диаметр и стенка — условно. */
const TUBE = 0.01;
/** Сдвиг витка по Z: соседние прямые участки расходятся больше чем на диаметр трубки. */
const PITCH = TUBE * 1.2;
/** Концевые фитинги: шестигранник и шейка до трубки, м (условно). */
const HEX = 0.008;
const NECK = 0.006;

/**
 * Трубка демпферная (сифонная) для манометра (позиция 92) по Officine Rigamonti OR.1809 (технический каталог 2017,
 * с. 659: H = 157 / 164 / 167 мм, D = 62 мм для 1/4, 3/8, 1/2). Прямая трубка по X с одним витком петли вниз;
 * виток смещён по Z чуть больше диаметра трубки, поэтому торец прибора стоит на PITCH дальше по Z, чем торец трубопровода.
 * Слева — штуцер с наружной резьбой (process, к бобышке или крану), справа — накидная гайка (gauge, к прибору
 * или крану VT.806). Порядок по каталогу VALTEC: трубопровод → трубка → кран → манометр.
 */
export class SiphonTubeGenerator extends BaseGenerator<SiphonTubeParams, Layout> {
  readonly id = 'equipment.siphon-tube';
  readonly version = 1;
  readonly title = 'Трубка демпферная';
  readonly paramSpecs: readonly ParamSpec[] = [
    { kind: 'choice', key: 'nominal', label: 'Резьба Dn', options: ['1/4', '3/8', '1/2'] },
    { kind: 'length', key: 'length', label: 'Длина H', min: 0.1, max: 0.3, step: 0.001 },
    { kind: 'length', key: 'loopDiameter', label: 'Петля D', min: 0.04, max: 0.1, step: 0.001 },
  ];
  readonly defaults: SiphonTubeParams = { nominal: '1/2', length: 0.167, loopDiameter: 0.062 };

  protected override layout(p: SiphonTubeParams): Layout {
    return { thread: threadedSize(p.nominal, 'external'), nut: threadedSize(p.nominal, 'internal') };
  }

  /** Петля и оба фитинга с прямыми участками трубки помещаются между торцами. */
  protected override relations(p: SiphonTubeParams, d: Layout): ValidationError[] {
    const minimum = this.fittingLength(d.thread) + this.fittingLength(d.nut) + p.loopDiameter + 0.02;
    return p.length <= minimum ? [ParamSchema.tooShort('length', minimum)] : [];
  }

  protected create(p: SiphonTubeParams, d: Layout): GeneratedModel {
    const half = p.length / 2;
    const radius = (p.loopDiameter - TUBE) / 2;
    const left = -half + this.fittingLength(d.thread);
    const right = half - this.fittingLength(d.nut);
    // Виток: описанный квадрат петли со скруглениями радиуса radius — окружность, сдвинутая по Z на PITCH.
    const path: Vector3Data[] = [
      { x: left, y: 0, z: 0 },
      { x: radius, y: 0, z: 0 },
      { x: radius, y: -2 * radius, z: PITCH / 3 },
      { x: -radius, y: -2 * radius, z: (2 * PITCH) / 3 },
      { x: -radius, y: 0, z: PITCH },
      { x: right, y: 0, z: PITCH },
    ];
    const tube = PipePathBuilder.build(path, radius, TUBE);
    const span = (from: number, to: number, z = 0) => ({ length: to - from, center: { x: (from + to) / 2, y: 0, z } });

    const merger = new MaterialGroupMerger();
    merger.add(
      { geometry: tube.geometry, material: 'metal' },
      // Штуцер к трубопроводу: резьба, шестигранник, шейка на трубку.
      ...sleeves.build({ material: 'metal', ...span(-half, -half + d.thread.depth), outerDiameter: d.thread.n, innerDiameter: TUBE * 0.4,
        materials: { outer: 'thread' } }),
      ...sleeves.build({ material: 'metal', ...span(-half + d.thread.depth, -half + d.thread.depth + HEX), outerDiameter: d.thread.n * 1.4,
        innerDiameter: TUBE * 0.4, outerSegments: 6, materials: { outer: 'metalFlat' } }),
      ...sleeves.build({ material: 'metal', ...span(-half + d.thread.depth + HEX, left), outerDiameter: TUBE + 0.003, innerDiameter: TUBE * 0.4 }),
      // К прибору: шейка, накидная гайка с внутренней резьбой.
      ...sleeves.build({ material: 'metal', ...span(right, half - d.nut.depth, PITCH), outerDiameter: TUBE + 0.003, innerDiameter: TUBE * 0.4 }),
      ...sleeves.build({ material: 'metal', ...span(half - d.nut.depth, half, PITCH), outerDiameter: d.nut.n * 1.3, innerDiameter: d.nut.v,
        outerSegments: 6, materials: { outer: 'metalFlat', inner: 'thread' } }),
    );
    return createMeshModel({
      title: `Трубка демпферная G${p.nominal}, ${Math.round(p.length * 1000)} мм`,
      ...merger.merge(),
      connectors: [
        connector('process', ConnectorFrame.left, { x: -half, y: 0, z: 0 }, { nominal: p.nominal, joint: 'thread', gender: 'external', depth: d.thread.depth }),
        connector('gauge', ConnectorFrame.right, { x: half, y: 0, z: PITCH }, { nominal: p.nominal, joint: 'thread', gender: 'internal', depth: d.nut.depth }),
      ],
    });
  }

  /** Фитинг конца с шейкой до начала трубки. */
  private fittingLength(size: ThreadedSize): number {
    return size.depth + HEX + NECK;
  }
}
