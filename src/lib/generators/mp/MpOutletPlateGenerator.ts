import { BaseGenerator } from '../../core/BaseGenerator';
import type { GeneratedModel, ParamSpec } from '../../core/contracts';
import { createMeshModel } from '../../core/MeshModel';
import { shapes } from '../../geometry/ExtrudedShapeBuilder';
import { MaterialGroupMerger } from '../../geometry/MaterialGroupMerger';

export interface MpOutletPlateParams {
  /** Межцентровое расстояние водорозеток, мм: 75, 112,5 или 150 (VTm.224). */
  spacing: '75' | '112.5' | '150';
}

/**
 * VALTEC VTm.224 «Планка монтажная» (каталог 2017, с. 52), м: длина 186, ширина 35, толщина 2;
 * отверстия под крепёж к стене Ø9 на концах (шаг 186 − 2·9), под водорозетки — по межцентровому
 * расстоянию 75 / 112,5 / 150 мм симметрично середине. Отверстия под водорозетки — Ø9, условно.
 */
const PLATE = { length: 0.186, width: 0.035, thickness: 0.002, wallHole: 0.0045, wallHoleInset: 0.009, outletHole: 0.0045 };

/**
 * Монтажная пластина водорозеток (позиция 117). Лежит в плоскости XZ: длина по X, ширина по Z,
 * лицевая сторона y = 0, стена — y = −толщина. Разъёмов нет: водорозетки ставятся на неё явным положением
 * (сборка 36), y водорозетки — плоскость её ушек.
 */
export class MpOutletPlateGenerator extends BaseGenerator<MpOutletPlateParams> {
  readonly id = 'mp.outlet-plate';
  readonly version = 1;
  readonly title = 'Пластина монтажная водорозеток';
  readonly defaults: MpOutletPlateParams = { spacing: '150' };
  readonly paramSpecs: readonly ParamSpec[] = [
    { kind: 'choice', key: 'spacing', label: 'Межцентровое, мм', options: ['75', '112.5', '150'], optionLabels: { '112.5': '112,5' } },
  ];

  /** Положения центров водорозеток по X, м. */
  static outletPositions(spacing: MpOutletPlateParams['spacing']): [number, number] {
    const half = Number(spacing) / 2000;
    return [-half, half];
  }

  protected create(p: MpOutletPlateParams): GeneratedModel {
    const { length, width, thickness, wallHole, wallHoleInset, outletHole } = PLATE;
    const end = length / 2 - wallHoleInset;
    const holes = [-end, end].map((x) => ({ x, y: 0, radius: wallHole }))
      .concat(MpOutletPlateGenerator.outletPositions(p.spacing).map((x) => ({ x, y: 0, radius: outletHole })));
    const merger = new MaterialGroupMerger();
    // Контур в XY; поворот −90° вокруг X кладёт его в XZ, толщина выдавливается по +Y, сдвиг — лицом в y = 0.
    merger.add(shapes.build({ material: 'metal', depth: thickness,
      points: [{ x: -length / 2, y: -width / 2 }, { x: length / 2, y: -width / 2 }, { x: length / 2, y: width / 2 }, { x: -length / 2, y: width / 2 }],
      holes, rotation: { x: -Math.PI / 2, y: 0, z: 0 }, position: { x: 0, y: -thickness, z: 0 } }));
    return createMeshModel({ title: `Пластина водорозеток, ${p.spacing.replace('.', ',')} мм`, ...merger.merge(), connectors: [] });
  }
}
