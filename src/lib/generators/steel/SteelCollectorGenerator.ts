import { BaseGenerator } from '../../core/BaseGenerator';
import { connector } from '../../core/connector';
import { ConnectorFrame } from '../../core/ConnectorFrame';
import type { Connector, GeneratedModel, ParamSpec, ValidationError } from '../../core/contracts';
import { createMeshModel } from '../../core/MeshModel';
import { MaterialGroupMerger } from '../../geometry/MaterialGroupMerger';
import { sleeves } from '../../geometry/SleeveGeometryBuilder';
import { ParamSchema } from '../../params/ParamSchema';
import { specs } from '../../params/specs';
import type { ThreadSideCode } from '../../params/specs';
import { ThreadSizes } from '../../sizes/ThreadSizes';
import { COLLECTOR_RING_GAP, COLLECTOR_THREAD, SteelCollectorPipe } from './SteelCollectorPipe';

/** Параметры в формате cdm из gl2. */
export interface SteelCollectorParams {
  /** Резьба выходов: 'v' — внутренняя, 'n' — наружная. */
  side: ThreadSideCode;
  /** Номинал резьбы концов трубы (слева внутренняя, справа наружная), например '1'. */
  r1: string;
  /** Номинал резьбы выходов. */
  r2: string;
  /** Число выходов. */
  count: number;
  /** Длина трубы, м. */
  m1: number;
  /** Высота выхода от оси трубы до конца резьбы, м. */
  m2: number;
}

/**
 * Стальной коллектор с N выходами вверх (перенос st_collector_1). Выходы — с шагом 36 мм
 * по центру трубы; труба и выходы слиты в один меш.
 */
export class SteelCollectorGenerator extends BaseGenerator<SteelCollectorParams> {
  readonly id = 'st_collector_1';
  readonly title = 'Коллектор стальной';
  readonly paramSpecs: readonly ParamSpec[] = [
    { kind: 'choice', key: 'side', label: 'Резьба выходов', options: ['v', 'n'], optionLabels: { v: 'внутренняя', n: 'наружная' } },
    specs.threadNominal('r1', 'Резьба трубы'),
    specs.threadNominal('r2', 'Резьба выходов'),
    { kind: 'integer', key: 'count', label: 'Выходов', min: 1, max: 10 },
    specs.length('m1', 'Длина', { max: 0.5 }),
    specs.length('m2', 'Высота выхода'),
  ];

  private readonly pipe = new SteelCollectorPipe();

  protected override relations(params: SteelCollectorParams): ValidationError[] {
    const errors: ValidationError[] = [];
    // Участки трубы и выхода до резьбы (s1, s2 в gl2) были бы нулевой или отрицательной длины.
    if (params.m1 / 2 <= COLLECTOR_THREAD) errors.push(ParamSchema.tooShort('m1', 2 * COLLECTOR_THREAD));
    if (params.m2 <= COLLECTOR_THREAD) errors.push(ParamSchema.tooShort('m2', COLLECTOR_THREAD));
    return errors;
  }

  protected create(params: SteelCollectorParams): GeneratedModel {
    const internal = params.side === 'v';
    const d1 = ThreadSizes.require(params.r1, 'internal');
    const d2 = ThreadSizes.require(params.r2, internal ? 'internal' : 'external');
    const d3 = ThreadSizes.require(params.r1, 'external');
    const dc = [d1, d2, d3].reduce((max, d) => (d.n > max.n ? d : max));
    const w = COLLECTOR_THREAD;
    const s2 = params.m2 - w;
    // Ширина кольца выхода — по левой резьбе трубы, как в gl2.
    const ring = d1.n / 10;
    const ringY = internal ? s2 + w - ring / 2 : s2 + ring / 2;
    const vertical = { x: 0, y: Math.PI, z: Math.PI / 2 };
    const outlets = SteelCollectorPipe.outletPositions(params.count);

    const merger = new MaterialGroupMerger();
    merger.add(...this.pipe.build(params.m1, d1, d3, dc));
    for (const x of outlets) {
      merger.add(
        ...sleeves.build({
          material: 'metal',
          length: s2,
          outerDiameter: dc.n,
          innerDiameter: dc.v,
          outerDiameterStart: d2.n,
          innerDiameterStart: d2.v,
          rotation: { x: 0, y: 0, z: -Math.PI / 2 },
          center: { x, y: s2 / 2, z: 0 },
        }),
        ...sleeves.build({ material: 'metal', length: ring, outerDiameter: d2.n + ring, innerDiameter: d2.v + COLLECTOR_RING_GAP, rotation: vertical, center: { x, y: ringY, z: 0 } }),
        ...sleeves.build({
          material: 'metal',
          length: w,
          outerDiameter: d2.n,
          innerDiameter: d2.v,
          rotation: vertical,
          center: { x, y: s2 + w / 2, z: 0 },
          materials: internal ? { inner: 'thread' } : { outer: 'thread' },
        }),
      );
    }

    const suffix = internal ? '(в)' : '(н)';
    return createMeshModel({
      title: `коллектор ${params.r1}x${params.r2}${suffix} [${params.count} вых.]`,
      ...merger.merge(),
      connectors: SteelCollectorPipe.connectors(
        params.m1,
        params.r1,
        outlets.map(
          (x, i): Connector => (connector(`outlet-${i + 1}`, ConnectorFrame.top, { x, y: params.m2, z: 0 }, { depth: internal ? w : w - ring, nominal: params.r2, joint: 'thread', gender: internal ? 'internal' : 'external' })),
        ),
      ),
    });
  }
}
