import { BaseGenerator } from '../../core/BaseGenerator';
import { connector } from '../../core/connector';
import { ConnectorFrame } from '../../core/ConnectorFrame';
import type { GeneratedModel, ParamSpec } from '../../core/contracts';
import { createMeshModel } from '../../core/MeshModel';
import { MaterialGroupMerger } from '../../geometry/MaterialGroupMerger';
import type { GeometryPart } from '../../geometry/MaterialGroupMerger';
import { sleeves } from '../../geometry/SleeveGeometryBuilder';
import { gaugeHead } from '../equipment/GaugeGenerator';
import { orientParts, threadedSize } from '../ThreadedParts';
import type { ThreadedSize } from '../ThreadedParts';
import { VALVE_NUT_SCALE } from './BallValveParts';

export interface MakeUpValveParams {
  /** Резьба муфтовых концов (внутренняя): '1/2' или '3/4'. */
  nominal: string;
}

/**
 * VALTEC VT.515 (технический каталог 2017, с. 412–413), м: length — A, между торцами; below — B,
 * от оси до низа пробки фильтра; regulator — C, от оси до верха редуктора; gauge — D, от оси до верха
 * манометра. Манометр VT.TM40.T Ø41, подключение верхнее радиальное.
 */
const SIZES: Readonly<Record<string, { length: number; below: number; regulator: number; gauge: number }>> = {
  '1/2': { length: 0.097, below: 0.038, regulator: 0.058, gauge: 0.072 },
  '3/4': { length: 0.1, below: 0.041, regulator: 0.062, gauge: 0.076 },
};
const GAUGE = { diameter: 0.041, depth: 0.025, neck: 0.01 };
/**
 * Условно, по чертежу: редуктор и фильтр — на общей оси, наклонённой на 30° от вертикали, через центр
 * корпуса; редуктор вверх-вправо, колба фильтра вниз-влево — оба в пределах длины A; манометр левее центра.
 */
const INCLINE = Math.PI / 6;
const AXIS_X = 0;
const GAUGE_X = -0.022;
const REGULATOR = { diameter: 0.03, cap: 0.012 };
const FILTER = { diameter: 0.024, plug: 0.006 };

type Layout = { size: (typeof SIZES)[string]; thread: ThreadedSize };

const alongY = { x: 0, y: 0, z: Math.PI / 2 };

/**
 * Клапан подпиточный с фильтром и манометром (позиция 113) по образцу VALTEC VT.515: проход по X,
 * поток слева направо (inlet — от водопровода, outlet — в систему отопления), муфтовые концы.
 * Пробка фильтра вниз, настроечный винт редуктора вверх — монтажное положение по паспорту.
 * Корпус никелированный; манометр — общая головка прибора (циферблат вперёд, +Z).
 */
export class MakeUpValveGenerator extends BaseGenerator<MakeUpValveParams, Layout> {
  readonly id = 'valve.make-up';
  readonly version = 1;
  readonly title = 'Клапан подпиточный';
  readonly paramSpecs: readonly ParamSpec[] = [{ kind: 'choice', key: 'nominal', label: 'Резьба (в)', options: Object.keys(SIZES) }];
  readonly defaults: MakeUpValveParams = { nominal: '1/2' };

  protected override layout(p: MakeUpValveParams): Layout {
    return { size: SIZES[p.nominal], thread: threadedSize(p.nominal, 'internal') };
  }

  protected create(p: MakeUpValveParams, d: Layout): GeneratedModel {
    const { size, thread } = d;
    const half = size.length / 2;
    const merger = new MaterialGroupMerger();
    const span = (from: number, to: number) => ({ length: to - from, center: { x: (from + to) / 2, y: 0, z: 0 } });

    merger.add(
      // Муфтовые концы в шестигранниках и проход.
      ...sleeves.build({ material: 'metal', ...span(-half, -half + thread.depth), outerDiameter: thread.n * VALVE_NUT_SCALE, innerDiameter: thread.v,
        outerSegments: 6, materials: { outer: 'metalFlat', inner: 'thread' } }),
      ...sleeves.build({ material: 'metal', ...span(-half + thread.depth, half - thread.depth), outerDiameter: thread.n * 1.1, innerDiameter: thread.v }),
      ...sleeves.build({ material: 'metal', ...span(half - thread.depth, half), outerDiameter: thread.n * VALVE_NUT_SCALE, innerDiameter: thread.v,
        outerSegments: 6, materials: { outer: 'metalFlat', inner: 'thread' } }),
      ...this.regulator(size.regulator),
      ...this.filter(size.below),
      ...this.gauge(size.gauge, thread),
    );
    return createMeshModel({
      title: `Клапан подпиточный ${p.nominal}(в) с фильтром и манометром (VT.515)`,
      ...merger.merge(),
      connectors: [
        connector('inlet', ConnectorFrame.left, half, { nominal: p.nominal, joint: 'thread', gender: 'internal', depth: thread.depth }),
        connector('outlet', ConnectorFrame.right, half, { nominal: p.nominal, joint: 'thread', gender: 'internal', depth: thread.depth }),
      ],
    });
  }

  /** Редуктор вверх-вправо по наклонной оси до высоты C; сверху — гайка настройки. */
  private regulator(height: number): GeometryPart[] {
    const radius = REGULATOR.diameter / 2;
    const length = (height - radius * Math.sin(INCLINE)) / Math.cos(INCLINE);
    const parts = [
      ...sleeves.build({ material: 'metal', length: length - REGULATOR.cap, outerDiameter: REGULATOR.diameter, innerDiameter: 0,
        center: { x: (length - REGULATOR.cap) / 2, y: 0, z: 0 } }),
      ...sleeves.build({ material: 'metal', length: REGULATOR.cap, outerDiameter: REGULATOR.diameter * 0.9, innerDiameter: 0, outerSegments: 6,
        center: { x: length - REGULATOR.cap / 2, y: 0, z: 0 }, materials: { outer: 'metalFlat' } }),
    ];
    return orientParts(parts, { x: Math.sin(INCLINE), y: Math.cos(INCLINE), z: 0 }, { x: AXIS_X, y: 0, z: 0 });
  }

  /** Колба фильтра вниз-влево по той же оси до глубины B под осью; на конце — пробка. */
  private filter(depth: number): GeometryPart[] {
    const radius = FILTER.diameter / 2;
    const length = (depth - radius * Math.sin(INCLINE)) / Math.cos(INCLINE);
    const parts = [
      ...sleeves.build({ material: 'metal', length: length - FILTER.plug, outerDiameter: FILTER.diameter, innerDiameter: 0,
        center: { x: (length - FILTER.plug) / 2, y: 0, z: 0 } }),
      ...sleeves.build({ material: 'metal', length: FILTER.plug, outerDiameter: FILTER.diameter * 0.85, innerDiameter: 0, outerSegments: 6,
        center: { x: length - FILTER.plug / 2, y: 0, z: 0 }, materials: { outer: 'metalFlat' } }),
    ];
    return orientParts(parts, { x: -Math.sin(INCLINE), y: -Math.cos(INCLINE), z: 0 }, { x: AXIS_X, y: 0, z: 0 });
  }

  /** Манометр сверху: шейка от прохода, головка Ø41 циферблатом вперёд, верх — на высоте D. */
  private gauge(top: number, thread: ThreadedSize): GeometryPart[] {
    // Верх ободка (диаметр + 2 мм) — на высоте D.
    const center = top - (GAUGE.diameter + 0.002) / 2;
    const neckFrom = thread.n * 0.5;
    const neckTo = center - GAUGE.diameter / 2 + 0.002;
    const head = gaugeHead(GAUGE.diameter, GAUGE.depth, 'manometer');
    for (const { geometry } of head) geometry.translate(GAUGE_X, center, GAUGE.depth / 2);
    return [
      ...sleeves.build({ material: 'metal', length: neckTo - neckFrom, outerDiameter: GAUGE.neck, innerDiameter: 0, rotation: alongY,
        center: { x: GAUGE_X, y: (neckFrom + neckTo) / 2, z: 0 } }),
      ...head,
    ];
  }
}
