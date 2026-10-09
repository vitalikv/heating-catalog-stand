import { BoxGeometry } from 'three';
import type { Connector, GeneratedModel, ModelGenerator, ParamSpec, ValidationError, Vector3Data } from '../contracts';
import { GeneratorParamsError } from '../GeneratorParamsError';
import { MaterialGroupMerger } from '../geometry/MaterialGroupMerger';
import { SleeveGeometryBuilder } from '../geometry/SleeveGeometryBuilder';
import type { MaterialLibrary } from '../materials/MaterialLibrary';
import { ParamSchema } from '../params/ParamSchema';
import { ThreadSizes } from '../sizes/ThreadSizes';
import { ConnectorFrame } from './ConnectorFrame';
import type { Frame } from './ConnectorFrame';
import { MeshModel } from './MeshModel';

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

/** Выход назад (−Z): левый выход, повёрнутый вокруг Y; up остаётся +Y. */
const BACK: Frame = { direction: { x: 0, y: 0, z: -1 }, up: { x: 0, y: 1, z: 0 } };

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
export class BoilerGenerator implements ModelGenerator<BoilerParams> {
  readonly id = 'cr_kotel_1';
  readonly title = 'Котёл';
  readonly paramSpecs: readonly ParamSpec[] = [
    { kind: 'length', key: 'size.x', label: 'Ширина', min: 0.1, max: 2, step: 0.001 },
    { kind: 'length', key: 'size.y', label: 'Высота', min: 0.1, max: 2, step: 0.001 },
    { kind: 'length', key: 'size.z', label: 'Глубина', min: 0.1, max: 2, step: 0.001 },
    { kind: 'choice', key: 'r1', label: 'Резьба патрубков (н)', options: ThreadSizes.nominals },
    {
      kind: 'choice',
      key: 'type',
      label: 'Патрубки',
      options: Object.keys(CONNECTION_LABELS),
      optionLabels: CONNECTION_LABELS,
    },
  ];

  private readonly sleeves = new SleeveGeometryBuilder();

  constructor(private readonly materials: MaterialLibrary) {}

  validate(params: BoilerParams): ValidationError[] {
    return ParamSchema.validate(this.paramSpecs, params);
  }

  build(params: BoilerParams): GeneratedModel {
    const errors = this.validate(params);
    if (errors.length > 0) throw new GeneratorParamsError(this.id, errors);

    const d1 = ThreadSizes.diameters(params.r1, 'external')!;
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
        ...this.sleeves.build({ material: 'metal', ...pipe, center: along(x1 / 2) }),
        ...this.sleeves.build({ material: 'metal', ...pipe, center: along(x1 * 1.5), materials: { outer: 'thread' } }),
      );
      // Торец — конец резьбы, глубина — её длина. В gl2 точка — в центре резьбы.
      connectors.push({ id: port.id, position: along(x1 * 2), ...port.frame, depth: x1, nominal: params.r1, joint: 'thread', gender: 'external' });
    }

    return MeshModel.create({
      title: `Котел (разъемы ${CONNECTION_LABELS[params.type]})`,
      ...merger.merge(),
      connectors,
    }, this.materials);
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
          { id: 'back-left', start: { x: -x * 0.2, y: low, z: -z / 2 }, frame: BACK },
          { id: 'back-right', start: { x: x * 0.2, y: low, z: -z / 2 }, frame: BACK },
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
