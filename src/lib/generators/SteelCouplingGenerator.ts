import { Box3, Group, Mesh } from 'three';
import type { Connector, GeneratedModel, ModelGenerator, ValidationError } from '../contracts';
import { GeneratorParamsError } from '../GeneratorParamsError';
import { MaterialGroupMerger } from '../geometry/MaterialGroupMerger';
import { SleeveGeometryBuilder } from '../geometry/SleeveGeometryBuilder';
import type { MaterialLibrary } from '../materials/MaterialLibrary';
import { ThreadSizes } from '../sizes/ThreadSizes';
import type { PartDiameters } from '../sizes/ThreadSizes';

/** Параметры в формате cdm из gl2, чтобы наборы каталога переносились как есть. */
export interface SteelCouplingParams {
  /** Дюймовый номинал внутренней резьбы слева, например '1/2'. */
  r1: string;
  /** Номинал справа. */
  r2: string;
  /** Длина муфты, м. */
  m1: number;
}

const MIN_THREAD_LENGTH = 0.012;
/** Запас ширины колец по диаметру, м. */
const RING_OUTER_EXTRA = 0.002;
const RING_INNER_EXTRA = 0.001;

/** Индексы материалов меша: 0 — metal (по умолчанию у всех частей втулки), 1 — thread. */
const THREAD = 1;

/** Размеры муфты по формулам st_mufta_1. */
interface CouplingLayout {
  d1: PartDiameters;
  d2: PartDiameters;
  /** Длины резьбовых участков слева и справа. */
  x1: number;
  x2: number;
  /** Длины гладких участков слева и справа. */
  x3L: number;
  x3R: number;
  /** Ширина колец и центральной втулки. */
  x4: number;
}

/** Стальная муфта с внутренней резьбой с двух сторон (перенос st_mufta_1). */
export class SteelCouplingGenerator implements ModelGenerator<SteelCouplingParams> {
  readonly id = 'st_mufta_1';
  readonly title = 'Муфта стальная';

  private readonly sleeves = new SleeveGeometryBuilder();

  constructor(private readonly materials: MaterialLibrary) {}

  validate(params: SteelCouplingParams): ValidationError[] {
    const errors: ValidationError[] = [];

    for (const param of ['r1', 'r2'] as const) {
      if (!ThreadSizes.has(params[param])) {
        errors.push({ code: 'unknown_nominal', param, message: `Неизвестный номинал резьбы ${param}: '${params[param]}'` });
      }
    }

    if (!Number.isFinite(params.m1) || params.m1 <= 0) {
      errors.push({ code: 'not_positive', param: 'm1', message: `Длина m1 должна быть больше нуля: ${params.m1}` });
    }

    if (errors.length === 0) {
      const { x1, x2, x3L, x3R } = this.layout(params);
      // Гладкий участок нулевой длины считается ошибкой.
      if (x3L <= 0 || x3R <= 0) {
        const min = 2 * Math.max(x1, x2);
        errors.push({ code: 'too_short', param: 'm1', message: `Длина m1 должна быть больше ${(min * 1000).toFixed(1)} мм` });
      }
    }

    return errors;
  }

  build(params: SteelCouplingParams): GeneratedModel {
    const errors = this.validate(params);
    if (errors.length > 0) throw new GeneratorParamsError(this.id, errors);

    const { d1, d2, x1, x2, x3L, x3R, x4 } = this.layout(params);
    const threadMaterials = { inner: THREAD };
    const at = (x: number) => ({ x, y: 0, z: 0 });

    const merger = new MaterialGroupMerger();
    merger.add(
      // Кольцо слева
      ...this.sleeves.build({ length: x4, outerDiameter: d1.n + RING_OUTER_EXTRA, innerDiameter: d1.v + RING_INNER_EXTRA, center: at(-(x3L + x1)) }),
      // Резьба и гладкая часть слева
      ...this.sleeves.build({ length: x1, outerDiameter: d1.n, innerDiameter: d1.v, center: at(-(x3L + x1 / 2)), materials: threadMaterials }),
      ...this.sleeves.build({ length: x3L, outerDiameter: d1.n, innerDiameter: d1.v, center: at(-x3L / 2) }),
      // Центр
      ...this.sleeves.build({ length: x4, outerDiameter: Math.max(d1.n, d2.n), innerDiameter: Math.min(d1.v, d2.v) }),
      // Гладкая часть и резьба справа
      ...this.sleeves.build({ length: x3R, outerDiameter: d2.n, innerDiameter: d2.v, center: at(x3R / 2) }),
      ...this.sleeves.build({ length: x2, outerDiameter: d2.n, innerDiameter: d2.v, center: at(x3R + x2 / 2), materials: threadMaterials }),
      // Кольцо справа; в gl2 стоит в x_3L + x_1, что равно m1/2 = x_3R + x_2
      ...this.sleeves.build({ length: x4, outerDiameter: d2.n + RING_OUTER_EXTRA, innerDiameter: d2.v + RING_INNER_EXTRA, center: at(x3R + x2) }),
    );

    const geometry = merger.merge();
    geometry.computeBoundingBox();
    const bounds = new Box3().copy(geometry.boundingBox!);

    const mesh = new Mesh(geometry, [this.materials.get('metal'), this.materials.get('thread')]);
    const root = new Group();
    root.name = params.r1 === params.r2 ? `Муфта ${params.r1}(в)` : `Муфта ${params.r1}(в)х${params.r2}(в)`;
    root.add(mesh);

    // Разъёмы в центре резьбовых участков, как cr_CenterPoint в gl2.
    const connectors: Connector[] = [
      { id: 'left', position: at(-(x3L + x1 / 2)), direction: { x: -1, y: 0, z: 0 }, nominal: params.r1, joint: 'thread', gender: 'internal' },
      { id: 'right', position: at(x3R + x2 / 2), direction: { x: 1, y: 0, z: 0 }, nominal: params.r2, joint: 'thread', gender: 'internal' },
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

  /** Вызывать только для параметров с известными номиналами. */
  private layout(params: SteelCouplingParams): CouplingLayout {
    const d1 = ThreadSizes.diameters(params.r1, 'internal')!;
    const d2 = ThreadSizes.diameters(params.r2, 'internal')!;

    const x1 = Math.max(0.015 * d1.n * 20, MIN_THREAD_LENGTH);
    const x2 = Math.max(0.015 * d2.n * 20, MIN_THREAD_LENGTH);

    return {
      d1,
      d2,
      x1,
      x2,
      x3L: params.m1 / 2 - x1,
      x3R: params.m1 / 2 - x2,
      x4: Math.max(d1.n, d2.n) / 7,
    };
  }
}
