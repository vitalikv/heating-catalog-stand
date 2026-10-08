import { Box3, Group, Mesh } from 'three';
import type { Connector, GeneratedModel, ModelGenerator, ParamSpec, ValidationError } from '../contracts';
import { GeneratorParamsError } from '../GeneratorParamsError';
import { MaterialGroupMerger } from '../geometry/MaterialGroupMerger';
import { SleeveGeometryBuilder } from '../geometry/SleeveGeometryBuilder';
import { SphereGeometryBuilder } from '../geometry/SphereGeometryBuilder';
import type { MaterialLibrary } from '../materials/MaterialLibrary';
import { ParamSchema } from '../params/ParamSchema';
import { PpPipeSizes } from '../sizes/PpPipeSizes';

/** Параметры в формате cdm из gl2. */
export interface PpElbowParams {
  /** Наружный диаметр ПП-трубы, мм, строкой: '20', '25'… */
  r1: string;
  /** Длина плеча от оси до торца, м. */
  m1: number;
}

/** Длина раструба у торца, м (x_1 в gl2). */
const SOCKET_LENGTH = 0.015;

/**
 * Полипропиленовый угол 90° под пайку (перенос pl_ugol_90_1).
 * Плечи идут по +X и +Y из начала координат, внешний угол скруглён четвертью сферы.
 */
export class PpElbowGenerator implements ModelGenerator<PpElbowParams> {
  readonly id = 'pl_ugol_90_1';
  readonly title = 'Угол ПП 90°';
  readonly paramSpecs: readonly ParamSpec[] = [
    { kind: 'choice', key: 'r1', label: 'Труба, мм', options: PpPipeSizes.nominals },
    { kind: 'length', key: 'm1', label: 'Длина плеча', min: 0.001, max: 0.2, step: 0.0005 },
  ];

  private readonly sleeves = new SleeveGeometryBuilder();
  private readonly spheres = new SphereGeometryBuilder();

  constructor(private readonly materials: MaterialLibrary) {}

  validate(params: PpElbowParams): ValidationError[] {
    const errors = ParamSchema.validate(this.paramSpecs, params);

    if (errors.length === 0 && params.m1 <= SOCKET_LENGTH) {
      // Плечо до раструба (x_2 в gl2) было бы нулевой или отрицательной длины.
      errors.push({ code: 'too_short', param: 'm1', message: `Длина m1 должна быть больше ${SOCKET_LENGTH * 1000} мм` });
    }

    return errors;
  }

  build(params: PpElbowParams): GeneratedModel {
    const errors = this.validate(params);
    if (errors.length > 0) throw new GeneratorParamsError(this.id, errors);

    const d = PpPipeSizes.diameters(params.r1)!;
    const x1 = SOCKET_LENGTH;
    const x2 = params.m1 - x1;
    const pipe = { outerDiameter: d.n, innerDiameter: d.v };
    const vertical = { x: 0, y: 0, z: -Math.PI / 2 };
    const quarter = { phiLength: Math.PI / 2, rotation: { x: Math.PI / 2, y: 0, z: 0 } };

    // В gl2 плечо и раструб — две втулки одного диаметра; разбиение сохранено.
    const merger = new MaterialGroupMerger();
    merger.add(
      ...this.sleeves.build({ ...pipe, length: x2, center: { x: x2 / 2, y: 0, z: 0 } }),
      ...this.sleeves.build({ ...pipe, length: x1, center: { x: x2 + x1 / 2, y: 0, z: 0 } }),
      ...this.sleeves.build({ ...pipe, length: x2, rotation: vertical, center: { x: 0, y: x2 / 2, z: 0 } }),
      ...this.sleeves.build({ ...pipe, length: x1, rotation: vertical, center: { x: 0, y: x2 + x1 / 2, z: 0 } }),
      this.spheres.build({ ...quarter, radius: d.n / 2 }),
      this.spheres.build({ ...quarter, radius: d.v / 2 }),
    );

    const geometry = merger.merge();
    geometry.computeBoundingBox();
    const bounds = new Box3().copy(geometry.boundingBox!);

    const mesh = new Mesh(geometry, [this.materials.get('plastic')]);
    const root = new Group();
    const title = `Угол ${params.r1}`;
    root.name = title;
    root.add(mesh);

    // Торец раструба — конец плеча m1, глубина — длина раструба x_1.
    // В gl2 точка разъёма стояла в центре раструба. ID — по стороне выхода.
    const common = { depth: x1, nominal: params.r1, joint: 'pp-socket', gender: 'internal' } as const;
    const connectors: Connector[] = [
      { id: 'right', position: { x: params.m1, y: 0, z: 0 }, direction: { x: 1, y: 0, z: 0 }, ...common },
      { id: 'top', position: { x: 0, y: params.m1, z: 0 }, direction: { x: 0, y: 1, z: 0 }, ...common },
    ];

    let disposed = false;
    return {
      root,
      title,
      connectors,
      bounds,
      warnings: [],
      dispose: () => {
        if (disposed) return;
        disposed = true;
        geometry.dispose();
      },
    };
  }
}
