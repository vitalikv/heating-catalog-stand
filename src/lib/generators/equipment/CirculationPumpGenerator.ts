import { BaseGenerator } from '../../core/BaseGenerator';
import { connector } from '../../core/connector';
import { ConnectorFrame } from '../../core/ConnectorFrame';
import type { GeneratedModel, ParamSpec } from '../../core/contracts';
import { createMeshModel } from '../../core/MeshModel';
import { shapes } from '../../geometry/ExtrudedShapeBuilder';
import { MaterialGroupMerger } from '../../geometry/MaterialGroupMerger';
import { sleeves } from '../../geometry/SleeveGeometryBuilder';
import { specs } from '../../params/specs';
import { ThreadSizes } from '../../sizes/ThreadSizes';

export interface CirculationPumpParams {
  /** Номинал наружной резьбы патрубков, например '1 1/4'. */
  nominal: string;
}

// Размеры корпуса из cr_zr_nasos_1, м: от номинала зависит только резьба патрубков.
/** Длина мотора (z1), толщина крышки (z2), глубина задней коробки (z3). */
const MOTOR_LENGTH = 0.075;
const COVER = 0.0015;
const BACK_DEPTH = 0.03;
const MOTOR_DIAMETER = 0.085;
/** Внутренний диаметр «сплошных» дисков в gl2 — 0.00001, а не 0. */
const ALMOST_SOLID = 0.00001;
/** Корпус-улитка: длина, наружный и внутренний диаметры. */
const BODY = { length: 0.18, outer: 0.025, inner: 0.02 };
/** Длина резьбового патрубка. */
const PORT = 0.01;
/** Масштаб контуров коробок. */
const SHAPE_SCALE = 0.091;
const BACK_SHAPE: readonly [number, number][] = [[0.5, -0.35], [0.5, 0.35], [0.35, 0.5], [-0.35, 0.5], [-0.5, 0.35], [-0.5, -0.35], [-0.35, -0.5], [0.35, -0.5]];
const TOP_SHAPE: readonly [number, number][] = [[0.4, -0.05], [0.4, 0.05], [0.35, 0.1], [-0.35, 0.1], [-0.4, 0.05], [-0.4, -0.05], [-0.15, -0.1], [0.15, -0.1]];

/** Циркуляционный насос: мотор вдоль Z, корпус с двумя патрубками вдоль X (перенос cr_zr_nasos_1). */
export class CirculationPumpGenerator extends BaseGenerator<CirculationPumpParams> {
  readonly id = 'equipment.pump';
  readonly version = 1;
  readonly title = 'Насос циркуляционный';
  readonly paramSpecs: readonly ParamSpec[] = [specs.threadNominal('nominal', 'Резьба патрубков (н)')];
  readonly defaults: CirculationPumpParams = { nominal: '1' };

  protected create(params: CirculationPumpParams): GeneratedModel {
    const d1 = ThreadSizes.require(params.nominal, 'external');
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
      ...sleeves.build({ material: 'red', length: BODY.length, outerDiameter: BODY.outer, innerDiameter: BODY.inner, center: { x: 0, y: 0, z: bodyZ } }),
      ...port(-BODY.length / 2),
      ...port(BODY.length / 2),
    );

    // Торцы — концы патрубков, глубина — длина патрубка. В gl2 точки — в центрах патрубков.
    const face = BODY.length / 2 + PORT / 2;
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
}
