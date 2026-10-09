import type { Connector, GeneratedModel, ModelGenerator, ParamSpec, ValidationError } from '../contracts';
import { GeneratorParamsError } from '../GeneratorParamsError';
import { MaterialGroupMerger } from '../geometry/MaterialGroupMerger';
import { SleeveGeometryBuilder } from '../geometry/SleeveGeometryBuilder';
import type { MaterialLibrary } from '../materials/MaterialLibrary';
import { ParamSchema } from '../params/ParamSchema';
import { ThreadSizes } from '../sizes/ThreadSizes';
import { ConnectorFrame } from './ConnectorFrame';
import { MeshModel } from './MeshModel';
import { COLLECTOR_MATERIALS, COLLECTOR_RING_GAP, COLLECTOR_THREAD, SteelCollectorPipe } from './SteelCollectorPipe';
import type { ThreadSideCode } from './SteelElbowGenerator';

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
export class SteelCollectorGenerator implements ModelGenerator<SteelCollectorParams> {
  readonly id = 'st_collector_1';
  readonly title = 'Коллектор стальной';
  readonly paramSpecs: readonly ParamSpec[] = [
    { kind: 'choice', key: 'side', label: 'Резьба выходов', options: ['v', 'n'], optionLabels: { v: 'внутренняя', n: 'наружная' } },
    { kind: 'choice', key: 'r1', label: 'Резьба трубы', options: ThreadSizes.nominals },
    { kind: 'choice', key: 'r2', label: 'Резьба выходов', options: ThreadSizes.nominals },
    { kind: 'integer', key: 'count', label: 'Выходов', min: 1, max: 10 },
    { kind: 'length', key: 'm1', label: 'Длина', min: 0.001, max: 0.5, step: 0.0005 },
    { kind: 'length', key: 'm2', label: 'Высота выхода', min: 0.001, max: 0.2, step: 0.0005 },
  ];

  private readonly sleeves = new SleeveGeometryBuilder();
  private readonly pipe = new SteelCollectorPipe(this.sleeves);

  constructor(private readonly materials: MaterialLibrary) {}

  validate(params: SteelCollectorParams): ValidationError[] {
    const errors = ParamSchema.validate(this.paramSpecs, params);
    if (errors.length === 0) {
      // Участки трубы и выхода до резьбы (s1, s2 в gl2) были бы нулевой или отрицательной длины.
      if (params.m1 / 2 <= COLLECTOR_THREAD) errors.push(ParamSchema.tooShort('m1', 2 * COLLECTOR_THREAD));
      if (params.m2 <= COLLECTOR_THREAD) errors.push(ParamSchema.tooShort('m2', COLLECTOR_THREAD));
    }
    return errors;
  }

  build(params: SteelCollectorParams): GeneratedModel {
    const errors = this.validate(params);
    if (errors.length > 0) throw new GeneratorParamsError(this.id, errors);

    const internal = params.side === 'v';
    const d1 = ThreadSizes.diameters(params.r1, 'internal')!;
    const d2 = ThreadSizes.diameters(params.r2, internal ? 'internal' : 'external')!;
    const d3 = ThreadSizes.diameters(params.r1, 'external')!;
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
        ...this.sleeves.build({
          length: s2,
          outerDiameter: dc.n,
          innerDiameter: dc.v,
          outerDiameterStart: d2.n,
          innerDiameterStart: d2.v,
          rotation: { x: 0, y: 0, z: -Math.PI / 2 },
          center: { x, y: s2 / 2, z: 0 },
        }),
        ...this.sleeves.build({ length: ring, outerDiameter: d2.n + ring, innerDiameter: d2.v + COLLECTOR_RING_GAP, rotation: vertical, center: { x, y: ringY, z: 0 } }),
        ...this.sleeves.build({
          length: w,
          outerDiameter: d2.n,
          innerDiameter: d2.v,
          rotation: vertical,
          center: { x, y: s2 + w / 2, z: 0 },
          materials: internal ? { inner: COLLECTOR_MATERIALS.thread } : { outer: COLLECTOR_MATERIALS.thread },
        }),
      );
    }

    const suffix = internal ? '(в)' : '(н)';
    return MeshModel.create({
      title: `коллектор ${params.r1}x${params.r2}${suffix} [${params.count} вых.]`,
      geometry: merger.merge(),
      materials: [this.materials.get('metal'), this.materials.get('thread'), this.materials.get('metalFlat')],
      connectors: SteelCollectorPipe.connectors(
        params.m1,
        params.r1,
        outlets.map(
          (x, i): Connector => ({
            id: `outlet-${i + 1}`,
            position: { x, y: params.m2, z: 0 },
            ...ConnectorFrame.top,
            depth: internal ? w : w - ring,
            nominal: params.r2,
            joint: 'thread',
            gender: internal ? 'internal' : 'external',
          }),
        ),
      ),
    });
  }
}
