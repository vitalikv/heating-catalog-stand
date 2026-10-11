import { BaseGenerator } from '../../core/BaseGenerator';
import { connector } from '../../core/connector';
import { ConnectorFrame } from '../../core/ConnectorFrame';
import type { Frame } from '../../core/ConnectorFrame';
import type { GeneratedModel, ParamSpec } from '../../core/contracts';
import { createMeshModel } from '../../core/MeshModel';
import { shapes } from '../../geometry/ExtrudedShapeBuilder';
import { MaterialGroupMerger } from '../../geometry/MaterialGroupMerger';
import type { GeometryPart } from '../../geometry/MaterialGroupMerger';
import { sleeves } from '../../geometry/SleeveGeometryBuilder';
import { orientParts, threadedSize } from '../ThreadedParts';
import type { ThreadedSize } from '../ThreadedParts';
import { VALVE_NUT_SCALE } from './BallValveParts';

export interface MixingValveParams {
  /** Число ходов: 3 — VALTEC VT.MIX03, 4 — VT.MIX04. Корпус и размеры общие. */
  ways: 3 | 4;
  /** Внутренняя резьба всех ходов: '3/4', '1' или '1 1/4'. */
  nominal: string;
  /** Рукоятка ручного управления на штоке или свободный шток под сервопривод. */
  control: 'handle' | 'none';
}

/**
 * VALTEC VT.MIX03 / VT.MIX04 (технический каталог 2017, с. 371, 375), м: length — A, между торцами
 * противоположных ходов (все ходы на A/2 от оси штока); depth — D, от тыльной стороны корпуса
 * до монтажной плоскости привода; stud — E, выступ шпильки-фиксатора над ней.
 * 3/4 и 1 — один корпус (A, D, E и вес совпадают), отличается резьба.
 */
const SIZES: Readonly<Record<string, { length: number; depth: number; stud: number }>> = {
  '3/4': { length: 0.076, depth: 0.044, stud: 0.006 },
  '1': { length: 0.076, depth: 0.044, stud: 0.006 },
  '1 1/4': { length: 0.082, depth: 0.044, stud: 0.006 },
};
/** Корпус к A; ушки под шпильки — по диагоналям на доле A от оси; шкала — к корпусу (условно). */
const BODY_SHARE = 0.62;
const LUG = { share: 0.42, diameter: 0.01, hole: 0.004, thickness: 0.006 };
const DIAL_SHARE = 0.78;
/** Шток над монтажной плоскостью, шпилька, рукоятка: ступица и стрелка-рычаг, м — условно. */
const STEM = { diameter: 0.008, height: 0.012 };
const STUD_DIAMETER = 0.004;
const HANDLE = { hub: 0.024, hubHeight: 0.014, lever: 0.03, width: 0.012, tip: 0.006, thickness: 0.006 };

type Layout = { size: (typeof SIZES)[string]; thread: ThreadedSize; back: number; mount: number };

const alongZ = { x: 0, y: -Math.PI / 2, z: 0 };
const spanZ = (from: number, to: number, x = 0, y = 0) => ({ length: to - from, center: { x, y, z: (from + to) / 2 }, rotation: alongZ });

/** Выходы ходов: 3-ходовой — слева, справа и сверху (глухая сторона внизу), 4-ходовой — ещё снизу. */
const PORTS: readonly { id: string; frame: Frame; ways: readonly number[] }[] = [
  { id: 'left', frame: ConnectorFrame.left, ways: [3, 4] },
  { id: 'right', frame: ConnectorFrame.right, ways: [3, 4] },
  { id: 'top', frame: ConnectorFrame.top, ways: [3, 4] },
  { id: 'bottom', frame: ConnectorFrame.bottom, ways: [4] },
];

/**
 * Смесительный поворотный клапан (позиции 46–47) по образцу VALTEC VT.MIX03/VT.MIX04: латунный
 * корпус с ходами в плоскости XY, шток поворотного затвора — вперёд (+Z). Ходы с внутренней
 * резьбой (других концов VALTEC не выпускает). Порты названы по положению: назначение ходов
 * (подача котла, обратка, смешанный поток) задаётся при монтаже перестановкой шкалы — модель
 * направление потока не задаёт. Четыре ушка с резьбой под шпильку-фиксатор привода — у обоих клапанов.
 */
export class MixingValveGenerator extends BaseGenerator<MixingValveParams, Layout> {
  readonly id = 'valve.mixing';
  readonly version = 1;
  readonly title = 'Клапан смесительный';
  readonly paramSpecs: readonly ParamSpec[] = [
    { kind: 'choice', key: 'ways', label: 'Ходов', options: [3, 4] },
    { kind: 'choice', key: 'nominal', label: 'Резьба (в)', options: Object.keys(SIZES) },
    { kind: 'choice', key: 'control', label: 'Управление', options: ['handle', 'none'], optionLabels: { handle: 'рукоятка', none: 'шток под привод' } },
  ];
  readonly defaults: MixingValveParams = { ways: 3, nominal: '1', control: 'handle' };

  /** Тыльная сторона — по описанной окружности шестигранника хода; монтажная плоскость — на D от неё. */
  protected override layout(p: MixingValveParams): Layout {
    const size = SIZES[p.nominal];
    const thread = threadedSize(p.nominal, 'internal');
    const back = -(thread.n * VALVE_NUT_SCALE) / 2;
    return { size, thread, back, mount: back + size.depth };
  }

  protected create(p: MixingValveParams, d: Layout): GeneratedModel {
    const { size, thread, back, mount } = d;
    const half = size.length / 2;
    const body = size.length * BODY_SHARE;
    const ports = PORTS.filter((port) => port.ways.includes(p.ways));
    const merger = new MaterialGroupMerger();

    // Корпус-цилиндр по оси штока до ушков; кольцо под шкалой; шкала из нержавеющей стали.
    const bodyFront = mount - LUG.thickness;
    merger.add(
      ...sleeves.build({ material: 'bronze', ...spanZ(back, bodyFront), outerDiameter: body, innerDiameter: 0 }),
      ...sleeves.build({ material: 'bronze', ...spanZ(bodyFront, mount - 0.001), outerDiameter: body * DIAL_SHARE, innerDiameter: 0 }),
      ...sleeves.build({ material: 'metal', ...spanZ(mount - 0.001, mount), outerDiameter: body * DIAL_SHARE, innerDiameter: STEM.diameter }),
      ...this.lugs(size, bodyFront, mount),
    );
    // Шток до верха; под рукояткой — только до середины ступицы: торцы не совпадают.
    const handleStart = mount + STEM.height - HANDLE.hubHeight;
    const stemTop = p.control === 'handle' ? handleStart + HANDLE.hubHeight / 2 : mount + STEM.height;
    merger.add(...sleeves.build({ material: 'bronze', ...spanZ(mount - 0.001, stemTop), outerDiameter: STEM.diameter, innerDiameter: 0 }));
    // Ход: шейка от корпуса до шестигранника, шестигранник с внутренней резьбой у торца.
    for (const port of ports) {
      const neckStart = body * 0.4;
      const hexStart = half - thread.depth;
      merger.add(...orientParts([
        ...sleeves.build({ material: 'bronze', length: hexStart - neckStart, outerDiameter: thread.n * 1.05, innerDiameter: thread.v,
          center: { x: (neckStart + hexStart) / 2, y: 0, z: 0 } }),
        ...sleeves.build({ material: 'bronze', length: thread.depth, outerDiameter: thread.n * VALVE_NUT_SCALE, innerDiameter: thread.v,
          outerSegments: 6, center: { x: half - thread.depth / 2, y: 0, z: 0 }, materials: { outer: 'bronzeFlat', inner: 'bronzeThread' } }),
      ], port.frame.direction));
    }
    if (p.control === 'handle') merger.add(...this.handle(handleStart));

    const article = p.ways === 3 ? 'VT.MIX03' : 'VT.MIX04';
    return createMeshModel({
      title: `Клапан ${p.ways}-ходовой смесительный ${p.nominal}(в) ${article}${p.control === 'handle' ? ', рукоятка' : ''}`,
      ...merger.merge(),
      connectors: ports.map((port) => connector(port.id, port.frame, half, { nominal: p.nominal, joint: 'thread', gender: 'internal', depth: thread.depth })),
    });
  }

  /**
   * Ушки по диагоналям у монтажной плоскости: перемычка от корпуса и бобышка с отверстием.
   * В ушке слева сверху — шпилька-фиксатор привода, выступ E над монтажной плоскостью.
   */
  private lugs(size: Layout['size'], from: number, to: number): GeometryPart[] {
    const reach = size.length * LUG.share;
    const parts: GeometryPart[] = [];
    for (const angle of [Math.PI / 4, (3 * Math.PI) / 4, (5 * Math.PI) / 4, (7 * Math.PI) / 4]) {
      const x = Math.cos(angle) * reach;
      const y = Math.sin(angle) * reach;
      parts.push(
        ...sleeves.build({ material: 'bronze', ...spanZ(from, to, x, y), outerDiameter: LUG.diameter, innerDiameter: LUG.hole, materials: { inner: 'bronzeThread' } }),
        ...sleeves.build({ material: 'bronze', length: reach, outerDiameter: LUG.thickness, innerDiameter: 0, outerSegments: 4,
          center: { x: x / 2, y: y / 2, z: (from + to) / 2 }, rotation: { x: 0, y: 0, z: angle } }),
      );
    }
    const stud = { x: -Math.SQRT1_2 * reach, y: Math.SQRT1_2 * reach };
    parts.push(...sleeves.build({ material: 'metal', ...spanZ(from, to + size.stud, stud.x, stud.y), outerDiameter: STUD_DIAMETER, innerDiameter: 0 }));
    return parts;
  }

  /** Рукоятка из нейлона: ступица на штоке и рычаг-стрелка вправо (+X), выдавленный по +Z; верх рычага ниже верха ступицы. */
  private handle(start: number): GeometryPart[] {
    const { lever, width, tip } = HANDLE;
    return [
      ...sleeves.build({ material: 'black', ...spanZ(start, start + HANDLE.hubHeight), outerDiameter: HANDLE.hub, innerDiameter: 0 }),
      shapes.build({ material: 'blackFlat', depth: HANDLE.thickness, position: { x: 0, y: 0, z: start + HANDLE.hubHeight - HANDLE.thickness - 0.0005 },
        points: [{ x: 0, y: -width / 2 }, { x: lever, y: -tip / 2 }, { x: lever, y: tip / 2 }, { x: 0, y: width / 2 }] }),
    ];
  }
}
