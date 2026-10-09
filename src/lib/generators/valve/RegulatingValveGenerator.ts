import { BaseGenerator } from '../../core/BaseGenerator';
import { connector } from '../../core/connector';
import { ConnectorFrame } from '../../core/ConnectorFrame';
import type { GeneratedModel, ParamSpec, ValidationError } from '../../core/contracts';
import { createMeshModel } from '../../core/MeshModel';
import { MaterialGroupMerger } from '../../geometry/MaterialGroupMerger';
import { sleeves } from '../../geometry/SleeveGeometryBuilder';
import { ParamSchema } from '../../params/ParamSchema';
import { specs } from '../../params/specs';
import { ThreadSizes } from '../../sizes/ThreadSizes';
import { BallValveParts, VALVE_NUT_SCALE } from './BallValveParts';
import type { UnionValveLayout } from './BallValveParts';

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
/**
 * Кран регулировочный и клапан с терморегулятором (перенос reg_kran_primoy_1): слева внутренняя
 * резьба r1 под гайкой, справа наружная r2 со сгоном на r1, сверху шток с колпачком или терморегулятором.
 */
export class RegulatingValveGenerator extends BaseGenerator<RegulatingValveParams, UnionValveLayout> {
  readonly id = 'reg_kran_primoy_1';
  readonly title = 'Кран регулировочный / с терморегулятором';
  readonly paramSpecs: readonly ParamSpec[] = [
    { kind: 'choice', key: 'head', label: 'Головка', options: ['cap', 'termo'], optionLabels: { cap: 'колпачок', termo: 'терморегулятор' } },
    specs.threadNominal('r1', 'Резьба'),
    specs.threadNominal('r2', 'Резьба гайки сгона'),
    specs.length('m1', 'Длина крана', { max: 0.3 }),
    specs.length('m2', 'Длина сгона'),
  ];

  private readonly parts = new BallValveParts();

  protected override layout(params: RegulatingValveParams): UnionValveLayout {
    const d1 = ThreadSizes.require(params.r1, 'internal');
    return { d1, d2: ThreadSizes.require(params.r2, 'external'), x1: BallValveParts.threadLength(d1) };
  }

  protected override relations(params: RegulatingValveParams, { x1 }: UnionValveLayout): ValidationError[] {
    const errors: ValidationError[] = [];
    // Средняя часть корпуса (x_2 в gl2) и гладкий участок сгона были бы нулевой или отрицательной длины.
    const minimum = 4 * STEP + 2 * x1;
    if (params.m1 <= minimum) errors.push(ParamSchema.tooShort('m1', minimum));
    const union = BallValveParts.unionPipeLength(params.r1, params.m2);
    if (union <= 0) errors.push(ParamSchema.tooShort('m2', params.m2 - union));
    return errors;
  }

  protected create(params: RegulatingValveParams, { d1, d2, x1 }: UnionValveLayout): GeneratedModel {
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
      ...sleeves.build({
        material: 'metal',
        length: x1,
        outerDiameter: d1.n * VALVE_NUT_SCALE * 1.1,
        innerDiameter: bore,
        outerSegments: 6,
        center: at(-(half + 2 * STEP + x1 / 2)),
        materials: { outer: 'metalFlat' },
      }),
      ...sleeves.build({ material: 'metal', length: x1, outerDiameter: d1.n, innerDiameter: d1.v, center: at(-(half + 2 * STEP + x1 / 2)), materials: { inner: 'thread' } }),
      ...sleeves.build({
        material: 'metal',
        length: STEP,
        outerDiameter: d1.v + 0.003,
        innerDiameter: d1.v,
        outerDiameterStart: bore,
        innerDiameterStart: d1.v,
        rotation: flipped,
        center: at(-(half + 1.5 * STEP)),
      }),
      ...sleeves.build({ material: 'metal', length: STEP, outerDiameter: bore, innerDiameter: d1.v, center: at(-(half + STEP / 2)) }),
      // Корпус и переход к наружной резьбе
      ...sleeves.build({ material: 'metal', length: x2, outerDiameter: bore, innerDiameter: d1.v }),
      ...sleeves.build({
        material: 'metal',
        length: STEP,
        outerDiameter: bore,
        innerDiameter: d1.v,
        outerDiameterStart: d2.n,
        innerDiameterStart: d1.v,
        rotation: flipped,
        center: at(half + STEP / 2),
      }),
      ...sleeves.build({ material: 'metal', length: STEP, outerDiameter: d2.n, innerDiameter: d1.v, center: at(half + 1.5 * STEP) }),
      ...sleeves.build({ material: 'metal', length: x1, outerDiameter: d2.n, innerDiameter: d2.v, center: at(half + 2 * STEP + x1 / 2), materials: { outer: 'thread' } }),
      ...union.parts,
      ...this.head(d1.n, params.head),
    );

    // Слева — торец крана, глубина — резьба. Справа — конец резьбы сгона, глубина — вся его резьба.
    // В gl2 точки стояли в центрах резьбы крана и концевой резьбы сгона.
    const common = { nominal: params.r1, joint: 'thread' } as const;
    return createMeshModel({
      title: `${params.head === 'termo' ? 'Клапан с терморегулятором' : 'Кран регулировочный'} ${params.r1}`,
      ...merger.merge(),
      connectors: [
        connector('left', ConnectorFrame.left, params.m1 / 2, { depth: x1, gender: 'internal', ...common }),
        connector('right', ConnectorFrame.right, union.end, { depth: union.threadLength, gender: 'external', ...common }),
      ],
    });
  }

  /** Шток над корпусом и головка: колпачок или терморегулятор (16 граней). */
  private head(n: number, head: RegulatingValveHead) {
    const h1 = n / 2 + 0.008;
    const up = { x: 0, y: 0, z: -Math.PI / 2 };
    const at = (y: number) => ({ x: 0, y, z: 0 });
    const solid = { innerDiameter: 0, rotation: up };

    const stem = sleeves.build({ material: 'metal', ...solid, length: h1, outerDiameter: 0.015, center: at(h1 / 2) });
    if (head === 'termo') {
      const cap = 0.01;
      return [
        ...stem,
        ...sleeves.build({ ...solid, length: 0.006, outerDiameter: 0.02, outerSegments: 16, center: at(h1 + 0.003), material: 'metalFlat' }),
        ...sleeves.build({ ...solid, length: cap, outerDiameter: 0.035, outerSegments: 16, center: at(h1 + 0.006 + cap / 2), material: 'plasticFlat' }),
        ...sleeves.build({ ...solid,
          length: 0.035,
          outerDiameter: 0.032,
          outerDiameterStart: 0.024,
          outerSegments: 16,
          center: at(h1 + 0.006 + cap + 0.035 / 2),
          material: 'plasticFlat',
        }),
      ];
    }
    const cap = 0.02;
    return [
      ...stem,
      ...sleeves.build({ material: 'metal', ...solid, length: 0.002, outerDiameter: 0.017, center: at(h1 + 0.001) }),
      ...sleeves.build({ ...solid, length: cap, outerDiameter: 0.024, outerSegments: 16, center: at(h1 + 0.002 + cap / 2), material: 'plasticFlat' }),
    ];
  }
}
