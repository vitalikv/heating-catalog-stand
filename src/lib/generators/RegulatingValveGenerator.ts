import type { GeneratedModel, ModelGenerator, ParamSpec, ValidationError } from '../contracts';
import { GeneratorParamsError } from '../GeneratorParamsError';
import { ExtrudedShapeBuilder } from '../geometry/ExtrudedShapeBuilder';
import { MaterialGroupMerger } from '../geometry/MaterialGroupMerger';
import { SleeveGeometryBuilder } from '../geometry/SleeveGeometryBuilder';
import type { MaterialLibrary } from '../materials/MaterialLibrary';
import { ParamSchema } from '../params/ParamSchema';
import { ThreadSizes } from '../sizes/ThreadSizes';
import { BallValveParts, VALVE_MATERIALS, VALVE_NUT_SCALE } from './BallValveParts';
import { ConnectorFrame } from './ConnectorFrame';
import { MeshModel } from './MeshModel';

/** Головка крана: cap — колпачок (кран регулировочный), termo — терморегулятор (клапан). */
export type RegulatingValveHead = 'cap' | 'termo';

/**
 * Параметры в формате cdm из gl2, кроме головки: в gl2 это `termoreg: true` или его отсутствие,
 * здесь — выбор head, чтобы обойтись видами параметров контракта.
 */
export interface RegulatingValveParams {
  /** Номинал внутренней резьбы слева и наружной резьбы сгона, например '1/2'. */
  r1: string;
  /** Номинал наружной резьбы справа на кране и накидной гайки сгона, например '3/4'. */
  r2: string;
  /** Длина крана без сгона, м. */
  m1: number;
  /** Длина сгона, м. */
  m2: number;
  head: RegulatingValveHead;
}

/** Переходные участки корпуса слева и справа (x_1L, x_1R в gl2), м. */
const STEP = 0.002;
/** Индекс материала головки: white_1_edge в gl2. */
const PLASTIC_FLAT = 4;

/**
 * Кран регулировочный и клапан с терморегулятором (перенос reg_kran_primoy_1): слева внутренняя
 * резьба r1 под гайкой, справа наружная r2 со сгоном на r1, сверху шток с колпачком или терморегулятором.
 */
export class RegulatingValveGenerator implements ModelGenerator<RegulatingValveParams> {
  readonly id = 'reg_kran_primoy_1';
  readonly title = 'Кран регулировочный / с терморегулятором';
  readonly paramSpecs: readonly ParamSpec[] = [
    { kind: 'choice', key: 'head', label: 'Головка', options: ['cap', 'termo'], optionLabels: { cap: 'колпачок', termo: 'терморегулятор' } },
    { kind: 'choice', key: 'r1', label: 'Резьба', options: ThreadSizes.nominals },
    { kind: 'choice', key: 'r2', label: 'Резьба гайки сгона', options: ThreadSizes.nominals },
    { kind: 'length', key: 'm1', label: 'Длина крана', min: 0.001, max: 0.3, step: 0.0005 },
    { kind: 'length', key: 'm2', label: 'Длина сгона', min: 0.001, max: 0.2, step: 0.0005 },
  ];

  private readonly sleeves = new SleeveGeometryBuilder();
  private readonly parts = new BallValveParts(this.sleeves, new ExtrudedShapeBuilder());

  constructor(private readonly materials: MaterialLibrary) {}

  validate(params: RegulatingValveParams): ValidationError[] {
    const errors = ParamSchema.validate(this.paramSpecs, params);
    if (errors.length === 0) {
      // Средняя часть корпуса (x_2 в gl2) и гладкий участок сгона были бы нулевой или отрицательной длины.
      const x1 = BallValveParts.threadLength(ThreadSizes.diameters(params.r1, 'internal')!);
      const minimum = 4 * STEP + 2 * x1;
      if (params.m1 <= minimum) errors.push(ParamSchema.tooShort('m1', minimum));
      const union = BallValveParts.unionPipeLength(params.r1, params.m2);
      if (union <= 0) errors.push(ParamSchema.tooShort('m2', params.m2 - union));
    }
    return errors;
  }

  build(params: RegulatingValveParams): GeneratedModel {
    const errors = this.validate(params);
    if (errors.length > 0) throw new GeneratorParamsError(this.id, errors);

    const { thread, metalFlat } = VALVE_MATERIALS;
    const d1 = ThreadSizes.diameters(params.r1, 'internal')!;
    const d2 = ThreadSizes.diameters(params.r2, 'external')!;
    const x1 = BallValveParts.threadLength(d1);
    const x2 = params.m1 - (4 * STEP + 2 * x1);
    const half = x2 / 2;
    const bore = d1.v + 0.001;
    const at = (x: number) => ({ x, y: 0, z: 0 });
    const flipped = { x: 0, y: Math.PI, z: 0 };
    // Сгон: гайка r2 на резьбе крана, со сдвигом на 0,1 её длины.
    const union = this.parts.union(params.r2, params.r1, params.m2, half + 1.5 * STEP + x1 * 0.1);

    const merger = new MaterialGroupMerger();
    merger.add(
      // Слева: гайка с внутренней резьбой и переход к корпусу
      ...this.sleeves.build({
        length: x1,
        outerDiameter: d1.n * VALVE_NUT_SCALE * 1.1,
        innerDiameter: bore,
        outerSegments: 6,
        center: at(-(half + 2 * STEP + x1 / 2)),
        materials: { outer: metalFlat },
      }),
      ...this.sleeves.build({ length: x1, outerDiameter: d1.n, innerDiameter: d1.v, center: at(-(half + 2 * STEP + x1 / 2)), materials: { inner: thread } }),
      ...this.sleeves.build({
        length: STEP,
        outerDiameter: d1.v + 0.003,
        innerDiameter: d1.v,
        outerDiameterStart: bore,
        innerDiameterStart: d1.v,
        rotation: flipped,
        center: at(-(half + 1.5 * STEP)),
      }),
      ...this.sleeves.build({ length: STEP, outerDiameter: bore, innerDiameter: d1.v, center: at(-(half + STEP / 2)) }),
      // Корпус и переход к наружной резьбе
      ...this.sleeves.build({ length: x2, outerDiameter: bore, innerDiameter: d1.v }),
      ...this.sleeves.build({
        length: STEP,
        outerDiameter: bore,
        innerDiameter: d1.v,
        outerDiameterStart: d2.n,
        innerDiameterStart: d1.v,
        rotation: flipped,
        center: at(half + STEP / 2),
      }),
      ...this.sleeves.build({ length: STEP, outerDiameter: d2.n, innerDiameter: d1.v, center: at(half + 1.5 * STEP) }),
      ...this.sleeves.build({ length: x1, outerDiameter: d2.n, innerDiameter: d2.v, center: at(half + 2 * STEP + x1 / 2), materials: { outer: thread } }),
      ...union.parts,
      ...this.head(d1.n, params.head),
    );

    // Слева — торец крана, глубина — резьба. Справа — конец резьбы сгона, глубина — вся его резьба.
    // В gl2 точки стояли в центрах резьбы крана и концевой резьбы сгона.
    const common = { nominal: params.r1, joint: 'thread' } as const;
    return MeshModel.create({
      title: `${params.head === 'termo' ? 'Клапан с терморегулятором' : 'Кран регулировочный'} ${params.r1}`,
      geometry: merger.merge(),
      materials: [
        this.materials.get('metal'),
        this.materials.get('thread'),
        this.materials.get('metalFlat'),
        this.materials.get('red'),
        this.materials.get('plasticFlat'),
      ],
      connectors: [
        { id: 'left', position: at(-params.m1 / 2), ...ConnectorFrame.left, depth: x1, gender: 'internal', ...common },
        { id: 'right', position: at(union.end), ...ConnectorFrame.right, depth: union.threadLength, gender: 'external', ...common },
      ],
    });
  }

  /** Шток над корпусом и головка: колпачок или терморегулятор (16 граней). */
  private head(n: number, head: RegulatingValveHead) {
    const h1 = n / 2 + 0.008;
    const up = { x: 0, y: 0, z: -Math.PI / 2 };
    const at = (y: number) => ({ x: 0, y, z: 0 });
    const all = (index: number) => ({ outer: index, inner: index, start: index, end: index });
    const solid = { innerDiameter: 0, rotation: up };

    const stem = this.sleeves.build({ ...solid, length: h1, outerDiameter: 0.015, center: at(h1 / 2) });
    if (head === 'termo') {
      const cap = 0.01;
      return [
        ...stem,
        ...this.sleeves.build({ ...solid, length: 0.006, outerDiameter: 0.02, outerSegments: 16, center: at(h1 + 0.003), materials: all(VALVE_MATERIALS.metalFlat) }),
        ...this.sleeves.build({ ...solid, length: cap, outerDiameter: 0.035, outerSegments: 16, center: at(h1 + 0.006 + cap / 2), materials: all(PLASTIC_FLAT) }),
        ...this.sleeves.build({
          ...solid,
          length: 0.035,
          outerDiameter: 0.032,
          outerDiameterStart: 0.024,
          outerSegments: 16,
          center: at(h1 + 0.006 + cap + 0.035 / 2),
          materials: all(PLASTIC_FLAT),
        }),
      ];
    }
    const cap = 0.02;
    return [
      ...stem,
      ...this.sleeves.build({ ...solid, length: 0.002, outerDiameter: 0.017, center: at(h1 + 0.001) }),
      ...this.sleeves.build({ ...solid, length: cap, outerDiameter: 0.024, outerSegments: 16, center: at(h1 + 0.002 + cap / 2), materials: all(PLASTIC_FLAT) }),
    ];
  }
}
