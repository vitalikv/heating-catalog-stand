import { BaseGenerator } from '../../core/BaseGenerator';
import { connector } from '../../core/connector';
import { ConnectorFrame } from '../../core/ConnectorFrame';
import type { Frame } from '../../core/ConnectorFrame';
import type { Connector, GeneratedModel, ParamSpec, ValidationError } from '../../core/contracts';
import { createMeshModel } from '../../core/MeshModel';
import { MaterialGroupMerger } from '../../geometry/MaterialGroupMerger';
import type { GeometryPart } from '../../geometry/MaterialGroupMerger';
import { sleeves } from '../../geometry/SleeveGeometryBuilder';
import { orientParts, threadedSize } from '../ThreadedParts';
import type { ThreadedSize } from '../ThreadedParts';
import { INSERT_HEIGHTS, manifoldInsert, SEAT_DEPTH } from './ManifoldInserts';
import type { ManifoldInsertKind } from './ManifoldInserts';

export interface BrassManifoldParams {
  /** Резьба магистральных концов: '1' или '1 1/4'. */
  nominal: string;
  outlets: number;
  /** Выходы: наружный евроконус 3/4 или наружная резьба outletNominal. */
  outletEnd: 'eurocone' | 'thread';
  outletNominal: string;
  /** Вставки над выходами; 'none' — гребёнка без отверстий сверху. */
  inserts: 'none' | ManifoldInsertKind;
  /** Ручка термоклапана; 'none' — посадочное место M30×1,5 под привод. */
  head: 'handle' | 'none';
  /** Магистральный конец: внутренняя резьба корпуса, наружная резьба или накидная гайка. */
  mainEnd: 'internal' | 'external' | 'nut';
  /** Порты 1/2 под воздухоотводчик (сверху) и слив (снизу) у дальнего конца. */
  endPorts: 'vent-drain' | 'none';
}

/**
 * Размеры по VALTEC VTc.594/596EMNX (каталог 2017, с. 178–179, 184), м: edge — от торца до оси
 * крайнего выхода и от дальнего торца до оси концевых портов (F, E), thread — длина резьбы
 * магистрального конца (D), rise — прибавка высот вставок. body — диаметр корпуса, условно.
 */
const SIZES: Readonly<Record<string, { body: number; edge: number; thread: number; rise: number }>> = {
  '1': { body: 0.04, edge: 0.031, thread: 0.017, rise: 0 },
  '1 1/4': { body: 0.048, edge: 0.032, thread: 0.019, rise: 0.005 },
};
/** Шаг выходов H, м — VALTEC. */
const PITCH = 0.05;
/** Выступ ниппеля выхода ниже корпуса и носик евроконуса за резьбой, м — условно. */
const OUTLET_REACH = 0.022;
const EUROCONE_TIP = 0.003;
/** Высота бобышки концевого порта над корпусом, м — условно. */
const BOSS = 0.008;
const HEAD_NOMINAL = 'M30x1.5';

type Size = (typeof SIZES)[string];
type Layout = { size: Size; length: number; bore: ThreadedSize; main: ThreadedSize; outlet: ThreadedSize; port: ThreadedSize };

const INSERT_LABELS: Readonly<Record<ManifoldInsertKind, string>> = {
  shutoff: 'краны-буксы', thermostatic: 'термоклапаны', flowmeter: 'расходомеры',
};

const span = (from: number, to: number) => ({ length: to - from, center: { x: (from + to) / 2, y: 0, z: 0 } });

/**
 * Латунный никелированный коллектор тёплого пола (позиция 102; 67 и 68 — его наборы) по образцу
 * VALTEC VTc.594/596EMNX. Ось — X, магистральный конец слева, выходы вниз (−Y), вставки вверх (+Y).
 * Длина A = 2·edge + шаг·(outlets − 1), с концевыми портами — ещё на шаг больше (VTc.594: A = 62 + 50·N).
 * Выходы и посадочные места нумеруются от магистрального конца: out-k и head-k — один контур.
 */
export class BrassManifoldGenerator extends BaseGenerator<BrassManifoldParams, Layout> {
  readonly id = 'manifold.brass';
  readonly version = 1;
  readonly title = 'Коллектор латунный';
  readonly paramSpecs: readonly ParamSpec[] = [
    { kind: 'choice', key: 'nominal', label: 'Резьба магистрали', options: Object.keys(SIZES) },
    { kind: 'integer', key: 'outlets', label: 'Выходов', min: 2, max: 12 },
    { kind: 'choice', key: 'outletEnd', label: 'Выходы', options: ['eurocone', 'thread'], optionLabels: { eurocone: 'евроконус 3/4', thread: 'резьба (н)' } },
    { kind: 'choice', key: 'outletNominal', label: 'Резьба выходов', options: ['1/2', '3/4'], when: { key: 'outletEnd', values: ['thread'] } },
    { kind: 'choice', key: 'inserts', label: 'Вставки', options: ['none', 'shutoff', 'thermostatic', 'flowmeter'],
      optionLabels: { none: 'нет', shutoff: 'краны-буксы', thermostatic: 'термоклапаны', flowmeter: 'расходомеры' } },
    { kind: 'choice', key: 'head', label: 'Термоклапан', options: ['handle', 'none'], optionLabels: { handle: 'с ручкой', none: 'под привод' },
      when: { key: 'inserts', values: ['thermostatic'] } },
    { kind: 'choice', key: 'mainEnd', label: 'Магистральный конец', options: ['internal', 'external', 'nut'],
      optionLabels: { internal: 'внутренняя', external: 'наружная', nut: 'накидная гайка' } },
    { kind: 'choice', key: 'endPorts', label: 'Концевые порты', options: ['vent-drain', 'none'], optionLabels: { 'vent-drain': 'воздух и слив', none: 'нет' } },
  ];
  readonly defaults: BrassManifoldParams = {
    nominal: '1', outlets: 3, outletEnd: 'eurocone', outletNominal: '1/2', inserts: 'none', head: 'handle', mainEnd: 'internal', endPorts: 'vent-drain',
  };

  protected override layout(p: BrassManifoldParams): Layout {
    const size = SIZES[p.nominal];
    const spans = p.outlets - 1 + (p.endPorts === 'vent-drain' ? 1 : 0);
    const external = (nominal: string) => threadedSize(nominal, 'external');
    return {
      size,
      length: 2 * size.edge + PITCH * spans,
      bore: { ...threadedSize(p.nominal, 'internal'), depth: size.thread },
      main: { ...threadedSize(p.nominal, p.mainEnd === 'external' ? 'external' : 'internal'), depth: size.thread },
      outlet: external(p.outletEnd === 'eurocone' ? '3/4' : p.outletNominal),
      port: threadedSize('1/2', 'internal'),
    };
  }

  protected override relations(p: BrassManifoldParams): ValidationError[] {
    // VALTEC выпускает настроечные клапаны с расходомерами только на гребёнках с евроконусом.
    if (p.inserts === 'flowmeter' && p.outletEnd === 'thread') {
      return [{ code: 'incompatible', param: 'inserts', message: 'Расходомеры ставятся только на коллектор с выходами под евроконус' }];
    }
    return [];
  }

  protected create(p: BrassManifoldParams, d: Layout): GeneratedModel {
    const { size, length, bore, main } = d;
    const radius = size.body / 2;
    const left = -length / 2;
    const right = length / 2;
    const outletX = (k: number) => left + size.edge + PITCH * k;
    const merger = new MaterialGroupMerger();
    const connectors: Connector[] = [];
    const body = (from: number, to: number, threaded: boolean) => sleeves.build({ material: 'metal', ...span(from, to),
      outerDiameter: size.body, innerDiameter: bore.v, materials: threaded ? { inner: 'thread' } : {} });

    // Корпус: дальний конец всегда с внутренней резьбой (под пробку), магистральный — по mainEnd.
    const mainInternal = p.mainEnd === 'internal';
    merger.add(...body(left, left + bore.depth, mainInternal), ...body(left + bore.depth, right - bore.depth, false), ...body(right - bore.depth, right, true));
    let mainFace = left;
    if (p.mainEnd === 'external') {
      mainFace = left - main.depth;
      merger.add(...sleeves.build({ material: 'metal', ...span(mainFace, left), outerDiameter: main.n, innerDiameter: main.v, materials: { outer: 'thread' } }));
    } else if (p.mainEnd === 'nut') {
      mainFace = left - main.depth;
      merger.add(...sleeves.build({ material: 'metal', ...span(mainFace, left), outerDiameter: main.n * 1.45, innerDiameter: main.v,
        outerSegments: 6, materials: { outer: 'metalFlat', inner: 'thread' } }));
    }
    connectors.push(
      connector('main', ConnectorFrame.left, { x: mainFace, y: 0, z: 0 }, { nominal: p.nominal, joint: 'thread', gender: p.mainEnd === 'external' ? 'external' : 'internal', depth: main.depth }),
      connector('end', ConnectorFrame.right, { x: right, y: 0, z: 0 }, { nominal: p.nominal, joint: 'thread', gender: 'internal', depth: bore.depth }),
    );

    const outletReach = radius + OUTLET_REACH;
    const threadEnd = p.outletEnd === 'eurocone' ? outletReach - EUROCONE_TIP : outletReach;
    for (let k = 0; k < p.outlets; k++) {
      const x = outletX(k);
      merger.add(...orientParts(this.outlet(d.outlet, radius, threadEnd, p.outletEnd === 'eurocone'), ConnectorFrame.bottom.direction, { x, y: 0, z: 0 }));
      connectors.push(connector(`out-${k + 1}`, ConnectorFrame.bottom, { x, y: -outletReach, z: 0 }, p.outletEnd === 'eurocone'
        ? { nominal: '3/4', joint: 'eurocone', gender: 'external', depth: d.outlet.depth + EUROCONE_TIP }
        : { nominal: p.outletNominal, joint: 'thread', gender: 'external', depth: d.outlet.depth }));
    }
    if (p.inserts !== 'none') {
      const kind = p.inserts;
      const handle = p.head === 'handle';
      for (let k = 0; k < p.outlets; k++) {
        merger.add(...orientParts(manifoldInsert(kind, radius, size.rise, handle), ConnectorFrame.top.direction, { x: outletX(k), y: 0, z: 0 }));
      }
      if (kind === 'thermostatic' && !handle) {
        const seat = INSERT_HEIGHTS.seat + size.rise;
        for (let k = 0; k < p.outlets; k++) {
          connectors.push(connector(`head-${k + 1}`, ConnectorFrame.top, { x: outletX(k), y: seat, z: 0 },
            { nominal: HEAD_NOMINAL, joint: 'valve-head', gender: 'external', depth: SEAT_DEPTH }));
        }
      }
    }
    if (p.endPorts === 'vent-drain') {
      const x = right - size.edge;
      for (const [id, frame] of [['vent', ConnectorFrame.top], ['drain', ConnectorFrame.bottom]] as const) {
        merger.add(...orientParts(this.boss(d.port, radius), frame.direction, { x, y: 0, z: 0 }));
        connectors.push(this.portAt(id, frame, x, radius + BOSS, d.port));
      }
    }
    return createMeshModel({ title: this.label(p), ...merger.merge(), connectors });
  }

  /** Ниппель выхода по +X: шестигранник у корпуса, шейка, наружная резьба, у евроконуса — носик. */
  private outlet(size: ThreadedSize, radius: number, threadEnd: number, eurocone: boolean): GeometryPart[] {
    const threadStart = threadEnd - size.depth;
    const parts = [
      ...sleeves.build({ material: 'metal', ...span(radius - 0.003, threadStart), outerDiameter: size.n + 0.004, innerDiameter: size.v }),
      ...sleeves.build({ material: 'metal', ...span(radius - 0.001, radius + 0.007), outerDiameter: size.n * 1.25, innerDiameter: size.v,
        outerSegments: 6, materials: { outer: 'metalFlat' } }),
      ...sleeves.build({ material: 'metal', ...span(threadStart, threadEnd), outerDiameter: size.n, innerDiameter: size.v, materials: { outer: 'thread' } }),
    ];
    if (eurocone) {
      parts.push(...sleeves.build({ material: 'metal', ...span(threadEnd, threadEnd + EUROCONE_TIP), outerDiameterStart: size.n,
        outerDiameter: size.v, innerDiameter: size.v * 0.8 }));
    }
    return parts;
  }

  /** Бобышка концевого порта по +X с внутренней резьбой 1/2. */
  private boss(size: ThreadedSize, radius: number): GeometryPart[] {
    const top = radius + BOSS;
    const outer = size.n * 1.15;
    return [
      ...sleeves.build({ material: 'metal', ...span(radius - 0.003, top - size.depth), outerDiameter: outer, innerDiameter: size.v }),
      ...sleeves.build({ material: 'metal', ...span(top - size.depth, top), outerDiameter: outer, innerDiameter: size.v, materials: { inner: 'thread' } }),
    ];
  }

  private portAt(id: string, frame: Frame, x: number, distance: number, size: ThreadedSize): Connector {
    return connector(id, frame, { x, y: frame.direction.y * distance, z: 0 }, { nominal: '1/2', joint: 'thread', gender: 'internal', depth: size.depth });
  }

  private label(p: BrassManifoldParams): string {
    const outlets = p.outletEnd === 'eurocone' ? 'евроконус 3/4' : `резьба ${p.outletNominal}(н)`;
    let inserts = p.inserts === 'none' ? '' : `, ${INSERT_LABELS[p.inserts]}`;
    if (p.inserts === 'thermostatic' && p.head === 'none') inserts += ' под привод';
    return `Коллектор ${p.nominal} × ${p.outlets}, ${outlets}${inserts}`;
  }
}
