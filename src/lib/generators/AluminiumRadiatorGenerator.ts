import { Box3, Group, Mesh } from 'three';
import type { Connector, GeneratedModel, ModelGenerator, ValidationError, Vector3Data } from '../contracts';
import { GeneratorParamsError } from '../GeneratorParamsError';
import { ExtrudedShapeBuilder } from '../geometry/ExtrudedShapeBuilder';
import type { ExtrudedShapeOptions } from '../geometry/ExtrudedShapeBuilder';
import { MaterialGroupMerger } from '../geometry/MaterialGroupMerger';
import { SleeveGeometryBuilder } from '../geometry/SleeveGeometryBuilder';
import type { SleeveOptions } from '../geometry/SleeveGeometryBuilder';
import type { MaterialLibrary } from '../materials/MaterialLibrary';
import { ThreadSizes } from '../sizes/ThreadSizes';

/** Параметры в формате cdm из gl2. */
export interface AluminiumRadiatorParams {
  /** Число секций. */
  count: number;
  /** Габарит секции, м: x — ширина, y — межосевое расстояние; z в gl2 не используется. */
  size: Vector3Data;
  /** Дюймовый номинал внутренней резьбы коллекторов, например '1'. */
  r1: string;
}

const MIN_COUNT = 1;
const MAX_COUNT = 10;
/** Ширина центральной части коллектора, м (x_1 в gl2). */
const COLLECTOR_CENTER = 0.04;
/** Толщина рёбер, м (t1 в gl2). */
const FIN = 0.003;
/** Минимальная высота: ниже неё рёбра у коллекторов перекрываются. */
const MIN_HEIGHT = 0.1;
/** Сдвиг разъёмов наружу от центра резьбового участка, м (xk в gl2). */
const CONNECTOR_SHIFT = 0.007;
/** В gl2 наружный диаметр коллектора — диаметр резьбы × 1.2. */
const COLLECTOR_SCALE = 1.2;

const THREAD = 1;

/** Алюминиевый секционный радиатор (перенос al_radiator_1). */
export class AluminiumRadiatorGenerator implements ModelGenerator<AluminiumRadiatorParams> {
  readonly id = 'al_radiator_1';
  readonly title = 'Радиатор алюминиевый';

  private readonly sleeves = new SleeveGeometryBuilder();
  private readonly shapes = new ExtrudedShapeBuilder();

  constructor(private readonly materials: MaterialLibrary) {}

  validate(params: AluminiumRadiatorParams): ValidationError[] {
    const errors: ValidationError[] = [];

    if (!Number.isInteger(params.count) || params.count < MIN_COUNT || params.count > MAX_COUNT) {
      errors.push({ code: 'out_of_range', param: 'count', message: `Число секций — целое от ${MIN_COUNT} до ${MAX_COUNT}: ${params.count}` });
    }
    if (!ThreadSizes.has(params.r1)) {
      errors.push({ code: 'unknown_nominal', param: 'r1', message: `Неизвестный номинал резьбы r1: '${params.r1}'` });
    }
    const width = params.size?.x;
    if (!Number.isFinite(width) || width <= COLLECTOR_CENTER) {
      errors.push({ code: 'too_short', param: 'size.x', message: `Ширина секции должна быть больше ${COLLECTOR_CENTER * 1000} мм` });
    }
    const height = params.size?.y;
    if (!Number.isFinite(height) || height < MIN_HEIGHT) {
      errors.push({ code: 'too_short', param: 'size.y', message: `Высота секции должна быть не меньше ${MIN_HEIGHT * 1000} мм` });
    }

    return errors;
  }

  build(params: AluminiumRadiatorParams): GeneratedModel {
    const errors = this.validate(params);
    if (errors.length > 0) throw new GeneratorParamsError(this.id, errors);

    const thread = ThreadSizes.diameters(params.r1, 'internal')!;
    const n = thread.n * COLLECTOR_SCALE;
    const v = thread.v;
    const h = params.size.y;
    const x1 = COLLECTOR_CENTER;
    const x2 = (params.size.x - x1) / 2 + 0.001;
    const threadX = x1 / 2 + x2 / 2;

    const geometry = this.buildSection(params.size.x, h, n, v);
    geometry.computeBoundingBox();
    // Шаг секций — ширина габарита секции, как в gl2.
    const step = geometry.boundingBox!.max.x - geometry.boundingBox!.min.x;

    // Секции — меши с общей геометрией, как в gl2.
    const meshMaterials = [this.materials.get('plastic'), this.materials.get('thread')];
    const root = new Group();
    root.name = `Ал.радиатор h${Math.round(h * 1000)} (${params.count}шт.)`;
    for (let i = 0; i < params.count; i++) {
      const section = new Mesh(geometry, meshMaterials);
      section.position.x = step * i;
      root.add(section);
    }
    root.updateMatrixWorld(true);
    const bounds = new Box3().setFromObject(root);

    // Разъёмы — у резьбовых участков коллекторов, сдвинуты наружу на xk.
    const leftX = -threadX - CONNECTOR_SHIFT;
    const rightX = threadX + step * (params.count - 1) + CONNECTOR_SHIFT;
    const common = { nominal: params.r1, joint: 'thread', gender: 'internal' } as const;
    const left = { x: -1, y: 0, z: 0 };
    const right = { x: 1, y: 0, z: 0 };
    const connectors: Connector[] = [
      { id: 'bottom-left', position: { x: leftX, y: -h / 2, z: 0 }, direction: left, ...common },
      { id: 'top-left', position: { x: leftX, y: h / 2, z: 0 }, direction: left, ...common },
      { id: 'top-right', position: { x: rightX, y: h / 2, z: 0 }, direction: right, ...common },
      { id: 'bottom-right', position: { x: rightX, y: -h / 2, z: 0 }, direction: right, ...common },
    ];

    let disposed = false;
    return {
      root,
      connectors,
      bounds,
      warnings: [],
      dispose: () => {
        if (disposed) return;
        disposed = true;
        geometry.dispose();
      },
    };
  }

  /** Одна секция с центром в начале координат: коллекторы, вертикальная труба и рёбра. */
  private buildSection(width: number, h: number, n: number, v: number) {
    const x1 = COLLECTOR_CENTER;
    const x2 = (width - x1) / 2 + 0.001;
    const t1 = FIN;
    const pipe = { outerDiameter: n, innerDiameter: v };
    const threaded: Partial<SleeveOptions> = { materials: { inner: THREAD } };

    const sleeves: SleeveOptions[] = [];
    for (const y of [h / 2, -h / 2]) {
      sleeves.push(
        { ...pipe, ...threaded, length: x2, center: { x: -x1 / 2 - x2 / 2, y, z: 0 } },
        { ...pipe, ...threaded, length: x2, center: { x: x1 / 2 + x2 / 2, y, z: 0 } },
        { ...pipe, length: x1, center: { x: 0, y, z: 0 } },
      );
    }
    sleeves.push({ ...pipe, length: h, rotation: { x: 0, y: 0, z: -Math.PI / 2 } });

    // Рёбра — контуры и положения из al_radiator_1 без изменений.
    const p = (x: number, y: number) => ({ x, y });
    const alongX = { x: 0, y: Math.PI / 2, z: 0 };
    const acrossX = { x: 0, y: -Math.PI / 2, z: 0 };
    const centerFin = { depth: t1, position: { x: -t1 / 2, y: 0, z: 0 }, rotation: alongX };
    const top = h / 2;
    const semicircle = Array.from({ length: 17 }, (_, i) => p((Math.cos((Math.PI * i) / 16) * n) / 2, (Math.sin((Math.PI * i) / 16) * n) / 2 + top));
    const angled = [p(0, 0), p(0.025, 0.05), p(0.025 - t1, 0.05), p(-t1, 0)];
    const backAngled = [
      p(-n / 2 - 0.025, top), p(-n / 2 - 0.023, top + 0.01), p(-n / 2 - 0.02, top + 0.02), p(-n / 2 - 0.01, top + 0.03),
      p(-n / 2 - 0.01 + t1, top + 0.03), p(-n / 2 - 0.02 + t1, top + 0.02), p(-n / 2 - 0.023 + t1, top + 0.01), p(-n / 2 - 0.025 + t1, top),
    ];

    const fins: ExtrudedShapeOptions[] = [
      // Центральное ребро сзади
      { ...centerFin, points: [p(n / 2, -top), p(n / 2 + 0.025, -top), p(n / 2 + 0.025, top), p(n / 2, top)] },
      // Верхнее центральное ребро вокруг коллектора
      {
        ...centerFin,
        points: [
          p(n / 2 + 0.025, top), ...semicircle, p(-n / 2 - 0.025, top), p(-n / 2 - 0.025, top + 0.03),
          p(n / 2 + 0.01, top + 0.03), p(n / 2 + 0.02, top + 0.02), p(n / 2 + 0.023, top + 0.01), p(n / 2 + 0.025, top),
        ],
      },
      // Центральное ребро спереди
      { ...centerFin, points: [p(-n / 2, -top), p(-n / 2 - 0.025, -top), p(-n / 2 - 0.025, top), p(-n / 2, top)] },
      // Переднее ребро
      {
        depth: t1,
        position: { x: 0, y: -0.025, z: n / 2 + 0.025 },
        points: [p(width / 2, -top), p(width / 2, top - 0.025), p(-width / 2, top - 0.025), p(-width / 2, -top)],
      },
      // Верхние передние рёбра под углом
      { depth: width, rotation: acrossX, position: { x: width / 2, y: top - 0.075, z: n / 2 + t1 }, points: angled },
      { depth: width, rotation: acrossX, position: { x: width / 2, y: top - 0.05, z: n / 2 + t1 }, points: angled },
      // Верхнее ребро
      {
        depth: width,
        rotation: acrossX,
        position: { x: width / 2, y: top - 0.025, z: n / 2 + t1 },
        points: [
          p(0, 0), p(0.025, 0.05), p(0.025, 0.055), p(-n / 2 - 0.01, 0.055),
          p(-n / 2 - 0.01, 0.055 - t1), p(0.025 - t1, 0.055 - t1), p(0.025 - t1, 0.05), p(-t1, 0),
        ],
      },
      // Заднее ребро
      {
        depth: t1,
        position: { x: 0, y: 0, z: -n / 2 - 0.025 },
        points: [p(width / 2, -top), p(width / 2, top), p(-width / 2, top), p(-width / 2, -top)],
      },
      // Верхние задние рёбра под углом: ближе к центру и у заднего ребра
      { depth: width, rotation: acrossX, position: { x: width / 2, y: 0, z: n / 2 + t1 }, points: backAngled },
      { depth: width, rotation: acrossX, position: { x: width / 2, y: 0, z: 0 }, points: backAngled },
    ];

    const merger = new MaterialGroupMerger();
    for (const sleeve of sleeves) merger.add(...this.sleeves.build(sleeve));
    for (const fin of fins) merger.add(this.shapes.build(fin));
    return merger.merge();
  }
}
