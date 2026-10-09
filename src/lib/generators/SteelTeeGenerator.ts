import type { GeneratedModel, ModelGenerator, ParamSpec, ValidationError } from '../contracts';
import { GeneratorParamsError } from '../GeneratorParamsError';
import { MaterialGroupMerger } from '../geometry/MaterialGroupMerger';
import { SleeveGeometryBuilder } from '../geometry/SleeveGeometryBuilder';
import type { SleeveOptions } from '../geometry/SleeveGeometryBuilder';
import type { MaterialLibrary } from '../materials/MaterialLibrary';
import { ParamSchema } from '../params/ParamSchema';
import { ThreadSizes } from '../sizes/ThreadSizes';
import type { PartDiameters } from '../sizes/ThreadSizes';
import { ConnectorFrame } from './ConnectorFrame';
import type { ThreadSideCode } from './SteelElbowGenerator';
import { MeshModel } from './MeshModel';

/** Параметры в формате cdm из gl2. */
export interface SteelTeeParams {
  side: ThreadSideCode;
  /** Номиналы резьбы: слева, вверху (отвод), справа. */
  r1: string;
  r2: string;
  r3: string;
  /** Длина прохода (слева направо), м. */
  m1: number;
  /** Высота отвода от оси прохода до конца резьбы, м. */
  m2: number;
}

/** Длина резьбы на каждом выходе (w1, w2, w3 в gl2), м. */
const THREAD_LENGTH = 0.015;
/** Зазор кольца по внутреннему диаметру (kf в gl2), м. */
const RING_GAP = 0.0001;

const THREAD = 1;

/**
 * Стальной тройник с резьбой (перенос st_troinik_1). Проход по X, отвод по +Y;
 * участки от центра к выходам — конусы от наибольшего номинала к номиналу выхода.
 */
export class SteelTeeGenerator implements ModelGenerator<SteelTeeParams> {
  readonly id = 'st_troinik_1';
  readonly title = 'Тройник стальной';
  readonly paramSpecs: readonly ParamSpec[] = [
    { kind: 'choice', key: 'side', label: 'Резьба', options: ['v', 'n'], optionLabels: { v: 'внутренняя', n: 'наружная' } },
    { kind: 'choice', key: 'r1', label: 'Слева', options: ThreadSizes.nominals },
    { kind: 'choice', key: 'r2', label: 'Отвод', options: ThreadSizes.nominals },
    { kind: 'choice', key: 'r3', label: 'Справа', options: ThreadSizes.nominals },
    { kind: 'length', key: 'm1', label: 'Длина прохода', min: 0.001, max: 0.3, step: 0.0005 },
    { kind: 'length', key: 'm2', label: 'Высота отвода', min: 0.001, max: 0.2, step: 0.0005 },
  ];

  private readonly sleeves = new SleeveGeometryBuilder();

  constructor(private readonly materials: MaterialLibrary) {}

  validate(params: SteelTeeParams): ValidationError[] {
    const errors = ParamSchema.validate(this.paramSpecs, params);
    if (errors.length === 0) {
      // Участки от центра до резьбы (s1, s2 в gl2) были бы нулевой или отрицательной длины.
      if (params.m1 / 2 <= THREAD_LENGTH) errors.push(ParamSchema.tooShort('m1', 2 * THREAD_LENGTH));
      if (params.m2 <= THREAD_LENGTH) errors.push(ParamSchema.tooShort('m2', THREAD_LENGTH));
    }
    return errors;
  }

  build(params: SteelTeeParams): GeneratedModel {
    const errors = this.validate(params);
    if (errors.length > 0) throw new GeneratorParamsError(this.id, errors);

    const internal = params.side === 'v';
    const sizeOf = (nominal: string) => ThreadSizes.diameters(nominal, internal ? 'internal' : 'external')!;
    const d1 = sizeOf(params.r1);
    const d2 = sizeOf(params.r2);
    const d3 = sizeOf(params.r3);
    const dc = [d1, d2, d3].reduce((max, d) => (d.n > max.n ? d : max));
    const w = THREAD_LENGTH;
    // В gl2 ширина всех трёх колец считается по левому выходу.
    const ring = d1.n / 10;
    const thread = internal ? { inner: THREAD } : { outer: THREAD };
    // Внутренняя резьба: кольцо у торца внутри резьбы; наружная — у начала резьбы.
    const ringOffset = (s: number) => (internal ? s + w - ring / 2 : s + ring / 2);

    /** Выход от центра: конус dc → d, кольцо, резьба. Строится вдоль +X и поворачивается. */
    const outlet = (d: PartDiameters, s: number, place: (offset: number) => Partial<SleeveOptions>, cone: Partial<SleeveOptions>): SleeveOptions[] => [
      { ...cone, length: s, outerDiameter: dc.n, innerDiameter: dc.v, outerDiameterStart: d.n, innerDiameterStart: d.v },
      { ...place(ringOffset(s)), length: ring, outerDiameter: d.n + ring, innerDiameter: d.v + RING_GAP },
      { ...place(s + w / 2), length: w, outerDiameter: d.n, innerDiameter: d.v, materials: thread },
    ];

    const s1 = params.m1 / 2 - w;
    const s2 = params.m2 - w;
    const s3 = params.m1 / 2 - w;
    const up = { rotation: { x: 0, y: Math.PI, z: Math.PI / 2 } };
    const sleeves = [
      ...outlet(d1, s1, (x) => ({ center: { x: -x, y: 0, z: 0 } }), { center: { x: -s1 / 2, y: 0, z: 0 } }),
      ...outlet(d3, s3, (x) => ({ center: { x, y: 0, z: 0 } }), { center: { x: s3 / 2, y: 0, z: 0 }, rotation: { x: 0, y: Math.PI, z: 0 } }),
      ...outlet(d2, s2, (y) => ({ ...up, center: { x: 0, y, z: 0 } }), { center: { x: 0, y: s2 / 2, z: 0 }, rotation: { x: 0, y: 0, z: -Math.PI / 2 } }),
    ];

    const merger = new MaterialGroupMerger();
    for (const sleeve of sleeves) merger.add(...this.sleeves.build(sleeve));

    // Торцы — концы резьбы; глубина — резьба (у наружной — без кольца у её начала).
    // В gl2 точки стояли в центрах резьбы. ID — по стороне выхода.
    const common = { depth: internal ? w : w - ring, joint: 'thread', gender: internal ? 'internal' : 'external' } as const;
    const suffix = internal ? '(в)' : '(н)';
    const [n1, n2, n3] = [params.r1, params.r2, params.r3].map((r) => r + suffix);
    const { left, top, right } = ConnectorFrame;
    return MeshModel.create({
      title: n1 === n2 && n1 === n3 ? `Тройник ${n1}` : `Тройник ${n1}x${n2}x${n3}`,
      geometry: merger.merge(),
      materials: [this.materials.get('metal'), this.materials.get('thread')],
      connectors: [
        { id: 'left', position: ConnectorFrame.point(left, params.m1 / 2), ...left, nominal: params.r1, ...common },
        { id: 'top', position: ConnectorFrame.point(top, params.m2), ...top, nominal: params.r2, ...common },
        { id: 'right', position: ConnectorFrame.point(right, params.m1 / 2), ...right, nominal: params.r3, ...common },
      ],
    });
  }
}
