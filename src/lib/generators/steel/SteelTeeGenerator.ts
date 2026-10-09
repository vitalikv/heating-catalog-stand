import { BaseGenerator } from '../../core/BaseGenerator';
import { connector } from '../../core/connector';
import { ConnectorFrame } from '../../core/ConnectorFrame';
import type { GeneratedModel, ParamSpec, ThreadGender, ValidationError } from '../../core/contracts';
import { createMeshModel } from '../../core/MeshModel';
import { MaterialGroupMerger } from '../../geometry/MaterialGroupMerger';
import { sleeves } from '../../geometry/SleeveGeometryBuilder';
import type { SleeveMaterials, SleeveShape } from '../../geometry/SleeveGeometryBuilder';
import { ParamSchema } from '../../params/ParamSchema';
import { specs } from '../../params/specs';
import { ThreadSizes } from '../../sizes/ThreadSizes';
import type { PartDiameters } from '../../sizes/ThreadSizes';

export interface SteelTeeParams {
  threadGender: ThreadGender;
  /** Номиналы резьбы: слева, вверху (отвод), справа. */
  nominalLeft: string;
  nominalBranch: string;
  nominalRight: string;
  /** Длина прохода (слева направо), м. */
  length: number;
  /** Высота отвода от оси прохода до конца резьбы, м. */
  branchLength: number;
}

/** Длина резьбы на каждом выходе (w1, w2, w3 в gl2), м. */
const THREAD_LENGTH = 0.015;
/** Зазор кольца по внутреннему диаметру (kf в gl2), м. */
const RING_GAP = 0.0001;

/** Диаметры выходов слева, отвода и справа; dc — наибольший, к нему сходятся конусы. */
interface TeeLayout {
  d1: PartDiameters;
  d2: PartDiameters;
  d3: PartDiameters;
  dc: PartDiameters;
}

/**
 * Стальной тройник с резьбой (перенос st_troinik_1). Проход по X, отвод по +Y;
 * участки от центра к выходам — конусы от наибольшего номинала к номиналу выхода.
 */
export class SteelTeeGenerator extends BaseGenerator<SteelTeeParams, TeeLayout> {
  readonly id = 'steel.tee';
  readonly version = 1;
  readonly title = 'Тройник стальной';
  readonly paramSpecs: readonly ParamSpec[] = [
    specs.threadGender(),
    specs.threadNominal('nominalLeft', 'Слева'),
    specs.threadNominal('nominalBranch', 'Отвод'),
    specs.threadNominal('nominalRight', 'Справа'),
    specs.length('length', 'Длина прохода', { max: 0.3 }),
    specs.length('branchLength', 'Высота отвода'),
  ];
  readonly defaults: SteelTeeParams = {
    threadGender: 'internal',
    nominalLeft: '1/2',
    nominalBranch: '1/2',
    nominalRight: '1/2',
    length: 0.046,
    branchLength: 0.023,
  };

  protected override layout(params: SteelTeeParams): TeeLayout {
    const side = params.threadGender;
    const [d1, d2, d3] = [params.nominalLeft, params.nominalBranch, params.nominalRight].map((r) => ThreadSizes.require(r, side));
    return { d1, d2, d3, dc: [d1, d2, d3].reduce((max, d) => (d.n > max.n ? d : max)) };
  }

  protected override relations(params: SteelTeeParams): ValidationError[] {
    // Участки от центра до резьбы (s1, s2 в gl2) были бы нулевой или отрицательной длины.
    const errors: ValidationError[] = [];
    if (params.length / 2 <= THREAD_LENGTH) errors.push(ParamSchema.tooShort('length', 2 * THREAD_LENGTH));
    if (params.branchLength <= THREAD_LENGTH) errors.push(ParamSchema.tooShort('branchLength', THREAD_LENGTH));
    return errors;
  }

  protected create(params: SteelTeeParams, { d1, d2, d3, dc }: TeeLayout): GeneratedModel {
    const internal = params.threadGender === 'internal';
    const w = THREAD_LENGTH;
    // В gl2 ширина всех трёх колец считается по левому выходу.
    const ring = d1.n / 10;
    const thread: Partial<SleeveMaterials> = internal ? { inner: 'thread' } : { outer: 'thread' };
    // Внутренняя резьба: кольцо у торца внутри резьбы; наружная — у начала резьбы.
    const ringOffset = (s: number) => (internal ? s + w - ring / 2 : s + ring / 2);

    /** Выход от центра: конус dc → d, кольцо, резьба. Строится вдоль +X и поворачивается. */
    const outlet = (d: PartDiameters, s: number, place: (offset: number) => Partial<SleeveShape>, cone: Partial<SleeveShape>): SleeveShape[] => [
      { ...cone, length: s, outerDiameter: dc.n, innerDiameter: dc.v, outerDiameterStart: d.n, innerDiameterStart: d.v },
      { ...place(ringOffset(s)), length: ring, outerDiameter: d.n + ring, innerDiameter: d.v + RING_GAP },
      { ...place(s + w / 2), length: w, outerDiameter: d.n, innerDiameter: d.v, materials: thread },
    ];

    const s1 = params.length / 2 - w;
    const s2 = params.branchLength - w;
    const s3 = params.length / 2 - w;
    const up = { rotation: { x: 0, y: Math.PI, z: Math.PI / 2 } };
    const pieces = [
      ...outlet(d1, s1, (x) => ({ center: { x: -x, y: 0, z: 0 } }), { center: { x: -s1 / 2, y: 0, z: 0 } }),
      ...outlet(d3, s3, (x) => ({ center: { x, y: 0, z: 0 } }), { center: { x: s3 / 2, y: 0, z: 0 }, rotation: { x: 0, y: Math.PI, z: 0 } }),
      ...outlet(d2, s2, (y) => ({ ...up, center: { x: 0, y, z: 0 } }), { center: { x: 0, y: s2 / 2, z: 0 }, rotation: { x: 0, y: 0, z: -Math.PI / 2 } }),
    ];

    const merger = new MaterialGroupMerger();
    for (const sleeve of pieces) merger.add(...sleeves.build({ material: 'metal', ...sleeve }));

    // Торцы — концы резьбы; глубина — резьба (у наружной — без кольца у её начала).
    // В gl2 точки стояли в центрах резьбы. ID — по стороне выхода.
    const end = { depth: internal ? w : w - ring, joint: 'thread', gender: internal ? 'internal' : 'external' } as const;
    const suffix = internal ? '(в)' : '(н)';
    const [n1, n2, n3] = [params.nominalLeft, params.nominalBranch, params.nominalRight].map((r) => r + suffix);
    const { left, top, right } = ConnectorFrame;
    return createMeshModel({
      title: n1 === n2 && n1 === n3 ? `Тройник ${n1}` : `Тройник ${n1}x${n2}x${n3}`,
      ...merger.merge(),
      connectors: [
        connector('left', left, params.length / 2, { nominal: params.nominalLeft, ...end }),
        connector('top', top, params.branchLength, { nominal: params.nominalBranch, ...end }),
        connector('right', right, params.length / 2, { nominal: params.nominalRight, ...end }),
      ],
    });
  }
}
