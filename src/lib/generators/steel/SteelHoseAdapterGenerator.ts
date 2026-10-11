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

export interface SteelHoseAdapterParams {
  nominal: string;
  /** Внутренний диаметр шланга D, мм. */
  hoseNominal: string;
  /** Общая длина A, м. */
  length: number;
}

type Layout = { thread: ThreadedSize; hose: number; hex: number; barb: number };

/** Рёбер «ёлочки» на хвостовике. */
const RIBS = 4;

/**
 * Штуцер «резьба — шланг» (позиция 17) по VALTEC VTr.654 (каталог 2017, с. 80): внутренняя резьба 1/2 или 3/4
 * в шестиграннике слева, хвостовик-ёлочка под шланг D справа, A = 44 мм. Наружной резьбы и углового
 * исполнения у VALTEC нет — не добавлены. Размер шестигранника и длина ёлочки — условно.
 */
export class SteelHoseAdapterGenerator extends BaseGenerator<SteelHoseAdapterParams, Layout> {
  readonly id = 'steel.hose-adapter';
  readonly version = 1;
  readonly title = 'Штуцер под шланг';
  readonly defaults: SteelHoseAdapterParams = { nominal: '1/2', hoseNominal: '14', length: 0.044 };
  readonly paramSpecs: readonly ParamSpec[] = [specs.threadNominal('nominal', 'Резьба (в)'),
    { kind: 'choice', key: 'hoseNominal', label: 'Шланг, внутренний Ø мм', options: ['10', '12', '14', '16', '18', '20'] },
    specs.length('length', 'Длина')];

  protected override layout(p: SteelHoseAdapterParams): Layout {
    const thread = threadedSize(p.nominal, 'internal');
    const hex = armBodyDiameter(thread, 'internal') / Math.cos(Math.PI / 6);
    return { thread, hose: Number(p.hoseNominal) / 1000, hex, barb: p.length - thread.depth - 0.006 };
  }

  protected override relations(p: SteelHoseAdapterParams, d: Layout): ValidationError[] {
    const errors: ValidationError[] = [];
    if (d.barb < 0.012) errors.push(ParamSchema.tooShort('length', d.thread.depth + 0.018));
    if (d.hose * 1.04 >= d.thread.n) {
      errors.push({ code: 'incompatible', param: 'hoseNominal', message: `Шланг ${p.hoseNominal} мм не меньше резьбы ${p.nominal}` });
    }
    return errors;
  }

  protected create(p: SteelHoseAdapterParams, d: Layout): GeneratedModel {
    const half = p.length / 2;
    const hexEnd = -half + d.thread.depth + 0.006;
    const bore = d.hose * 0.65;
    const merger = new MaterialGroupMerger();
    merger.add(
      ...sleeves.build({ material: 'metal', length: d.thread.depth, outerDiameter: d.hex, innerDiameter: d.thread.n, outerSegments: 6,
        center: { x: -half + d.thread.depth / 2, y: 0, z: 0 }, materials: { outer: 'metalFlat', inner: 'thread' } }),
      ...sleeves.build({ material: 'metal', length: 0.006, outerDiameter: d.hex, innerDiameter: bore, outerSegments: 6,
        center: { x: hexEnd - 0.003, y: 0, z: 0 }, materials: { outer: 'metalFlat' } }),
    );
    for (let i = 0; i < RIBS; i++) {
      merger.add(...sleeves.build({ material: 'metal', length: d.barb / RIBS, outerDiameterStart: d.hose * 1.04, outerDiameter: d.hose * 0.92,
        innerDiameter: bore, center: { x: hexEnd + (i + 0.5) * d.barb / RIBS, y: 0, z: 0 } }));
    }
    return createMeshModel({
      title: `Штуцер ${p.nominal}(в) × шланг ${p.hoseNominal} мм`,
      ...merger.merge(),
      connectors: [
        connector('thread', ConnectorFrame.left, half, { nominal: p.nominal, joint: 'thread', gender: 'internal', depth: d.thread.depth }),
        connector('hose', ConnectorFrame.right, half, { nominal: p.hoseNominal, joint: 'hose-barb', gender: 'external', depth: d.barb }),
      ],
    });
  }
}
