import { BaseGenerator } from '../../core/BaseGenerator';
import { connector } from '../../core/connector';
import { ConnectorFrame } from '../../core/ConnectorFrame';
import type { GeneratedModel, ParamSpec, ValidationError } from '../../core/contracts';
import { createMeshModel } from '../../core/MeshModel';
import { MaterialGroupMerger } from '../../geometry/MaterialGroupMerger';
import { sleeves } from '../../geometry/SleeveGeometryBuilder';
import { ParamSchema } from '../../params/ParamSchema';
import { ThreadSizes } from '../../sizes/ThreadSizes';

export interface ThermowellParams {
  /** Наружная резьба; VALTEC и Officine Rigamonti — только G1/2. */
  nominal: string;
  /** Общая длина от торца шестигранника до дна, м (OR.551 — 60 мм, VTr.551 — 64 и 90 мм). */
  length: number;
  /** Диаметр гнезда под датчик, мм: OR.551 — 10,5, VTr.551 — 12. */
  socket: 10.5 | 12;
}

/** OR.551 (технический каталог 2017, с. 659): резьба 11 мм, шестигранник SW 22, остальное — погружная часть. */
const THREAD = 0.011;
const HEX = 0.0065;
const HEX_KEY = 0.022;
/** Стенка погружной трубки: у OR.551 Ø12 при гнезде 10,5 мм. */
const WALL = 0.00075;
const BOTTOM = 0.0015;

/**
 * Погружная гильза для термометра или датчика (позиция 90) по Officine Rigamonti OR.551 (чертёж) и VALTEC VTr.551
 * (фото-каталог, с. 234: длины 64 и 90 мм, гнездо 12 мм; остальное — как у OR.551, условно). Латунь.
 * Заготовка: торец резьбы в начале координат, погружная трубка по −X (за торцем, в трубопровод),
 * шестигранник и гнездо датчика по +X. Порт process — наружная резьба; гнездо датчика — свободная граница
 * (датчиков и термометров под гильзу в каталоге нет).
 */
export class ThermowellGenerator extends BaseGenerator<ThermowellParams> {
  readonly id = 'equipment.thermowell';
  readonly version = 1;
  readonly title = 'Гильза погружная';
  readonly paramSpecs: readonly ParamSpec[] = [
    { kind: 'choice', key: 'nominal', label: 'Резьба (н)', options: ['1/2'] },
    { kind: 'length', key: 'length', label: 'Длина', min: 0.02, max: 0.2, step: 0.001 },
    { kind: 'choice', key: 'socket', label: 'Гнездо, мм', options: [10.5, 12] },
  ];
  readonly defaults: ThermowellParams = { nominal: '1/2', length: 0.06, socket: 10.5 };

  /** Погружная часть не короче резьбы. */
  protected override relations(p: ThermowellParams): ValidationError[] {
    const minimum = 2 * THREAD + HEX;
    return p.length <= minimum ? [ParamSchema.tooShort('length', minimum)] : [];
  }

  protected create(p: ThermowellParams): GeneratedModel {
    const thread = ThreadSizes.require(p.nominal, 'external');
    const socket = p.socket / 1000;
    const tube = socket + 2 * WALL;
    const immersion = p.length - THREAD - HEX;
    const span = (from: number, to: number) => ({ length: to - from, center: { x: (from + to) / 2, y: 0, z: 0 } });
    const merger = new MaterialGroupMerger();
    merger.add(
      // Погружная трубка с дном.
      ...sleeves.build({ material: 'bronze', ...span(-immersion + BOTTOM, 0), outerDiameter: tube, innerDiameter: socket }),
      ...sleeves.build({ material: 'bronze', ...span(-immersion, -immersion + BOTTOM), outerDiameter: tube, innerDiameter: 0 }),
      // Резьба и шестигранник с гнездом.
      ...sleeves.build({ material: 'bronze', ...span(0, THREAD), outerDiameter: thread.n, innerDiameter: socket, materials: { outer: 'bronzeThread' } }),
      ...sleeves.build({ material: 'bronze', ...span(THREAD, THREAD + HEX), outerDiameter: HEX_KEY / Math.cos(Math.PI / 6), innerDiameter: socket,
        outerSegments: 6, materials: { outer: 'bronzeFlat' } }),
    );
    return createMeshModel({
      title: `Гильза погружная G${p.nominal}, ${Math.round(p.length * 1000)} мм, гнездо ${p.socket} мм`,
      ...merger.merge(),
      connectors: [
        // Торец резьбы; трубка уходит дальше торца — в трубопровод.
        connector('process', ConnectorFrame.left, { x: 0, y: 0, z: 0 }, { nominal: p.nominal, joint: 'thread', gender: 'external', depth: THREAD }),
      ],
    });
  }
}
