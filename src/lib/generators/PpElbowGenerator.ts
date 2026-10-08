import { Box3, Group, Mesh } from 'three';
import type { Connector, GeneratedModel, ModelGenerator, ValidationError } from '../contracts';
import { GeneratorParamsError } from '../GeneratorParamsError';
import { MaterialGroupMerger } from '../geometry/MaterialGroupMerger';
import { SleeveGeometryBuilder } from '../geometry/SleeveGeometryBuilder';
import { SphereGeometryBuilder } from '../geometry/SphereGeometryBuilder';
import type { MaterialLibrary } from '../materials/MaterialLibrary';
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

  private readonly sleeves = new SleeveGeometryBuilder();
  private readonly spheres = new SphereGeometryBuilder();

  constructor(private readonly materials: MaterialLibrary) {}

  validate(params: PpElbowParams): ValidationError[] {
    const errors: ValidationError[] = [];

    if (!PpPipeSizes.has(params.r1)) {
      errors.push({ code: 'unknown_nominal', param: 'r1', message: `Неизвестный диаметр ПП-трубы r1: '${params.r1}'` });
    }

    if (!Number.isFinite(params.m1) || params.m1 <= 0) {
      errors.push({ code: 'not_positive', param: 'm1', message: `Длина m1 должна быть больше нуля: ${params.m1}` });
    } else if (params.m1 <= SOCKET_LENGTH) {
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
    root.name = `Угол ${params.r1}`;
    root.add(mesh);

    // Разъёмы в центре раструбов, как cr_CenterPoint в gl2. ID — по стороне выхода.
    const socket = x2 + x1 / 2;
    const common = { nominal: params.r1, joint: 'pp-socket', gender: 'internal' } as const;
    const connectors: Connector[] = [
      { id: 'right', position: { x: socket, y: 0, z: 0 }, direction: { x: 1, y: 0, z: 0 }, ...common },
      { id: 'top', position: { x: 0, y: socket, z: 0 }, direction: { x: 0, y: 1, z: 0 }, ...common },
    ];

    let disposed = false;
    return {
      root,
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
