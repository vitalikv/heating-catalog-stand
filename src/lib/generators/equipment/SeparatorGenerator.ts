import { BaseGenerator } from '../../core/BaseGenerator';
import { connector } from '../../core/connector';
import { ConnectorFrame } from '../../core/ConnectorFrame';
import type { GeneratedModel, ParamSpec } from '../../core/contracts';
import { createMeshModel } from '../../core/MeshModel';
import { MaterialGroupMerger } from '../../geometry/MaterialGroupMerger';
import type { GeometryPart } from '../../geometry/MaterialGroupMerger';
import { sleeves } from '../../geometry/SleeveGeometryBuilder';
import { threadedSize } from '../ThreadedParts';
import type { ThreadedSize } from '../ThreadedParts';

export type SeparatorKind = 'magnetic' | 'air' | 'combined';

export interface SeparatorParams {
  /** Грязеуловитель магнитный (77), сепаратор воздуха (78), грязе- и воздухоотделитель (122). */
  kind: SeparatorKind;
  /** Резьба концов: '3/4', '1' или '1 1/4'. */
  nominal: string;
  /** Концы: внутренняя резьба или накидные гайки (внутренняя резьба гайки). */
  ends: 'internal' | 'union';
}

/**
 * Условные размеры, м (изделий в каталогах VALTEC нет): length — между торцами при внутренней
 * резьбе, chamber — диаметр камеры, sump — камера под осью у грязеуловителя, below — у сепаратора
 * воздуха. Накидные гайки удлиняют прибор на UNION_EXTRA с каждой стороны.
 */
const SIZES: Readonly<Record<string, { length: number; chamber: number; sump: number; below: number }>> = {
  '3/4': { length: 0.1, chamber: 0.06, sump: 0.11, below: 0.06 },
  '1': { length: 0.11, chamber: 0.066, sump: 0.12, below: 0.065 },
  '1 1/4': { length: 0.125, chamber: 0.076, sump: 0.13, below: 0.075 },
};
const UNION_EXTRA = 0.018;
/** Крышка камеры, встроенный автоматический воздухоотводчик над ней, магнит на колбе — условно. */
const CAP = 0.012;
const VENT = { body: 0.028, height: 0.038, cap: 0.032, capHeight: 0.014 };
const MAGNET = { height: 0.03, thickness: 0.006 };
const NUT_SCALE = 1.236;
const DRAIN_NOMINAL = '1/2';

type Layout = { size: (typeof SIZES)[string]; thread: ThreadedSize; drain: ThreadedSize; half: number };

const alongY = { x: 0, y: 0, z: Math.PI / 2 };
const spanX = (from: number, to: number) => ({ length: to - from, center: { x: (from + to) / 2, y: 0, z: 0 } });
const spanY = (from: number, to: number) => ({ length: to - from, center: { x: 0, y: (from + to) / 2, z: 0 }, rotation: alongY });

const TITLES: Readonly<Record<SeparatorKind, string>> = {
  magnetic: 'Грязеуловитель магнитный', air: 'Сепаратор воздуха', combined: 'Грязе- и воздухоотделитель',
};

/**
 * Проточный отделитель для котельной (позиции 77, 78, 122) на общем латунном корпусе:
 * проход по X, вертикальная камера по оси. У грязеуловителя — глубокая камера-отстойник с магнитом
 * снаружи, у сепаратора воздуха — встроенный автоматический воздухоотводчик сверху,
 * у комбинированного — то и другое (один корпус, не два прибора подряд). Внизу у всех — порт слива
 * G1/2 (внутренняя) под сливной кран; выпуск воздухоотводчика — свободная граница.
 * Направление потока не задаётся: корпус симметричен. Размеры условные.
 */
export class SeparatorGenerator extends BaseGenerator<SeparatorParams, Layout> {
  readonly id = 'equipment.separator';
  readonly version = 1;
  readonly title = 'Отделитель шлама и воздуха';
  readonly paramSpecs: readonly ParamSpec[] = [
    { kind: 'choice', key: 'kind', label: 'Назначение', options: ['magnetic', 'air', 'combined'],
      optionLabels: { magnetic: 'грязеуловитель магнитный', air: 'сепаратор воздуха', combined: 'грязе- и воздухоотделитель' } },
    { kind: 'choice', key: 'nominal', label: 'Резьба (в)', options: Object.keys(SIZES) },
    { kind: 'choice', key: 'ends', label: 'Концы', options: ['internal', 'union'], optionLabels: { internal: 'внутренняя резьба', union: 'накидные гайки' } },
  ];
  readonly defaults: SeparatorParams = { kind: 'magnetic', nominal: '3/4', ends: 'internal' };

  protected override layout(p: SeparatorParams): Layout {
    const size = SIZES[p.nominal];
    return { size, thread: threadedSize(p.nominal, 'internal'), drain: threadedSize(DRAIN_NOMINAL, 'internal'),
      half: size.length / 2 + (p.ends === 'union' ? UNION_EXTRA : 0) };
  }

  protected create(p: SeparatorParams, d: Layout): GeneratedModel {
    const { size, thread, drain, half } = d;
    const sludge = p.kind !== 'air';
    const vent = p.kind !== 'magnetic';
    const top = size.chamber / 2 + CAP;
    const bottom = -(sludge ? size.sump : size.below);
    const merger = new MaterialGroupMerger();

    merger.add(
      // Камера и крышка; проход между камерой и концами.
      ...sleeves.build({ material: 'bronze', ...spanY(bottom + drain.depth, top - CAP), outerDiameter: size.chamber, innerDiameter: 0 }),
      ...sleeves.build({ material: 'bronze', ...spanY(top - CAP, top), outerDiameter: size.chamber * 0.9, innerDiameter: 0, outerSegments: 8,
        materials: { outer: 'bronzeFlat' } }),
      ...sleeves.build({ material: 'bronze', ...spanX(-half + thread.depth, half - thread.depth), outerDiameter: thread.n * 1.05, innerDiameter: thread.v }),
      // Низ камеры — шейка с внутренней резьбой слива.
      ...sleeves.build({ material: 'bronze', ...spanY(bottom, bottom + drain.depth), outerDiameter: drain.n * 1.4, innerDiameter: drain.v,
        outerSegments: 6, materials: { outer: 'bronzeFlat', inner: 'bronzeThread' } }),
      ...this.end(-1, half, thread, p.ends),
      ...this.end(1, half, thread, p.ends),
    );
    if (sludge) {
      // Магнит — кольцо на колбе отстойника, ниже прохода.
      const from = bottom + drain.depth + 0.01;
      merger.add(...sleeves.build({ material: 'black', ...spanY(from, from + MAGNET.height), outerDiameter: size.chamber + 2 * MAGNET.thickness,
        innerDiameter: size.chamber }));
    }
    if (vent) {
      merger.add(
        ...sleeves.build({ material: 'bronze', ...spanY(top, top + VENT.height), outerDiameter: VENT.body, innerDiameter: 0 }),
        ...sleeves.build({ material: 'black', ...spanY(top + VENT.height, top + VENT.height + VENT.capHeight), outerDiameter: VENT.cap, innerDiameter: 0,
          outerSegments: 12, materials: { outer: 'blackFlat' } }),
      );
    }

    const ends = p.ends === 'union' ? ', накидные гайки' : '(в-в)';
    return createMeshModel({
      title: `${TITLES[p.kind]} ${p.nominal}${ends}`,
      ...merger.merge(),
      connectors: [
        connector('left', ConnectorFrame.left, half, { nominal: p.nominal, joint: 'thread', gender: 'internal', depth: thread.depth }),
        connector('right', ConnectorFrame.right, half, { nominal: p.nominal, joint: 'thread', gender: 'internal', depth: thread.depth }),
        connector('drain', ConnectorFrame.bottom, { x: 0, y: bottom, z: 0 }, { nominal: DRAIN_NOMINAL, joint: 'thread', gender: 'internal', depth: drain.depth }),
      ],
    });
  }

  /**
   * Конец со стороны sign: шестигранник с внутренней резьбой у торца. Накидная гайка — шестигранник
   * крупнее и длиннее резьбы, с кольцом, которым она держится за хвостовик корпуса.
   */
  private end(sign: -1 | 1, half: number, thread: ThreadedSize, ends: SeparatorParams['ends']): GeometryPart[] {
    const span = (a: number, b: number) => spanX(Math.min(sign * a, sign * b), Math.max(sign * a, sign * b));
    if (ends === 'internal') {
      return sleeves.build({ material: 'bronze', ...span(half - thread.depth, half), outerDiameter: thread.n * NUT_SCALE, innerDiameter: thread.v,
        outerSegments: 6, materials: { outer: 'bronzeFlat', inner: 'bronzeThread' } });
    }
    const ring = 0.003;
    return [
      ...sleeves.build({ material: 'bronze', ...span(half - thread.depth, half), outerDiameter: thread.n * 1.5, innerDiameter: thread.v,
        outerSegments: 6, materials: { outer: 'bronzeFlat', inner: 'bronzeThread' } }),
      ...sleeves.build({ material: 'bronze', ...span(half - thread.depth - ring, half - thread.depth), outerDiameter: thread.n * 1.5, innerDiameter: thread.n * 1.05,
        outerSegments: 6, materials: { outer: 'bronzeFlat' } }),
    ];
  }
}
