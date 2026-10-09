import { BaseGenerator } from '../../core/BaseGenerator';
import { connector } from '../../core/connector';
import { ConnectorFrame } from '../../core/ConnectorFrame';
import type { Connector, GeneratedModel, ParamSpec, ThreadGender, ValidationError } from '../../core/contracts';
import { createMeshModel } from '../../core/MeshModel';
import { MaterialGroupMerger } from '../../geometry/MaterialGroupMerger';
import { sleeves } from '../../geometry/SleeveGeometryBuilder';
import { ParamSchema } from '../../params/ParamSchema';
import { specs } from '../../params/specs';
import { ThreadSizes } from '../../sizes/ThreadSizes';
import { MANIFOLD_RING_GAP, MANIFOLD_THREAD, SteelManifoldPipe } from './SteelManifoldPipe';

export interface SteelManifoldParams {
  /** Резьба выходов. */
  threadGender: ThreadGender;
  /** Номинал резьбы концов трубы (слева внутренняя, справа наружная), например '1'. */
  nominal: string;
  /** Номинал резьбы выходов. */
  outletNominal: string;
  /** Число выходов. */
  outlets: number;
  /** Длина трубы, м. */
  length: number;
  /** Высота выхода от оси трубы до конца резьбы, м. */
  branchLength: number;
}

/**
 * Стальной коллектор с N выходами вверх (перенос st_collector_1). Выходы — с шагом 36 мм
 * по центру трубы; труба и выходы слиты в один меш.
 */
export class SteelManifoldGenerator extends BaseGenerator<SteelManifoldParams> {
  readonly id = 'steel.manifold';
  readonly version = 1;
  readonly title = 'Коллектор стальной';
  readonly paramSpecs: readonly ParamSpec[] = [
    specs.threadGender('threadGender', 'Резьба выходов'),
    specs.threadNominal('nominal', 'Резьба трубы'),
    specs.threadNominal('outletNominal', 'Резьба выходов'),
    { kind: 'integer', key: 'outlets', label: 'Выходов', min: 1, max: 10 },
    specs.length('length', 'Длина', { max: 0.5 }),
    specs.length('branchLength', 'Высота выхода'),
  ];
  readonly defaults: SteelManifoldParams = {
    threadGender: 'external',
    nominal: '3/4',
    outletNominal: '1/2',
    outlets: 2,
    length: 0.095,
    branchLength: 0.036,
  };

  private readonly pipe = new SteelManifoldPipe();

  protected override relations(params: SteelManifoldParams): ValidationError[] {
    const errors: ValidationError[] = [];
    // Участки трубы и выхода до резьбы (s1, s2 в gl2) были бы нулевой или отрицательной длины.
    if (params.length / 2 <= MANIFOLD_THREAD) errors.push(ParamSchema.tooShort('length', 2 * MANIFOLD_THREAD));
    if (params.branchLength <= MANIFOLD_THREAD) errors.push(ParamSchema.tooShort('branchLength', MANIFOLD_THREAD));
    return errors;
  }

  protected create(params: SteelManifoldParams): GeneratedModel {
    const internal = params.threadGender === 'internal';
    const d1 = ThreadSizes.require(params.nominal, 'internal');
    const d2 = ThreadSizes.require(params.outletNominal, internal ? 'internal' : 'external');
    const d3 = ThreadSizes.require(params.nominal, 'external');
    const dc = [d1, d2, d3].reduce((max, d) => (d.n > max.n ? d : max));
    const w = MANIFOLD_THREAD;
    const s2 = params.branchLength - w;
    // Ширина кольца выхода — по левой резьбе трубы, как в gl2.
    const ring = d1.n / 10;
    const ringY = internal ? s2 + w - ring / 2 : s2 + ring / 2;
    const vertical = { x: 0, y: Math.PI, z: Math.PI / 2 };
    const outlets = SteelManifoldPipe.outletPositions(params.outlets);

    const merger = new MaterialGroupMerger();
    merger.add(...this.pipe.build(params.length, d1, d3, dc));
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
        ...sleeves.build({ material: 'metal', length: ring, outerDiameter: d2.n + ring, innerDiameter: d2.v + MANIFOLD_RING_GAP, rotation: vertical, center: { x, y: ringY, z: 0 } }),
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
      title: `коллектор ${params.nominal}x${params.outletNominal}${suffix} [${params.outlets} вых.]`,
      ...merger.merge(),
      connectors: SteelManifoldPipe.connectors(
        params.length,
        params.nominal,
        outlets.map(
          (x, i): Connector => (connector(`outlet-${i + 1}`, ConnectorFrame.top, { x, y: params.branchLength, z: 0 }, { depth: internal ? w : w - ring, nominal: params.outletNominal, joint: 'thread', gender: internal ? 'internal' : 'external' })),
        ),
      ),
    });
  }
}
