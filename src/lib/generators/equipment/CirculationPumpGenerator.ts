import { BaseGenerator } from '../../core/BaseGenerator';
import { connector } from '../../core/connector';
import { ConnectorFrame } from '../../core/ConnectorFrame';
import type { GeneratedModel, ParamSpec, ValidationError } from '../../core/contracts';
import { createMeshModel } from '../../core/MeshModel';
import { shapes } from '../../geometry/ExtrudedShapeBuilder';
import { MaterialGroupMerger } from '../../geometry/MaterialGroupMerger';
import { sleeves } from '../../geometry/SleeveGeometryBuilder';
import { ParamSchema } from '../../params/ParamSchema';
import { specs } from '../../params/specs';
import { ThreadSizes } from '../../sizes/ThreadSizes';
import { threadedSize } from '../ThreadedParts';

export interface CirculationPumpParams {
  /** Номинал наружной резьбы патрубков, например '1 1/4'. */
  nominal: string;
  /** С версии 2: монтажная длина — между торцами патрубков, м (у исполнения gl2 — 0,19). */
  installLength?: number;
  /** С версии 2: корпус 'gl2' — перенос cr_zr_nasos_1; 'vrs' — пропорции VALTEC VRS. */
  housing?: 'gl2' | 'vrs';
  /** С версии 2: типоразмер мотора VRS: 'small' — x/4, x/6; 'large' — x/8. */
  motor?: 'small' | 'large';
  /** С версии 2: положение клеммной коробки VRS; вниз паспорт VRS ставить запрещает. */
  terminalBox?: 'left' | 'right' | 'top';
}

/** Параметры после подстановки умолчаний версии 2 (BaseGenerator). */
type PumpParams = Required<CirculationPumpParams>;

// Размеры корпуса из cr_zr_nasos_1, м: от номинала зависит только резьба патрубков.
/** Длина мотора (z1), толщина крышки (z2), глубина задней коробки (z3). */
const MOTOR_LENGTH = 0.075;
const COVER = 0.0015;
const BACK_DEPTH = 0.03;
const MOTOR_DIAMETER = 0.085;
/** Внутренний диаметр «сплошных» дисков в gl2 — 0.00001, а не 0. */
const ALMOST_SOLID = 0.00001;
/** Корпус-улитка: наружный и внутренний диаметры; длина — монтажная длина без патрубков. */
const BODY = { outer: 0.025, inner: 0.02 };
/** Длина резьбового патрубка. */
const PORT = 0.01;
/** Монтажная длина gl2: корпус 0,18; патрубки отцентрованы по его концам и выступают на половину длины. */
const GL2_INSTALL_LENGTH = 0.19;
/** Масштаб контуров коробок. */
const SHAPE_SCALE = 0.091;
const BACK_SHAPE: readonly [number, number][] = [[0.5, -0.35], [0.5, 0.35], [0.35, 0.5], [-0.35, 0.5], [-0.5, 0.35], [-0.5, -0.35], [-0.35, -0.5], [0.35, -0.5]];
const TOP_SHAPE: readonly [number, number][] = [[0.4, -0.05], [0.4, 0.05], [0.35, 0.1], [-0.35, 0.1], [-0.4, 0.05], [-0.4, -0.05], [-0.15, -0.1], [0.15, -0.1]];

/**
 * VALTEC VRS (технический каталог 2017, с. 676–678), м: габарит спереди с клеммной коробкой
 * (width) и глубина от торца патрубка до задней крышки мотора (depth) — по чертежам;
 * диаметры мотора и улитки — условно, по пропорциям чертежа.
 */
const VRS = {
  small: { width: 0.123, depth: 0.129, motor: 0.093, volute: 0.075 },
  large: { width: 0.147, depth: 0.166, motor: 0.11, volute: 0.09 },
} as const;
/** Длина улитки вдоль оси мотора, накрывающая крышка мотора, ширина коробки поперёк — условно. */
const VOLUTE_LENGTH = 0.04;
const VRS_COVER = 0.004;
const BOX_SPAN = 0.06;

type Layout = { thread: ReturnType<typeof threadedSize> };

/**
 * Циркуляционный насос: корпус с двумя патрубками вдоль X, мотор вдоль Z.
 * Версия 1 — перенос cr_zr_nasos_1. Версия 2: монтажная длина installLength и исполнение
 * корпуса VRS (мотор, положение клеммной коробки); умолчания — прежняя модель gl2.
 */
export class CirculationPumpGenerator extends BaseGenerator<CirculationPumpParams, Layout> {
  readonly id = 'equipment.pump';
  readonly version = 2;
  readonly title = 'Насос циркуляционный';
  readonly paramSpecs: readonly ParamSpec[] = [
    specs.threadNominal('nominal', 'Резьба патрубков (н)'),
    { ...specs.length('installLength', 'Монтажная длина', { min: 0.1, max: 0.25, step: 0.005 }), addedIn: 2 },
    { kind: 'choice', key: 'housing', label: 'Корпус', options: ['gl2', 'vrs'], optionLabels: { gl2: 'gl2', vrs: 'VRS' }, addedIn: 2 },
    { kind: 'choice', key: 'motor', label: 'Мотор', options: ['small', 'large'], optionLabels: { small: 'x/4, x/6', large: 'x/8' },
      when: { key: 'housing', values: ['vrs'] }, addedIn: 2 },
    { kind: 'choice', key: 'terminalBox', label: 'Клеммная коробка', options: ['left', 'right', 'top'],
      optionLabels: { left: 'слева', right: 'справа', top: 'сверху' }, when: { key: 'housing', values: ['vrs'] }, addedIn: 2 },
  ];
  readonly defaults: CirculationPumpParams = { nominal: '1', installLength: GL2_INSTALL_LENGTH, housing: 'gl2', motor: 'small', terminalBox: 'left' };

  protected override layout(p: CirculationPumpParams): Layout {
    return { thread: threadedSize(p.nominal, 'external') };
  }

  protected override relations(params: CirculationPumpParams, d: Layout): ValidationError[] {
    const p = params as PumpParams;
    // Корпус gl2 не короче задней коробки; у VRS улитка и две резьбы с шейками помещаются между торцами.
    const minimum = p.housing === 'gl2' ? PORT + SHAPE_SCALE : VRS[p.motor].volute + 2 * d.thread.depth + 0.01;
    return p.installLength <= minimum ? [ParamSchema.tooShort('installLength', minimum)] : [];
  }

  protected create(params: CirculationPumpParams, d: Layout): GeneratedModel {
    const p = params as PumpParams;
    return p.housing === 'gl2' ? this.gl2(p) : this.vrs(p, d);
  }

  private gl2(params: PumpParams): GeneratedModel {
    const d1 = ThreadSizes.require(params.nominal, 'external');
    const bodyLength = params.installLength - PORT;
    const alongZ = { x: 0, y: Math.PI / 2, z: 0 };
    const coverZ = (MOTOR_LENGTH + COVER) / 2;
    // Ось корпуса — у задней стенки мотора.
    const bodyZ = -MOTOR_LENGTH / 2 - BACK_DEPTH + 0.005;
    const contour = (points: readonly [number, number][]) => points.map(([x, y]) => ({ x: x * SHAPE_SCALE, y: y * SHAPE_SCALE }));
    const port = (x: number) =>
      sleeves.build({ material: 'red', length: PORT, outerDiameter: d1.n, innerDiameter: BODY.inner, center: { x, y: 0, z: bodyZ }, materials: { outer: 'thread' } });

    const merger = new MaterialGroupMerger();
    merger.add(
      // Мотор, чёрная крышка и металлический вал
      ...sleeves.build({ material: 'red', length: MOTOR_LENGTH, outerDiameter: MOTOR_DIAMETER, innerDiameter: ALMOST_SOLID, rotation: alongZ }),
      ...sleeves.build({ material: 'black', length: COVER, outerDiameter: 0.077, innerDiameter: 0.02, rotation: alongZ, center: { x: 0, y: 0, z: coverZ } }),
      ...sleeves.build({ material: 'metal', length: COVER, outerDiameter: 0.02, innerDiameter: ALMOST_SOLID, rotation: alongZ, center: { x: 0, y: 0, z: coverZ - 0.001 } }),
      // Задняя коробка и клеммная коробка сверху
      shapes.build({ material: 'red', points: contour(BACK_SHAPE), depth: BACK_DEPTH, position: { x: 0, y: 0, z: bodyZ } }),
      shapes.build({ material: 'black', points: contour(TOP_SHAPE), depth: MOTOR_LENGTH, position: { x: 0, y: MOTOR_LENGTH / 2 + 0.01, z: -MOTOR_LENGTH / 2 - 0.001 } }),
      // Корпус и патрубки
      ...sleeves.build({ material: 'red', length: bodyLength, outerDiameter: BODY.outer, innerDiameter: BODY.inner, center: { x: 0, y: 0, z: bodyZ } }),
      ...port(-bodyLength / 2),
      ...port(bodyLength / 2),
    );

    // Торцы — концы патрубков, глубина — длина патрубка. В gl2 точки — в центрах патрубков.
    const face = params.installLength / 2;
    const common = { depth: PORT, nominal: params.nominal, joint: 'thread', gender: 'external' } as const;
    return createMeshModel({
      title: `цирк. насос ${params.nominal}`,
      ...merger.merge(),
      connectors: [
        connector('left', ConnectorFrame.left, { x: -face, y: 0, z: bodyZ }, common),
        connector('right', ConnectorFrame.right, { x: face, y: 0, z: bodyZ }, common),
      ],
    });
  }

  /**
   * VRS: ось патрубков — X через начало координат, торцы на ±installLength/2. Улитка вокруг
   * оси мотора Z, мотор уходит в +Z до задней крышки: глубина от торца патрубка (−резьба/2 по Z)
   * до крышки — по чертежу. Клеммная коробка на боку мотора дополняет габарит спереди до width.
   */
  private vrs(p: PumpParams, { thread }: Layout): GeneratedModel {
    const size = VRS[p.motor];
    const half = p.installLength / 2;
    const alongZ = { x: 0, y: -Math.PI / 2, z: 0 };
    const back = size.depth - thread.n / 2;
    const motorStart = VOLUTE_LENGTH / 2;
    const motorEnd = back - VRS_COVER;
    const neck = thread.n * 0.75;
    const at = (x: number, z = 0) => ({ x, y: 0, z });

    const merger = new MaterialGroupMerger();
    for (const sign of [-1, 1]) {
      // Резьба патрубка и шейка до улитки.
      merger.add(
        ...sleeves.build({ material: 'black', length: thread.depth, outerDiameter: thread.n, innerDiameter: thread.v,
          center: at(sign * (half - thread.depth / 2)), materials: { outer: 'thread' } }),
        ...sleeves.build({ material: 'black', length: half - thread.depth, outerDiameter: neck, innerDiameter: thread.v,
          center: at(sign * (half - thread.depth) / 2) }),
      );
    }
    merger.add(
      ...sleeves.build({ material: 'black', length: VOLUTE_LENGTH, outerDiameter: size.volute, innerDiameter: 0, rotation: alongZ }),
      ...sleeves.build({ material: 'metal', length: motorEnd - motorStart, outerDiameter: size.motor, innerDiameter: 0,
        rotation: alongZ, center: at(0, (motorStart + motorEnd) / 2) }),
      ...sleeves.build({ material: 'black', length: VRS_COVER, outerDiameter: size.motor * 0.85, innerDiameter: 0,
        rotation: alongZ, center: at(0, motorEnd + VRS_COVER / 2) }),
      this.terminalBox(p.terminalBox, size, motorStart, motorEnd),
    );

    const common = { depth: thread.depth, nominal: p.nominal, joint: 'thread', gender: 'external' } as const;
    return createMeshModel({
      title: `Насос VRS ${p.nominal}, ${Math.round(p.installLength * 1000)} мм`,
      ...merger.merge(),
      connectors: [
        connector('left', ConnectorFrame.left, half, common),
        connector('right', ConnectorFrame.right, half, common),
      ],
    });
  }

  /** Коробка вдоль мотора: толщина — разница габарита спереди и диаметра мотора, заходит на 5 мм в мотор. */
  private terminalBox(position: PumpParams['terminalBox'], size: (typeof VRS)[keyof typeof VRS], from: number, to: number) {
    const radius = size.motor / 2;
    const outer = size.width - radius;
    const inner = radius - 0.005;
    const across = BOX_SPAN / 2;
    const rectangle = position === 'top'
      ? [{ x: -across, y: inner }, { x: across, y: inner }, { x: across, y: outer }, { x: -across, y: outer }]
      : position === 'right'
        ? [{ x: inner, y: -across }, { x: outer, y: -across }, { x: outer, y: across }, { x: inner, y: across }]
        : [{ x: -outer, y: -across }, { x: -inner, y: -across }, { x: -inner, y: across }, { x: -outer, y: across }];
    const length = (to - from) * 0.8;
    return shapes.build({ material: 'plasticGrey', points: rectangle, depth: length, position: { x: 0, y: 0, z: to - length } });
  }
}
