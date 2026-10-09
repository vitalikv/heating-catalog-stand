import { PlaneGeometry } from 'three';
import type { Connector, GeneratedModel, MaterialKey, ModelGenerator, ParamSpec, ValidationError, Vector3Data } from '../contracts';
import { GeneratorParamsError } from '../GeneratorParamsError';
import { MaterialGroupMerger } from '../geometry/MaterialGroupMerger';
import type { GeometryPart } from '../geometry/MaterialGroupMerger';
import { SleeveGeometryBuilder } from '../geometry/SleeveGeometryBuilder';
import { ParamSchema } from '../params/ParamSchema';
import { ThreadSizes } from '../sizes/ThreadSizes';
import { ConnectorFrame } from './ConnectorFrame';
import { MeshModel } from './MeshModel';

/** Параметры в формате cdm из gl2. */
export interface SteelRadiatorParams {
  /** Габарит, м: x — длина, y — межосевое расстояние портов, z — глубина. */
  size: Vector3Data;
  /** Дюймовый номинал внутренней резьбы портов, например '1/2'. */
  r1: string;
}

/** Длина резьбы портов (x_1 в gl2), м. */
const PORT_LENGTH = 0.005;
/** Окантовка корпуса (s1), окантовка ребра (s2) и глубина ребра (s3), м. */
const FRAME = 0.02;
const RIB_FRAME = 0.02;
const RIB_DEPTH = 0.01;
/** Ширина панели-ребра до подгонки под длину радиатора, м. */
const RIB_WIDTH = 0.07;

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
 */
export class SteelRadiatorGenerator implements ModelGenerator<SteelRadiatorParams> {
  readonly id = 'st_radiator_1';
  readonly title = 'Радиатор стальной';
  readonly paramSpecs: readonly ParamSpec[] = [
    { kind: 'length', key: 'size.x', label: 'Длина', min: 0.1, max: 3, step: 0.01 },
    { kind: 'length', key: 'size.y', label: 'Межосевое', min: 0.1, max: 1.5, step: 0.005 },
    { kind: 'length', key: 'size.z', label: 'Глубина', min: 0.03, max: 0.2, step: 0.001 },
    { kind: 'choice', key: 'r1', label: 'Резьба портов (в)', options: ThreadSizes.nominals },
  ];

  private readonly sleeves = new SleeveGeometryBuilder();

  validate(params: SteelRadiatorParams): ValidationError[] {
    return ParamSchema.validate(this.paramSpecs, params);
  }

  build(params: SteelRadiatorParams): GeneratedModel {
    const errors = this.validate(params);
    if (errors.length > 0) throw new GeneratorParamsError(this.id, errors);

    const d = ThreadSizes.diameters(params.r1, 'internal')!;
    const { x: length, z: depth } = params.size;
    // Высота корпуса: межосевое + окантовки сверху и снизу + диаметр порта.
    const height = params.size.y + 2 * FRAME + d.n;
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
    const portY = params.size.y / 2;
    const ports: [string, number, number][] = [
      ['bottom-left', -1, -1],
      ['top-left', -1, 1],
      ['top-right', 1, 1],
      ['bottom-right', 1, -1],
    ];
    const connectors: Connector[] = [];
    for (const [id, side, level] of ports) {
      merger.add(
        ...this.sleeves.build({
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
        nominal: params.r1,
        joint: 'thread',
        gender: 'internal',
      });
    }

    return MeshModel.create({
      title: `Ст.радиатор h${Math.round(params.size.y * 1000)} (${params.size.x}м)`,
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
