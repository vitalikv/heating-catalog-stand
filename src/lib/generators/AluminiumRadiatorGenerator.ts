import { Box3 } from 'three';
import type { Connector, GeneratedModel, ModelGenerator, ParamSpec, ValidationError, Vector3Data } from '../contracts';
import { GeneratorParamsError } from '../GeneratorParamsError';
import { ExtrudedShapeBuilder } from '../geometry/ExtrudedShapeBuilder';
import type { ExtrudedShapeOptions } from '../geometry/ExtrudedShapeBuilder';
import { MaterialGroupMerger } from '../geometry/MaterialGroupMerger';
import type { GeometryPart } from '../geometry/MaterialGroupMerger';
import { SleeveGeometryBuilder } from '../geometry/SleeveGeometryBuilder';
import type { SleeveShape } from '../geometry/SleeveGeometryBuilder';
import { ParamSchema } from '../params/ParamSchema';
import { ThreadSizes } from '../sizes/ThreadSizes';
import { MeshModel } from './MeshModel';

/** Параметры в формате cdm из gl2. */
export interface AluminiumRadiatorParams {
  /** Число секций. */
  count: number;
  /** Габарит секции, м: x — ширина, y — межосевое расстояние; z в gl2 не используется. */
  size: Vector3Data;
  /** Дюймовый номинал внутренней резьбы коллекторов, например '1'. */
  r1: string;
}

/** Ширина центральной части коллектора, м (x_1 в gl2). */
const COLLECTOR_CENTER = 0.04;
/** Толщина рёбер, м (t1 в gl2). */
const FIN = 0.003;
/** В gl2 наружный диаметр коллектора — диаметр резьбы × 1.2. */
const COLLECTOR_SCALE = 1.2;

/** Алюминиевый секционный радиатор (перенос al_radiator_1). */
export class AluminiumRadiatorGenerator implements ModelGenerator<AluminiumRadiatorParams> {
  readonly id = 'al_radiator_1';
  readonly title = 'Радиатор алюминиевый';
  // count 1…10 — как в каталоге start.js. Ширина больше x_1, иначе нет резьбовых участков;
  // высота от 100 мм — ниже рёбра у коллекторов перекрываются.
  readonly paramSpecs: readonly ParamSpec[] = [
    { kind: 'integer', key: 'count', label: 'Секций', min: 1, max: 10 },
    { kind: 'length', key: 'size.y', label: 'Высота', min: 0.1, max: 1, step: 0.005 },
    { kind: 'length', key: 'size.x', label: 'Ширина секции', min: COLLECTOR_CENTER + 0.001, max: 0.12, step: 0.001 },
    { kind: 'choice', key: 'r1', label: 'Резьба', options: ThreadSizes.nominals },
  ];

  private readonly sleeves = new SleeveGeometryBuilder();
  private readonly shapes = new ExtrudedShapeBuilder();

  validate(params: AluminiumRadiatorParams): ValidationError[] {
    return ParamSchema.validate(this.paramSpecs, params);
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
    // Торец резьбового участка коллектора — край секции.
    const threadEnd = x1 / 2 + x2;

    // Секции — одинаковые куски со сдвигом на шаг; шаг — ширина габарита секции, как в gl2.
    const sections = Array.from({ length: params.count }, () => this.buildSection(params.size.x, h, n, v));
    const sectionBox = new Box3();
    for (const part of sections[0]) {
      part.geometry.computeBoundingBox();
      sectionBox.union(part.geometry.boundingBox!);
    }
    const step = sectionBox.max.x - sectionBox.min.x;
    const merger = new MaterialGroupMerger();
    sections.forEach((parts, i) => {
      for (const part of parts) part.geometry.translate(step * i, 0, 0);
      merger.add(...parts);
    });
    const title = `Ал.радиатор h${Math.round(h * 1000)} (${params.count}шт.)`;

    // Разъёмы на торцах коллекторов, глубина — резьбовой участок x_2.
    // В gl2 точка стояла в центре резьбового участка со сдвигом наружу на 7 мм.
    const leftX = -threadEnd;
    const rightX = threadEnd + step * (params.count - 1);
    // Порты радиатора — своя резьба: подходят только радиаторные переходники и пробки.
    const common = { up: { x: 0, y: 1, z: 0 }, depth: x2, nominal: params.r1, joint: 'radiator-thread', gender: 'internal' } as const;
    const left = { x: -1, y: 0, z: 0 };
    const right = { x: 1, y: 0, z: 0 };
    const connectors: Connector[] = [
      { id: 'bottom-left', position: { x: leftX, y: -h / 2, z: 0 }, direction: left, ...common },
      { id: 'top-left', position: { x: leftX, y: h / 2, z: 0 }, direction: left, ...common },
      { id: 'top-right', position: { x: rightX, y: h / 2, z: 0 }, direction: right, ...common },
      { id: 'bottom-right', position: { x: rightX, y: -h / 2, z: 0 }, direction: right, ...common },
    ];

    return MeshModel.create({ title, ...merger.merge(), connectors });
  }

  /** Куски одной секции с центром в начале координат: коллекторы, вертикальная труба и рёбра. */
  private buildSection(width: number, h: number, n: number, v: number): GeometryPart[] {
    const x1 = COLLECTOR_CENTER;
    const x2 = (width - x1) / 2 + 0.001;
    const t1 = FIN;
    const pipe = { outerDiameter: n, innerDiameter: v };
    const threaded: Partial<SleeveShape> = { materials: { inner: 'thread' } };

    const sleeves: SleeveShape[] = [];
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

    const fins: Omit<ExtrudedShapeOptions, 'material'>[] = [
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

    return [
      ...sleeves.flatMap((sleeve) => this.sleeves.build({ ...sleeve, material: 'plastic' })),
      ...fins.map((fin) => this.shapes.build({ ...fin, material: 'plastic' })),
    ];
  }
}
