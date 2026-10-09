import type { GeneratedModel, ModelGenerator, ParamSpec, ValidationError } from '../contracts';
import { GeneratorParamsError } from '../GeneratorParamsError';
import { MaterialGroupMerger } from '../geometry/MaterialGroupMerger';
import { SleeveGeometryBuilder } from '../geometry/SleeveGeometryBuilder';
import type { MaterialLibrary } from '../materials/MaterialLibrary';
import { ParamSchema } from '../params/ParamSchema';
import { ThreadSizes } from '../sizes/ThreadSizes';
import { ConnectorFrame } from './ConnectorFrame';
import { MeshModel } from './MeshModel';

/** Параметры в формате cdm из gl2. */
export interface SteelCrossParams {
  /** Дюймовый номинал внутренней резьбы всех выходов, например '1/2'. */
  r1: string;
  /** Размер между торцами, м. */
  m1: number;
}

/** Длина резьбы (x_1 в gl2), м. */
const THREAD_LENGTH = 0.015;
/** Зазор кольца по внутреннему диаметру (kf в gl2), м. */
const RING_GAP = 0.0001;

const THREAD = 1;

/** Стальная крестовина с внутренней резьбой (перенос st_krestovina_1): выходы по ±X и ±Y. */
export class SteelCrossGenerator implements ModelGenerator<SteelCrossParams> {
  readonly id = 'st_krestovina_1';
  readonly title = 'Крестовина стальная';
  readonly paramSpecs: readonly ParamSpec[] = [
    { kind: 'choice', key: 'r1', label: 'Резьба (в)', options: ThreadSizes.nominals },
    { kind: 'length', key: 'm1', label: 'Размер', min: 0.001, max: 0.3, step: 0.0005 },
  ];

  private readonly sleeves = new SleeveGeometryBuilder();

  constructor(private readonly materials: MaterialLibrary) {}

  validate(params: SteelCrossParams): ValidationError[] {
    const errors = ParamSchema.validate(this.paramSpecs, params);
    // Средняя часть (x_2 в gl2) была бы нулевой или отрицательной длины.
    if (errors.length === 0 && params.m1 <= 2 * THREAD_LENGTH) errors.push(ParamSchema.tooShort('m1', 2 * THREAD_LENGTH));
    return errors;
  }

  build(params: SteelCrossParams): GeneratedModel {
    const errors = this.validate(params);
    if (errors.length > 0) throw new GeneratorParamsError(this.id, errors);

    const d = ThreadSizes.diameters(params.r1, 'internal')!;
    const x1 = THREAD_LENGTH;
    const x2 = params.m1 - 2 * x1;
    const ring = d.n / 10;
    const pipe = { outerDiameter: d.n, innerDiameter: d.v };
    const ringSize = { length: ring, outerDiameter: d.n + ring, innerDiameter: d.v + RING_GAP };
    const threadOffset = (x2 + x1) / 2;
    // Кольцо — у торца внутри резьбы.
    const ringOffset = x2 / 2 + x1 - ring / 2;

    const merger = new MaterialGroupMerger();
    for (const vertical of [false, true]) {
      const at = (offset: number) => (vertical ? { x: 0, y: offset, z: 0 } : { x: offset, y: 0, z: 0 });
      const rotation = vertical ? { x: 0, y: 0, z: Math.PI / 2 } : undefined;
      merger.add(
        ...this.sleeves.build({ ...pipe, rotation, length: x1, center: at(-threadOffset), materials: { inner: THREAD } }),
        ...this.sleeves.build({ ...pipe, rotation, length: x2 }),
        ...this.sleeves.build({ ...pipe, rotation, length: x1, center: at(threadOffset), materials: { inner: THREAD } }),
      );
    }
    for (const vertical of [false, true]) {
      const rotation = vertical ? { x: 0, y: 0, z: Math.PI / 2 } : undefined;
      for (const offset of [-ringOffset, ringOffset]) {
        merger.add(...this.sleeves.build({ ...ringSize, rotation, center: vertical ? { x: 0, y: offset, z: 0 } : { x: offset, y: 0, z: 0 } }));
      }
    }

    // Торцы — концы резьбы (±m1/2), глубина — резьба. В gl2 точки — в центрах резьбы.
    const common = { depth: x1, nominal: params.r1, joint: 'thread', gender: 'internal' } as const;
    const half = params.m1 / 2;
    const { left, right, bottom, top } = ConnectorFrame;
    return MeshModel.create({
      title: `Крестовина ${params.r1}`,
      geometry: merger.merge(),
      materials: [this.materials.get('metal'), this.materials.get('thread')],
      connectors: [
        { id: 'left', position: ConnectorFrame.point(left, half), ...left, ...common },
        { id: 'right', position: ConnectorFrame.point(right, half), ...right, ...common },
        { id: 'bottom', position: ConnectorFrame.point(bottom, half), ...bottom, ...common },
        { id: 'top', position: ConnectorFrame.point(top, half), ...top, ...common },
      ],
    });
  }
}
