import type { Connector, GeneratedModel, ModelGenerator, ParamSpec, ValidationError } from '../contracts';
import { GeneratorParamsError } from '../GeneratorParamsError';
import { ExtrudedShapeBuilder } from '../geometry/ExtrudedShapeBuilder';
import { MaterialGroupMerger } from '../geometry/MaterialGroupMerger';
import type { GeometryPart } from '../geometry/MaterialGroupMerger';
import { SleeveGeometryBuilder } from '../geometry/SleeveGeometryBuilder';
import type { MaterialLibrary } from '../materials/MaterialLibrary';
import { ParamSchema } from '../params/ParamSchema';
import { ThreadSizes } from '../sizes/ThreadSizes';
import type { PartDiameters } from '../sizes/ThreadSizes';
import { BallValveParts, VALVE_BODY_STEP, VALVE_MATERIALS, VALVE_NUT_SCALE } from './BallValveParts';
import { ConnectorFrame } from './ConnectorFrame';
import { MeshModel } from './MeshModel';

/** Концы крана: в-в, н-н, в-н (shar_kran_v_1, shar_kran_n_1, shar_kran_v_n_1). */
export type BallValveEnds = 'v' | 'n' | 'v_n';

/** Параметры в формате cdm из gl2. */
export interface BallValveParams {
  /** Дюймовый номинал резьбы обоих концов, например '1/2'. */
  r1: string;
  /** Длина крана, м. */
  m1: number;
  /** Длина ручки-бабочки, м. */
  t1: number;
}

const VARIANTS: Record<BallValveEnds, { id: string; title: string; suffix: string; right: 'internal' | 'external' }> = {
  v: { id: 'shar_kran_v_1', title: 'Кран шаровой (в-в)', suffix: '(в-в)', right: 'internal' },
  n: { id: 'shar_kran_n_1', title: 'Кран шаровой (н-н)', suffix: '(н-н)', right: 'external' },
  v_n: { id: 'shar_kran_v_n_1', title: 'Кран шаровой (в-н)', suffix: '(в-н)', right: 'external' },
};

/**
 * Шаровой кран с резьбой на обоих концах (перенос shar_kran_v_1, shar_kran_n_1, shar_kran_v_n_1).
 * Один класс на три функции gl2: они отличаются только концами. Внутренняя резьба — под
 * шестигранной гайкой той же длины, наружная — снаружи, за гайкой длиной 0,2 n.
 * Шток и ручка — вверх (+Y), часть общего меша.
 */
export class BallValveGenerator implements ModelGenerator<BallValveParams> {
  readonly id: string;
  readonly title: string;
  readonly paramSpecs: readonly ParamSpec[] = [
    { kind: 'choice', key: 'r1', label: 'Резьба', options: ThreadSizes.nominals },
    { kind: 'length', key: 'm1', label: 'Длина', min: 0.001, max: 0.3, step: 0.0005 },
    { kind: 'length', key: 't1', label: 'Ручка', min: 0.01, max: 0.2, step: 0.001 },
  ];

  private readonly sleeves = new SleeveGeometryBuilder();
  private readonly parts = new BallValveParts(this.sleeves, new ExtrudedShapeBuilder());

  constructor(
    private readonly materials: MaterialLibrary,
    private readonly ends: BallValveEnds,
  ) {
    this.id = VARIANTS[ends].id;
    this.title = VARIANTS[ends].title;
  }

  validate(params: BallValveParams): ValidationError[] {
    const errors = ParamSchema.validate(this.paramSpecs, params);
    if (errors.length === 0) {
      // Правая часть корпуса (x_2R в gl2) была бы нулевой или отрицательной длины.
      const minimum = 2 * (VALVE_BODY_STEP + this.endLength(this.body(params.r1), VARIANTS[this.ends].right));
      if (params.m1 <= minimum) errors.push(ParamSchema.tooShort('m1', minimum));
    }
    return errors;
  }

  build(params: BallValveParams): GeneratedModel {
    const errors = this.validate(params);
    if (errors.length > 0) throw new GeneratorParamsError(this.id, errors);

    const variant = VARIANTS[this.ends];
    const left = this.ends === 'n' ? 'external' : 'internal';
    const d = this.body(params.r1);
    const half = params.m1 / 2;
    const x1 = BallValveParts.threadLength(d);

    const merger = new MaterialGroupMerger();
    merger.add(
      ...this.end(params.r1, d, left, -1, half),
      ...this.parts.body(d, half - this.endLength(d, left), half - VALVE_BODY_STEP - this.endLength(d, variant.right)),
      ...this.parts.stemAndHandle(d, params.t1),
      ...this.end(params.r1, d, variant.right, 1, half),
    );

    // Торцы — концы крана (±m1/2), глубина — длина резьбы. В gl2 точки — в центрах резьбы.
    const common = { depth: x1, nominal: params.r1, joint: 'thread' } as const;
    const connectors: Connector[] = [
      { id: 'left', position: ConnectorFrame.point(ConnectorFrame.left, half), ...ConnectorFrame.left, gender: left, ...common },
      { id: 'right', position: ConnectorFrame.point(ConnectorFrame.right, half), ...ConnectorFrame.right, gender: variant.right, ...common },
    ];
    return MeshModel.create({
      title: `Шаровой кран ${params.r1}${variant.suffix}`,
      geometry: merger.merge(),
      materials: [this.materials.get('metal'), this.materials.get('thread'), this.materials.get('metalFlat'), this.materials.get('red')],
      connectors,
    });
  }

  /** Диаметры корпуса: у крана н-н — по наружной резьбе, иначе по внутренней. */
  private body(nominal: string): PartDiameters {
    return ThreadSizes.diameters(nominal, this.ends === 'n' ? 'external' : 'internal')!;
  }

  /** Длина конца от торца до корпуса: резьба, у наружной — ещё гайка 0,2 n. */
  private endLength(d: PartDiameters, gender: 'internal' | 'external'): number {
    return BallValveParts.threadLength(d) + (gender === 'external' ? 0.01 * d.n * 20 : 0);
  }

  /** Конец крана со стороны side (−1 — слева, 1 — справа); гайка — по диаметрам корпуса d. */
  private end(nominal: string, d: PartDiameters, gender: 'internal' | 'external', side: number, half: number): GeometryPart[] {
    const { thread, metalFlat } = VALVE_MATERIALS;
    const x1 = BallValveParts.threadLength(d);
    const at = (x: number) => ({ x: side * x, y: 0, z: 0 });
    const nut = { outerDiameter: d.n * VALVE_NUT_SCALE, innerDiameter: d.v + 0.001, outerSegments: 6, materials: { outer: metalFlat } };

    if (gender === 'internal') {
      return [
        ...this.sleeves.build({ ...nut, length: x1, center: at(half - x1 / 2) }),
        ...this.sleeves.build({ length: x1, outerDiameter: d.n, innerDiameter: d.v, center: at(half - x1 / 2), materials: { inner: thread } }),
      ];
    }
    const x2 = 0.01 * d.n * 20;
    const external = ThreadSizes.diameters(nominal, 'external')!;
    return [
      ...this.sleeves.build({ length: x1, outerDiameter: external.n, innerDiameter: external.v, center: at(half - x1 / 2), materials: { outer: thread } }),
      ...this.sleeves.build({ ...nut, length: x2, center: at(half - x1 - x2 / 2) }),
    ];
  }
}
