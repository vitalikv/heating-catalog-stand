import { PlaneGeometry } from 'three';
import { BaseGenerator } from '../../core/BaseGenerator';
import { ConnectorFrame } from '../../core/ConnectorFrame';
import type { Connector, GeneratedModel, MaterialKey, ParamSpec, ValidationError, Vector3Data } from '../../core/contracts';
import { createMeshModel } from '../../core/MeshModel';
import { MaterialGroupMerger } from '../../geometry/MaterialGroupMerger';
import type { GeometryPart } from '../../geometry/MaterialGroupMerger';
import { sleeves } from '../../geometry/SleeveGeometryBuilder';
import { ParamSchema } from '../../params/ParamSchema';
import { specs } from '../../params/specs';
import { ThreadSizes } from '../../sizes/ThreadSizes';
import { orientParts } from '../ThreadedParts';

export interface SteelRadiatorParams {
  /** Габарит, м: x — длина, y — межосевое расстояние портов, z — глубина. */
  dimensions: Vector3Data;
  /** Дюймовый номинал внутренней резьбы портов, например '1/2'. */
  nominal: string;
  /**
   * С версии 2: 'bottom' добавляет пару портов вниз под H-блок (боковые порты остаются).
   * В параметрах версии 1 отсутствует — берётся из defaults ('side').
   */
  connection?: 'side' | 'bottom';
  /** С версии 2: у какого торца нижняя пара (connection = 'bottom'). */
  bottomSide?: 'right' | 'left';
}

type Layout = ReturnType<typeof ThreadSizes.require>;

/** Длина резьбы портов (x_1 в gl2), м. */
const PORT_LENGTH = 0.005;
/** Окантовка корпуса (s1), окантовка ребра (s2) и глубина ребра (s3), м. */
const FRAME = 0.02;
const RIB_FRAME = 0.02;
const RIB_DEPTH = 0.01;
/** Ширина панели-ребра до подгонки под длину радиатора, м. */
const RIB_WIDTH = 0.07;
/** Нижнее подключение (условные размеры): межосевое пары — как spacing H-блока по умолчанию. */
const BOTTOM_SPACING = 0.05;
/** От торца корпуса до оси ближнего нижнего порта, м. */
const BOTTOM_OFFSET = 0.05;

/** Плоскость PlaneGeometry: сначала повороты по порядку, потом сдвиг. */
interface PlaneOptions {
  width: number;
  height: number;
  rotate?: ('x' | 'y' | 'z')[];
  position: Vector3Data;
  material: MaterialKey;
}

/**
 * Стальной панельный радиатор (перенос st_radiator_1): короб без боковых стенок с окантовкой,
 * спереди и сзади — панели-рёбра на всю длину, по углам — четыре порта с внутренней резьбой.
 * Порты — обычная трубная резьба (решение 9 октября 2026). Всё слито в один меш.
 * Версия 2: нижнее подключение — ещё два порта вниз у одного торца (below-outer, below-inner).
 */
export class SteelRadiatorGenerator extends BaseGenerator<SteelRadiatorParams, Layout> {
  readonly id = 'radiator.steel';
  readonly version = 2;
  readonly title = 'Радиатор стальной';
  readonly paramSpecs: readonly ParamSpec[] = [
    specs.length('dimensions.x', 'Длина', { min: 0.1, max: 3, step: 0.01 }),
    specs.length('dimensions.y', 'Межосевое', { min: 0.1, max: 1.5, step: 0.005 }),
    specs.length('dimensions.z', 'Глубина', { min: 0.03, step: 0.001 }),
    specs.threadNominal('nominal', 'Резьба портов (в)'),
    { kind: 'choice', key: 'connection', label: 'Подключение', options: ['side', 'bottom'], optionLabels: { side: 'боковое', bottom: 'нижнее' }, addedIn: 2 },
    { kind: 'choice', key: 'bottomSide', label: 'Нижние порты', options: ['right', 'left'], optionLabels: { right: 'справа', left: 'слева' },
      when: { key: 'connection', values: ['bottom'] }, addedIn: 2 },
  ];
  readonly defaults: SteelRadiatorParams = { dimensions: { x: 0.4, y: 0.3, z: 0.07 }, nominal: '1/2', connection: 'side', bottomSide: 'right' };

  protected override layout(params: SteelRadiatorParams): Layout {
    return ThreadSizes.require(params.nominal, 'internal');
  }

  /** Нижняя пара с отступом от торца и окантовка у другого торца помещаются в длину корпуса. */
  protected override relations(params: SteelRadiatorParams, d: Layout): ValidationError[] {
    if (params.connection !== 'bottom') return [];
    const minimum = BOTTOM_OFFSET + BOTTOM_SPACING + FRAME + d.n;
    return params.dimensions.x <= minimum ? [ParamSchema.tooShort('dimensions.x', minimum)] : [];
  }

  protected create(params: SteelRadiatorParams, d: Layout): GeneratedModel {
    const { x: length, z: depth } = params.dimensions;
    // Высота корпуса: межосевое + окантовки сверху и снизу + диаметр порта.
    const height = params.dimensions.y + 2 * FRAME + d.n;
    const ribHeight = height - 2 * FRAME;
    const opening = length - 2 * FRAME;
    // Рёбра заполняют проём целиком: ширина подгоняется под целое число рёбер.
    const count = Math.max(1, Math.round(opening / RIB_WIDTH));
    const ribWidth = opening / count;

    const merger = new MaterialGroupMerger();
    merger.add(...this.housing(length, height, depth));
    for (let i = 0; i < count; i++) {
      merger.add(...this.rib(ribWidth, ribHeight, length, depth, false, ribWidth * i));
      merger.add(...this.rib(ribWidth, ribHeight, length, depth, true, -ribWidth * i));
    }

    // Порты: торцы — внешние концы резьбы, глубина — её длина. В gl2 точки — в центрах портов.
    const portX = length / 2 + PORT_LENGTH / 2;
    const portY = params.dimensions.y / 2;
    const ports: [string, number, number][] = [
      ['bottom-left', -1, -1],
      ['top-left', -1, 1],
      ['top-right', 1, 1],
      ['bottom-right', 1, -1],
    ];
    const connectors: Connector[] = [];
    for (const [id, side, level] of ports) {
      merger.add(
        ...sleeves.build({
          material: 'metal',
          length: PORT_LENGTH,
          outerDiameter: d.n,
          innerDiameter: d.v,
          center: { x: side * portX, y: level * portY, z: 0 },
          materials: { inner: 'thread' },
        }),
      );
      connectors.push({
        id,
        position: { x: side * (length / 2 + PORT_LENGTH), y: level * portY, z: 0 },
        ...(side < 0 ? ConnectorFrame.left : ConnectorFrame.right),
        depth: PORT_LENGTH,
        nominal: params.nominal,
        joint: 'thread',
        gender: 'internal',
      });
    }

    if (params.connection === 'bottom') {
      // Пара у торца bottomSide: ось порта на BOTTOM_OFFSET от торца, торец резьбы — на PORT_LENGTH ниже дна.
      const side = params.bottomSide === 'left' ? -1 : 1;
      const bottom = -height / 2;
      const below: [string, number][] = [
        ['below-outer', side * (length / 2 - BOTTOM_OFFSET)],
        ['below-inner', side * (length / 2 - BOTTOM_OFFSET - BOTTOM_SPACING)],
      ];
      for (const [id, x] of below) {
        const origin = { x, y: bottom, z: 0 };
        merger.add(
          ...orientParts(
            sleeves.build({ material: 'metal', length: PORT_LENGTH, outerDiameter: d.n, innerDiameter: d.v,
              center: { x: PORT_LENGTH / 2, y: 0, z: 0 }, materials: { inner: 'thread' } }),
            ConnectorFrame.bottom.direction,
            origin,
          ),
        );
        connectors.push({
          id,
          position: { x, y: bottom - PORT_LENGTH, z: 0 },
          ...ConnectorFrame.bottom,
          depth: PORT_LENGTH,
          nominal: params.nominal,
          joint: 'thread',
          gender: 'internal',
        });
      }
    }

    const bottomSuffix = params.connection === 'bottom' ? ', нижн.' : '';
    return createMeshModel({
      title: `Ст.радиатор h${Math.round(params.dimensions.y * 1000)} (${params.dimensions.x}м)${bottomSuffix}`,
      ...merger.merge(),
      connectors,
    });
  }

  /** Короб без боковых стенок и окантовка спереди и сзади. */
  private housing(length: number, height: number, depth: number): GeometryPart[] {
    const planes: PlaneOptions[] = [
      { width: length, height: depth, rotate: ['x'], position: { x: 0, y: -height / 2, z: 0 }, material: 'plastic' },
      { width: length, height: depth, rotate: ['x'], position: { x: 0, y: height / 2, z: 0 }, material: 'plastic' },
      { width: height, height: depth, rotate: ['z', 'y'], position: { x: -length / 2, y: 0, z: 0 }, material: 'plastic' },
      { width: height, height: depth, rotate: ['z', 'y'], position: { x: length / 2, y: 0, z: 0 }, material: 'plastic' },
    ];
    for (const z of [depth / 2, -depth / 2]) {
      planes.push(
        { width: length, height: FRAME, position: { x: 0, y: -height / 2 + FRAME / 2, z }, material: 'plastic' },
        { width: length, height: FRAME, position: { x: 0, y: height / 2 - FRAME / 2, z }, material: 'plastic' },
        { width: height, height: FRAME, rotate: ['z'], position: { x: -length / 2 + FRAME / 2, y: 0, z }, material: 'plastic' },
        { width: height, height: FRAME, rotate: ['z'], position: { x: length / 2 - FRAME / 2, y: 0, z }, material: 'plastic' },
      );
    }
    return planes.map((plane) => this.plane(plane));
  }

  /**
   * Панель-ребро у левого края проёма: окантовка, внутренние стенки (white_2) и дно.
   * Задние рёбра — передние, повёрнутые на −π вокруг Y; shift — сдвиг по X после этого.
   */
  private rib(width: number, height: number, length: number, depth: number, back: boolean, shift: number): GeometryPart[] {
    const innerWidth = RIB_WIDTH - 2 * RIB_FRAME;
    const innerHeight = height - 2 * RIB_FRAME;
    const face = depth / 2;
    const wall = face - RIB_DEPTH / 2;
    const offset = -length / 2 + FRAME + width / 2;
    const planes: PlaneOptions[] = [
      { width, height: RIB_FRAME, position: { x: 0, y: -height / 2 + RIB_FRAME / 2, z: face }, material: 'plastic' },
      { width, height: RIB_FRAME, position: { x: 0, y: height / 2 - RIB_FRAME / 2, z: face }, material: 'plastic' },
      { width: height, height: RIB_FRAME, rotate: ['z'], position: { x: -width / 2 + RIB_FRAME / 2, y: 0, z: face }, material: 'plastic' },
      { width: height, height: RIB_FRAME, rotate: ['z'], position: { x: width / 2 - RIB_FRAME / 2, y: 0, z: face }, material: 'plastic' },
      { width: innerWidth, height: RIB_DEPTH, rotate: ['x'], position: { x: 0, y: -height / 2 + RIB_FRAME, z: wall }, material: 'plasticGrey' },
      { width: innerWidth, height: RIB_DEPTH, rotate: ['x'], position: { x: 0, y: height / 2 - RIB_FRAME, z: wall }, material: 'plasticGrey' },
      { width: innerHeight, height: RIB_DEPTH, rotate: ['z', 'y'], position: { x: -width / 2 + RIB_FRAME, y: 0, z: wall }, material: 'plasticGrey' },
      { width: innerHeight, height: RIB_DEPTH, rotate: ['z', 'y'], position: { x: width / 2 - RIB_FRAME, y: 0, z: wall }, material: 'plasticGrey' },
      { width: innerWidth, height: innerHeight, position: { x: 0, y: 0, z: face - RIB_DEPTH }, material: 'plastic' },
    ];
    return planes.map((plane) => {
      const part = this.plane({ ...plane, position: { ...plane.position, x: plane.position.x + offset } });
      if (back) part.geometry.rotateY(-Math.PI);
      part.geometry.translate(shift, 0, 0);
      return part;
    });
  }

  /** Плоскость с родными UV PlaneGeometry; повороты на π/2 по списку, как в gl2. */
  private plane(options: PlaneOptions): GeometryPart {
    const indexed = new PlaneGeometry(options.width, options.height);
    for (const axis of options.rotate ?? []) {
      if (axis === 'x') indexed.rotateX(Math.PI / 2);
      else if (axis === 'y') indexed.rotateY(Math.PI / 2);
      else if (axis === 'z') indexed.rotateZ(Math.PI / 2);
    }
    const { x, y, z } = options.position;
    indexed.translate(x, y, z);

    const geometry = indexed.toNonIndexed();
    indexed.dispose();
    return { geometry, material: options.material };
  }
}
