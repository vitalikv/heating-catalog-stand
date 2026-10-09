import { BaseGenerator } from '../../core/BaseGenerator';
import { connector } from '../../core/connector';
import { ConnectorFrame } from '../../core/ConnectorFrame';
import type { GeneratedModel, ParamSpec } from '../../core/contracts';
import { createMeshModel } from '../../core/MeshModel';
import { MaterialGroupMerger } from '../../geometry/MaterialGroupMerger';
import { sleeves } from '../../geometry/SleeveGeometryBuilder';
import type { SleeveShape } from '../../geometry/SleeveGeometryBuilder';
import { specs } from '../../params/specs';
import { ThreadSizes } from '../../sizes/ThreadSizes';

export interface PumpNutParams {
  /** Внутренняя резьба со стороны насоса (слева), например '1 1/4'. */
  pumpNominal: string;
  /** Внутренняя резьба со стороны трубы (справа), например '1'. */
  pipeNominal: string;
}

/** Длина гайки — 0,3 наружного диаметра резьбы, не меньше 12 мм. */
const MIN_NUT_LENGTH = 0.012;
/** Перемычка между гайками, м. */
const WEB = 0.001;
/** Толщина гайки — 0,236 n. */
const NUT_WALL = 0.236;
const HEX_SEGMENTS = 6;

/** Гайка для насоса: две шестигранные гайки с внутренней резьбой (перенос cr_gaika_nasos_1). */
export class PumpNutGenerator extends BaseGenerator<PumpNutParams> {
  readonly id = 'equipment.pump-nut';
  readonly version = 1;
  readonly title = 'Гайка для насоса';
  readonly paramSpecs: readonly ParamSpec[] = [
    specs.threadNominal('pumpNominal', 'Резьба к насосу (в)'),
    specs.threadNominal('pipeNominal', 'Резьба к трубе (в)'),
  ];
  readonly defaults: PumpNutParams = { pumpNominal: '1', pipeNominal: '3/4' };

  protected create(params: PumpNutParams): GeneratedModel {
    const d1 = ThreadSizes.require(params.pumpNominal, 'internal');
    const d2 = ThreadSizes.require(params.pipeNominal, 'internal');
    const x1 = Math.max(0.015 * d1.n * 20, MIN_NUT_LENGTH);
    const x2 = Math.max(0.015 * d2.n * 20, MIN_NUT_LENGTH);
    const at = (x: number) => ({ x, y: 0, z: 0 });
    const nut = { outerSegments: HEX_SEGMENTS, materials: { outer: 'metalFlat', inner: 'thread', start: 'metalFlat', end: 'metalFlat' } } satisfies Partial<SleeveShape>;

    const merger = new MaterialGroupMerger();
    merger.add(
      ...sleeves.build({ material: 'metal', ...nut, length: x1, outerDiameter: d1.n * (1 + NUT_WALL), innerDiameter: d1.v, center: at(-x1 / 2) }),
      // Перемычка: наружный — внутренний диаметр гайки с большим n, внутренний — меньший v − 1 мм
      ...sleeves.build({ material: 'metal', length: WEB, outerDiameter: d1.n > d2.n ? d1.v : d2.v, innerDiameter: Math.min(d1.v, d2.v) - 0.001, center: at(-WEB / 2) }),
      ...sleeves.build({ material: 'metal', ...nut, length: x2, outerDiameter: d2.n * (1 + NUT_WALL), innerDiameter: d2.v, center: at(x2 / 2) }),
    );

    // Торцы — открытые края гаек, глубина — длина гайки. В gl2 точки — в центрах гаек.
    const common = { joint: 'thread', gender: 'internal' } as const;
    return createMeshModel({
      title: `Гайка для насоса ${params.pumpNominal}(в)х${params.pipeNominal}(в)`,
      ...merger.merge(),
      connectors: [
        connector('pump', ConnectorFrame.left, x1, { depth: x1, nominal: params.pumpNominal, ...common }),
        connector('pipe', ConnectorFrame.right, x2, { depth: x2, nominal: params.pipeNominal, ...common }),
      ],
    });
  }
}
