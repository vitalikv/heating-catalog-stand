import { BaseGenerator } from '../../core/BaseGenerator';
import { connector } from '../../core/connector';
import { ConnectorFrame } from '../../core/ConnectorFrame';
import type { Connector, GeneratedModel, ParamSpec } from '../../core/contracts';
import { createMeshModel } from '../../core/MeshModel';
import { shapes } from '../../geometry/ExtrudedShapeBuilder';
import { MaterialGroupMerger } from '../../geometry/MaterialGroupMerger';
import type { GeometryPart } from '../../geometry/MaterialGroupMerger';
import { sleeves } from '../../geometry/SleeveGeometryBuilder';
import { threadedSize } from '../ThreadedParts';
import type { ThreadedSize } from '../ThreadedParts';

export interface FlushFilterParams {
  /** Резьба концов (внутренняя): '1/2', '3/4' или '1'. */
  nominal: string;
  /** Манометр на порту 1/4 сверху (комплект VALTEC) или свободный порт. */
  gauge: 'manometer' | 'none';
}

/**
 * VALTEC VT.389 (технический каталог 2017, с. 346–347), м: length — C, между торцами;
 * bowl — A, от верха корпуса до низа колбы. B − A = 110 мм у всех размеров: манометр сверху
 * и сливной кран со штуцером снизу одинаковы — делятся на GAUGE_STACK и DRAIN_STACK по чертежу.
 */
const SIZES: Readonly<Record<string, { length: number; bowl: number }>> = {
  '1/2': { length: 0.054, bowl: 0.091 },
  '3/4': { length: 0.066, bowl: 0.115 },
  '1': { length: 0.078, bowl: 0.149 },
};
const GAUGE_STACK = 0.06;
const DRAIN_STACK = 0.05;
/** Манометр: диаметр циферблата, глубина корпуса, шейка до корпуса — условно. */
const GAUGE = { diameter: 0.05, depth: 0.02, neck: 0.01 };
/** Сливной кран: корпус крана и штуцер под шланг 14 мм (VALTEC: штуцер 14 мм), м — условно. */
const DRAIN = { valve: 0.025, body: 0.022, barb: 0.014 };
/** Ручка-бабочка крана: вылет штока от оси, толщина лопастей, ступица — условно. */
const HANDLE = { reach: 0.019, plate: 0.003, hub: 0.007 };
/** Лопасти бабочки в плоскости поперёк штока: размах 24 мм, у концов шире, к ступице уже. */
const BUTTERFLY: readonly [number, number][] = [
  [-0.012, -0.004], [-0.003, -0.002], [0.003, -0.002], [0.012, -0.004],
  [0.012, 0.004], [0.003, 0.002], [-0.003, 0.002], [-0.012, 0.004],
];
/** Верх корпуса над осью — к наружному диаметру резьбы; голова и колба — к длине C (условно). */
const TOP_RATIO = 0.7;
const HEAD_SHARE = 0.6;
const BOWL_SHARE = 0.58;
const NUT_SCALE = 1.236;
const HOSE_NOMINAL = '14';

type Layout = { size: (typeof SIZES)[string]; thread: ThreadedSize; gaugeThread: ThreadedSize; top: number };

const alongY = { x: 0, y: 0, z: Math.PI / 2 };
const spanX = (from: number, to: number) => ({ length: to - from, center: { x: (from + to) / 2, y: 0, z: 0 } });
const spanY = (from: number, to: number, x = 0) => ({ length: to - from, center: { x, y: (from + to) / 2, z: 0 }, rotation: alongY });

/**
 * Промывной каскадный фильтр (позиция 121) по образцу VALTEC VT.389: проход по X (вход слева),
 * колба вниз, сверху порт 1/4 под манометр, снизу сливной шаровой кран со штуцером под шланг.
 * Длина C и высота A — по таблице VALTEC; диаметры корпуса и колбы — условно.
 * Слив — свободная граница (шланг), место обслуживания — под колбой на высоту крана.
 */
export class FlushFilterGenerator extends BaseGenerator<FlushFilterParams, Layout> {
  readonly id = 'equipment.flush-filter';
  readonly version = 1;
  readonly title = 'Фильтр промывной';
  readonly paramSpecs: readonly ParamSpec[] = [
    { kind: 'choice', key: 'nominal', label: 'Резьба (в)', options: Object.keys(SIZES) },
    { kind: 'choice', key: 'gauge', label: 'Манометр', options: ['manometer', 'none'], optionLabels: { manometer: 'есть', none: 'нет, порт 1/4' } },
  ];
  readonly defaults: FlushFilterParams = { nominal: '1/2', gauge: 'manometer' };

  protected override layout(p: FlushFilterParams): Layout {
    const thread = threadedSize(p.nominal, 'internal');
    return { size: SIZES[p.nominal], thread, gaugeThread: threadedSize('1/4', 'internal'), top: thread.n * TOP_RATIO };
  }

  protected create(p: FlushFilterParams, d: Layout): GeneratedModel {
    const { size, thread, top } = d;
    const half = size.length / 2;
    const bowlBottom = top - size.bowl;
    const head = size.length * HEAD_SHARE;
    const merger = new MaterialGroupMerger();
    const connectors: Connector[] = [];

    // Концы с внутренней резьбой в шестигранниках, проход и голова корпуса.
    merger.add(
      ...sleeves.build({ material: 'metal', ...spanX(-half, -half + thread.depth), outerDiameter: thread.n * NUT_SCALE, innerDiameter: thread.v,
        outerSegments: 6, materials: { outer: 'metalFlat', inner: 'thread' } }),
      ...sleeves.build({ material: 'metal', ...spanX(-half + thread.depth, half - thread.depth), outerDiameter: thread.n, innerDiameter: thread.v }),
      ...sleeves.build({ material: 'metal', ...spanX(half - thread.depth, half), outerDiameter: thread.n * NUT_SCALE, innerDiameter: thread.v,
        outerSegments: 6, materials: { outer: 'metalFlat', inner: 'thread' } }),
      ...sleeves.build({ material: 'metal', ...spanY(-thread.n / 2, top), outerDiameter: head, innerDiameter: 0 }),
      // Кольцо колбы под головой и колба до низа A.
      ...sleeves.build({ material: 'metal', ...spanY(-thread.n / 2 - 0.01, -thread.n / 2), outerDiameter: size.length * 0.75, innerDiameter: 0,
        outerSegments: 24, materials: { outer: 'metalFlat' } }),
      ...sleeves.build({ material: 'metal', ...spanY(bowlBottom, -thread.n / 2 - 0.01), outerDiameter: size.length * BOWL_SHARE, innerDiameter: 0 }),
      ...this.drain(bowlBottom),
    );
    connectors.push(connector('drain', ConnectorFrame.bottom, { x: 0, y: bowlBottom - DRAIN_STACK, z: 0 },
      { nominal: HOSE_NOMINAL, joint: 'hose-barb', gender: 'external', depth: DRAIN_STACK - DRAIN.valve }));

    // Порт манометра 1/4 сверху; с манометром — шейка и корпус с циферблатом вперёд (+Z).
    const gauge = d.gaugeThread;
    const boss = top + gauge.depth;
    merger.add(...sleeves.build({ material: 'metal', ...spanY(top - 0.002, boss), outerDiameter: gauge.n * 1.4, innerDiameter: gauge.v,
      materials: { inner: 'thread' } }));
    if (p.gauge === 'manometer') {
      merger.add(...this.manometer(boss, top + GAUGE_STACK));
    } else {
      connectors.push(connector('gauge', ConnectorFrame.top, { x: 0, y: boss, z: 0 }, { nominal: '1/4', joint: 'thread', gender: 'internal', depth: gauge.depth }));
    }

    return createMeshModel({
      title: `Фильтр промывной ${p.nominal}(в-в)${p.gauge === 'manometer' ? ' с манометром' : ''}`,
      ...merger.merge(),
      connectors: [
        connector('left', ConnectorFrame.left, half, { nominal: p.nominal, joint: 'thread', gender: 'internal', depth: thread.depth }),
        connector('right', ConnectorFrame.right, half, { nominal: p.nominal, joint: 'thread', gender: 'internal', depth: thread.depth }),
        ...connectors,
      ],
    });
  }

  /**
   * Сливной шаровой кран под колбой: корпус, шток слева (−X) с красной ручкой-бабочкой,
   * штуцер под шланг вниз. Шток начинается внутри корпуса, ручка сидит на его конце.
   */
  private drain(bowlBottom: number): GeometryPart[] {
    const valveBottom = bowlBottom - DRAIN.valve;
    const hoseEnd = bowlBottom - DRAIN_STACK;
    const stemY = valveBottom + DRAIN.valve / 2;
    const plateStart = -HANDLE.reach - HANDLE.plate;
    return [
      ...sleeves.build({ material: 'metal', ...spanY(valveBottom, bowlBottom), outerDiameter: DRAIN.body, innerDiameter: 0, outerSegments: 6,
        materials: { outer: 'metalFlat' } }),
      ...sleeves.build({ material: 'metal', length: HANDLE.reach - 0.004, outerDiameter: 0.006, innerDiameter: 0,
        center: { x: -(HANDLE.reach + 0.004) / 2, y: stemY, z: 0 } }),
      // Ступица и лопасти: контур в плоскости YZ, выдавлен по штоку (поворот вокруг Y переводит Z контура в X).
      ...sleeves.build({ material: 'red', length: HANDLE.plate + 0.002, outerDiameter: HANDLE.hub, innerDiameter: 0,
        center: { x: plateStart + (HANDLE.plate + 0.002) / 2, y: stemY, z: 0 } }),
      shapes.build({ material: 'red', points: BUTTERFLY.map(([z, y]) => ({ x: z, y })), depth: HANDLE.plate,
        rotation: { x: 0, y: Math.PI / 2, z: 0 }, position: { x: plateStart, y: stemY, z: 0 } }),
      // Штуцер с ершами: каждый конус сужается к свободному концу (вниз) — шланг надевается снизу и не соскакивает.
      ...[0, 1, 2].flatMap((i) => {
        const third = (valveBottom - hoseEnd) / 3;
        const from = valveBottom - third * (i + 1);
        return sleeves.build({ material: 'bronze', ...spanY(from, from + third), outerDiameterStart: DRAIN.barb * 0.9, outerDiameter: DRAIN.barb * 1.15,
          innerDiameter: DRAIN.barb * 0.6 });
      }),
    ];
  }

  /** Манометр: шейка над портом и корпус с циферблатом, повёрнутым вперёд (+Z). */
  private manometer(from: number, top: number): GeometryPart[] {
    const center = top - GAUGE.diameter / 2;
    const facing = { x: 0, y: -Math.PI / 2, z: 0 };
    return [
      ...sleeves.build({ material: 'bronze', ...spanY(from, center - GAUGE.diameter / 2 + 0.002), outerDiameter: 0.012, innerDiameter: 0, outerSegments: 6,
        materials: { outer: 'bronzeFlat' } }),
      ...sleeves.build({ material: 'metal', length: GAUGE.depth, outerDiameter: GAUGE.diameter, innerDiameter: GAUGE.diameter * 0.9, rotation: facing,
        center: { x: 0, y: center, z: 0 } }),
      ...sleeves.build({ material: 'manometer', length: 0.001, outerDiameter: GAUGE.diameter * 0.9, innerDiameter: 0, rotation: facing,
        center: { x: 0, y: center, z: GAUGE.depth / 2 - 0.004 } }),
      ...sleeves.build({ material: 'blackFlat', length: 0.001, outerDiameter: GAUGE.diameter * 0.9, innerDiameter: 0, rotation: facing,
        center: { x: 0, y: center, z: -GAUGE.depth / 2 } }),
    ];
  }
}
