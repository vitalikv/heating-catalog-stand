import { BaseGenerator } from '../../core/BaseGenerator';
import { connector } from '../../core/connector';
import { ConnectorFrame } from '../../core/ConnectorFrame';
import type { GeneratedModel, ParamSpec } from '../../core/contracts';
import { createMeshModel } from '../../core/MeshModel';
import { MaterialGroupMerger } from '../../geometry/MaterialGroupMerger';
import { shapes } from '../../geometry/ExtrudedShapeBuilder';
import { sleeves } from '../../geometry/SleeveGeometryBuilder';
import { SEAT_DEPTH } from '../manifold/ManifoldInserts';

export interface ThermoelectricActuatorParams {
  /** Положение индикатора: закрыт — выступ 0,5 мм, открыт — 4 мм (паспорт VT.TE 3040). */
  state: 'closed' | 'open';
}

/** Корпус VALTEC VT.TE 3040 (каталог 2017, с. 589), м: ширина, глубина, высота над основанием. */
const BODY = { width: 0.0484, depth: 0.0443, height: 0.0522, corner: 0.008 };
/** Кольцо адаптера VA 80 под M30×1,5, м — условно. */
const ADAPTER = { outer: 0.04, inner: 0.0302 };
const INDICATOR = { diameter: 0.01, closed: 0.0005, open: 0.004 };

/** Скруглённый прямоугольник против часовой стрелки; угол — четверть окружности из 4 отрезков. */
function roundedRectangle(width: number, depth: number, corner: number): { x: number; y: number }[] {
  const points: { x: number; y: number }[] = [];
  const centers = [[width / 2 - corner, depth / 2 - corner], [-width / 2 + corner, depth / 2 - corner],
    [-width / 2 + corner, -depth / 2 + corner], [width / 2 - corner, -depth / 2 + corner]];
  centers.forEach(([cx, cy], quarter) => {
    for (let i = 0; i <= 4; i++) {
      const angle = (quarter + i / 4) * (Math.PI / 2);
      points.push({ x: cx + corner * Math.cos(angle), y: cy + corner * Math.sin(angle) });
    }
  });
  return points;
}

/**
 * Термоэлектрический сервопривод (позиция 69) по образцу VALTEC VT.TE 3040/3041. Ставится на
 * посадочное место M30×1,5 коллекторного или радиаторного термоклапана (система valve-head):
 * кольцо адаптера навинчено на резьбу клапана, корпус защёлкнут на адаптере.
 * Основание — плоскость разъёма (y = 0), корпус вверх по +Y.
 */
export class ThermoelectricActuatorGenerator extends BaseGenerator<ThermoelectricActuatorParams> {
  readonly id = 'valve.thermoelectric-actuator';
  readonly version = 1;
  readonly title = 'Сервопривод термоэлектрический';
  readonly paramSpecs: readonly ParamSpec[] = [
    { kind: 'choice', key: 'state', label: 'Клапан', options: ['closed', 'open'], optionLabels: { closed: 'закрыт', open: 'открыт' } },
  ];
  readonly defaults: ThermoelectricActuatorParams = { state: 'closed' };

  protected create(p: ThermoelectricActuatorParams): GeneratedModel {
    const indicator = p.state === 'open' ? INDICATOR.open : INDICATOR.closed;
    const up = { x: 0, y: 0, z: Math.PI / 2 };
    const merger = new MaterialGroupMerger();
    merger.add(
      // Втулки строятся по X и поворачиваются на +Y.
      ...sleeves.build({ material: 'plasticGrey', length: SEAT_DEPTH, outerDiameter: ADAPTER.outer, innerDiameter: ADAPTER.inner,
        rotation: up, center: { x: 0, y: SEAT_DEPTH / 2, z: 0 } }),
      // Контур в плоскости XY выдавливается по +Z; поворот −90° вокруг X направляет выдавливание по +Y.
      shapes.build({ material: 'plastic', points: roundedRectangle(BODY.width, BODY.depth, BODY.corner), depth: BODY.height - SEAT_DEPTH,
        rotation: { x: -Math.PI / 2, y: 0, z: 0 }, position: { x: 0, y: SEAT_DEPTH, z: 0 } }),
      ...sleeves.build({ material: 'red', length: indicator, outerDiameter: INDICATOR.diameter, innerDiameter: 0,
        rotation: up, center: { x: 0, y: BODY.height + indicator / 2, z: 0 } }),
    );
    return createMeshModel({
      title: `Сервопривод термоэлектрический M30x1,5, ${p.state === 'open' ? 'открыт' : 'закрыт'}`,
      ...merger.merge(),
      connectors: [connector('valve', ConnectorFrame.bottom, { x: 0, y: 0, z: 0 }, { nominal: 'M30x1.5', joint: 'valve-head', gender: 'internal', depth: SEAT_DEPTH })],
    });
  }
}
