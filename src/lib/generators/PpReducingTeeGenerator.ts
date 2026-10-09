import type { GeneratedModel, ModelGenerator, ParamSpec, ValidationError } from '../contracts';
import { GeneratorParamsError } from '../GeneratorParamsError';
import { MaterialGroupMerger } from '../geometry/MaterialGroupMerger';
import { SleeveGeometryBuilder } from '../geometry/SleeveGeometryBuilder';
import { ParamSchema } from '../params/ParamSchema';
import { PpPipeSizes } from '../sizes/PpPipeSizes';
import type { PartDiameters } from '../sizes/ThreadSizes';
import { ConnectorFrame } from './ConnectorFrame';
import { MeshModel } from './MeshModel';

/** Параметры в формате cdm из gl2. */
export interface PpReducingTeeParams {
  /** Наружные диаметры ПП-труб: слева, отвод, справа; мм, строкой. */
  r1: string;
  r2: string;
  r3: string;
  /** Длина прохода, м. */
  m1: number;
  /** Высота отвода над наружной стенкой прохода (до торца — m2 + dc/2), м. */
  m2: number;
}

/** Длина раструба (x_1 в gl2), м. */
const SOCKET_LENGTH = 0.02;

/**
 * Полипропиленовый переходной тройник (перенос pl_troinik_2): раструбы своих диаметров,
 * между ними конусы от наибольшего диаметра.
 */
export class PpReducingTeeGenerator implements ModelGenerator<PpReducingTeeParams> {
  readonly id = 'pl_troinik_2';
  readonly title = 'Тройник ПП переходной';
  readonly paramSpecs: readonly ParamSpec[] = [
    { kind: 'choice', key: 'r1', label: 'Слева, мм', options: PpPipeSizes.nominals },
    { kind: 'choice', key: 'r2', label: 'Отвод, мм', options: PpPipeSizes.nominals },
    { kind: 'choice', key: 'r3', label: 'Справа, мм', options: PpPipeSizes.nominals },
    { kind: 'length', key: 'm1', label: 'Длина прохода', min: 0.001, max: 0.3, step: 0.0005 },
    { kind: 'length', key: 'm2', label: 'Высота отвода', min: 0.001, max: 0.2, step: 0.0005 },
  ];

  private readonly sleeves = new SleeveGeometryBuilder();

  validate(params: PpReducingTeeParams): ValidationError[] {
    const errors = ParamSchema.validate(this.paramSpecs, params);
    if (errors.length === 0) {
      // Конусы между раструбами (x_2, x_3 в gl2) были бы нулевой или отрицательной длины.
      if (params.m1 <= 2 * SOCKET_LENGTH) errors.push(ParamSchema.tooShort('m1', 2 * SOCKET_LENGTH));
      const dc = this.largest(params);
      if (params.m2 + dc.n / 2 <= SOCKET_LENGTH) errors.push(ParamSchema.tooShort('m2', SOCKET_LENGTH - dc.n / 2));
    }
    return errors;
  }

  build(params: PpReducingTeeParams): GeneratedModel {
    const errors = this.validate(params);
    if (errors.length > 0) throw new GeneratorParamsError(this.id, errors);

    const [d1, d2, d3] = [params.r1, params.r2, params.r3].map((r) => PpPipeSizes.diameters(r)!);
    const dc = this.largest(params);
    const x1 = SOCKET_LENGTH;
    const x2 = params.m1 - 2 * x1;
    const height = params.m2 + dc.n / 2;
    const x3 = height - x1;
    const size = (d: PartDiameters) => ({ outerDiameter: d.n, innerDiameter: d.v });
    const cone = (d: PartDiameters) => ({ outerDiameter: dc.n, innerDiameter: dc.v, outerDiameterStart: d.n, innerDiameterStart: d.v });
    const at = (x: number) => ({ x, y: 0, z: 0 });

    const merger = new MaterialGroupMerger();
    merger.add(
      ...this.sleeves.build({ material: 'plastic', ...size(d1), length: x1, center: at(-(x2 + x1) / 2) }),
      ...this.sleeves.build({ material: 'plastic', ...cone(d1), length: x2 / 2, center: at(-x2 / 4) }),
      ...this.sleeves.build({ material: 'plastic', ...cone(d3), length: x2 / 2, center: at(x2 / 4), rotation: { x: 0, y: Math.PI, z: 0 } }),
      ...this.sleeves.build({ material: 'plastic', ...size(d3), length: x1, center: at((x2 + x1) / 2) }),
      ...this.sleeves.build({ material: 'plastic', ...cone(d2), length: x3, center: { x: 0, y: x3 / 2, z: 0 }, rotation: { x: 0, y: 0, z: -Math.PI / 2 } }),
      ...this.sleeves.build({ material: 'plastic', ...size(d2), length: x1, center: { x: 0, y: x3 + x1 / 2, z: 0 }, rotation: { x: 0, y: Math.PI, z: Math.PI / 2 } }),
    );

    // Торцы — концы раструбов, глубина — длина раструба. В gl2 точки — в центрах раструбов.
    const common = { depth: x1, joint: 'pp-socket', gender: 'internal' } as const;
    const { left, top, right } = ConnectorFrame;
    return MeshModel.create({
      title: `Тройник ${params.r1}x${params.r2}x${params.r3}`,
      ...merger.merge(),
      connectors: [
        { id: 'left', position: ConnectorFrame.point(left, params.m1 / 2), ...left, nominal: params.r1, ...common },
        { id: 'top', position: ConnectorFrame.point(top, height), ...top, nominal: params.r2, ...common },
        { id: 'right', position: ConnectorFrame.point(right, params.m1 / 2), ...right, nominal: params.r3, ...common },
      ],
    });
  }

  /** Диаметры выхода с наибольшим наружным диаметром; вызывать только для известных номиналов. */
  private largest(params: PpReducingTeeParams): PartDiameters {
    return [params.r1, params.r2, params.r3].map((r) => PpPipeSizes.diameters(r)!).reduce((max, d) => (d.n > max.n ? d : max));
  }
}
