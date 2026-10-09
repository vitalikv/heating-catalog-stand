import { BoxGeometry } from 'three';
import { BaseGenerator } from '../../core/BaseGenerator';
import { connector } from '../../core/connector';
import { ConnectorFrame } from '../../core/ConnectorFrame';
import type { Frame } from '../../core/ConnectorFrame';
import type { Connector, GeneratedModel, ParamSpec, Vector3Data } from '../../core/contracts';
import { createMeshModel } from '../../core/MeshModel';
import { MaterialGroupMerger } from '../../geometry/MaterialGroupMerger';
import { sleeves } from '../../geometry/SleeveGeometryBuilder';
import { specs } from '../../params/specs';
import { ThreadSizes } from '../../sizes/ThreadSizes';

/** Где выходят патрубки: снизу, сзади, снизу и сверху, слева и справа. */
export type BoilerConnection = 'bottom' | 'back' | 'top-bottom' | 'left-right';

/** Параметры в формате cdm из gl2. */
export interface BoilerParams {
  /** Габарит корпуса, м. */
  size: Vector3Data;
  /** Номинал наружной резьбы патрубков, например '3/4'. */
  r1: string;
  type: BoilerConnection;
}

/** Подписи вариантов — как в названии gl2. */
const CONNECTION_LABELS: Readonly<Record<BoilerConnection, string>> = {
  bottom: 'снизу',
  back: 'сзади',
  'top-bottom': 'снизу-сверху',
  'left-right': 'слева-справа',
};

/** Патрубок: где начинается (на стенке корпуса), куда выходит и его ID. */
interface Port {
  id: string;
  start: Vector3Data;
  frame: Frame;
}

/** Котёл: корпус-параллелепипед и два патрубка с наружной резьбой (перенос cr_kotel_1). */
export class BoilerGenerator extends BaseGenerator<BoilerParams> {
  readonly id = 'cr_kotel_1';
  readonly title = 'Котёл';
  readonly paramSpecs: readonly ParamSpec[] = [
    specs.length('size.x', 'Ширина', { min: 0.1, max: 2, step: 0.001 }),
    specs.length('size.y', 'Высота', { min: 0.1, max: 2, step: 0.001 }),
    specs.length('size.z', 'Глубина', { min: 0.1, max: 2, step: 0.001 }),
    specs.threadNominal('r1', 'Резьба патрубков (н)'),
    {
      kind: 'choice',
      key: 'type',
      label: 'Патрубки',
      options: Object.keys(CONNECTION_LABELS),
      optionLabels: CONNECTION_LABELS,
    },
  ];

  protected create(params: BoilerParams): GeneratedModel {
    const d1 = ThreadSizes.require(params.r1, 'external');
    // Удлинитель и резьба — по 0,4 наружного диаметра резьбы.
    const x1 = 0.02 * d1.n * 20;
    const { x, y, z } = params.size;

    const indexed = new BoxGeometry(x, y, z);
    const box = indexed.toNonIndexed();
    indexed.dispose();

    const merger = new MaterialGroupMerger();
    merger.add({ geometry: box, material: 'plasticGrey' });
    const connectors: Connector[] = [];
    for (const port of this.ports(params)) {
      // Удлинитель от стенки, за ним резьба; ось втулки X поворачивается на направление выхода.
      const along = (distance: number) => ({
        x: port.start.x + port.frame.direction.x * distance,
        y: port.start.y + port.frame.direction.y * distance,
        z: port.start.z + port.frame.direction.z * distance,
      });
      const pipe = { length: x1, outerDiameter: d1.n, innerDiameter: d1.v, rotation: this.rotation(port.frame) };
      merger.add(
        ...sleeves.build({ material: 'metal', ...pipe, center: along(x1 / 2) }),
        ...sleeves.build({ material: 'metal', ...pipe, center: along(x1 * 1.5), materials: { outer: 'thread' } }),
      );
      // Торец — конец резьбы, глубина — её длина. В gl2 точка — в центре резьбы.
      connectors.push(connector(port.id, port.frame, along(x1 * 2), { depth: x1, nominal: params.r1, joint: 'thread', gender: 'external' }));
    }

    return createMeshModel({
      title: `Котел (разъемы ${CONNECTION_LABELS[params.type]})`,
      ...merger.merge(),
      connectors,
    });
  }

  /** Расположение патрубков по cr_kotel_1. */
  private ports({ size, type }: BoilerParams): Port[] {
    const { x, y, z } = size;
    // Патрубки снизу и сзади — на 5 см выше дна; снизу, сверху и по бокам — на 0,3 глубины от центра назад.
    const low = -y / 2 + 0.05;
    switch (type) {
      case 'bottom':
        return [
          { id: 'bottom-left', start: { x: -x * 0.2, y: -y / 2, z: -z * 0.3 }, frame: ConnectorFrame.bottom },
          { id: 'bottom-right', start: { x: x * 0.2, y: -y / 2, z: -z * 0.3 }, frame: ConnectorFrame.bottom },
        ];
      case 'back':
        return [
          { id: 'back-left', start: { x: -x * 0.2, y: low, z: -z / 2 }, frame: ConnectorFrame.back },
          { id: 'back-right', start: { x: x * 0.2, y: low, z: -z / 2 }, frame: ConnectorFrame.back },
        ];
      case 'top-bottom':
        return [
          { id: 'top', start: { x: 0, y: y / 2, z: -z * 0.3 }, frame: ConnectorFrame.top },
          { id: 'bottom', start: { x: 0, y: -y / 2, z: -z * 0.3 }, frame: ConnectorFrame.bottom },
        ];
      case 'left-right':
        return [
          { id: 'left', start: { x: -x / 2, y: low, z: -z * 0.3 }, frame: ConnectorFrame.left },
          { id: 'right', start: { x: x / 2, y: low, z: -z * 0.3 }, frame: ConnectorFrame.right },
        ];
    }
  }

  /**
   * Поворот втулки так, чтобы её ось легла вдоль выхода. Втулка симметрична,
   * поэтому знак не важен: вертикаль — rot.z = π/2, назад — rot.y = π/2, как в gl2.
   */
  private rotation(frame: Frame): Vector3Data {
    if (frame.direction.y !== 0) return { x: 0, y: 0, z: Math.PI / 2 };
    if (frame.direction.z !== 0) return { x: 0, y: Math.PI / 2, z: 0 };
    return { x: 0, y: 0, z: 0 };
  }
}
