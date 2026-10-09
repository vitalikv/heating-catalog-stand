import { BoxGeometry } from 'three';
import { BaseGenerator } from '../../core/BaseGenerator';
import { connector } from '../../core/connector';
import { ConnectorFrame } from '../../core/ConnectorFrame';
import type { Connector, GeneratedModel, ParamSpec, ValidationError } from '../../core/contracts';
import { createMeshModel } from '../../core/MeshModel';
import { MaterialGroupMerger } from '../../geometry/MaterialGroupMerger';
import type { GeometryPart } from '../../geometry/MaterialGroupMerger';
import { sleeves } from '../../geometry/SleeveGeometryBuilder';
import { ParamSchema } from '../../params/ParamSchema';
import { specs } from '../../params/specs';
import { ThreadSizes } from '../../sizes/ThreadSizes';
import { COLLECTOR_THREAD, SteelCollectorPipe } from './SteelCollectorPipe';

/** Цвет ручек кранов: в gl2 — материал red_1 или blue_1. */
export type ValveColor = 'red' | 'blue';

/** Параметры в формате cdm из gl2; color — ключ материала вместо самого материала. */
export interface SteelValveCollectorParams {
  /** Номинал резьбы концов трубы, например '1'. */
  r1: string;
  /** Номинал наружной резьбы выходов. */
  r2: string;
  count: number;
  m1: number;
  /** Высота выхода от оси трубы до начала гладкой части перед резьбой, м. */
  m2: number;
  color: ValveColor;
}

/** Гладкая часть выхода перед резьбой (t1 в gl2), м. */
const OUTLET_NECK = 0.01;
/** Ручка крана (crKran в gl2): размеры флажка, м; сдвиг флажка от оси штока по Z. */
const HANDLE = { x: 0.003, y: 0.02, z: 0.015, shift: 0.005 };

/**
 * Стальной коллектор с кранами на выходах (перенос st_collector_2): как st_collector_1
 * с наружной резьбой выходов, на каждом выходе — шток и цветная ручка крана.
 */
export class SteelValveCollectorGenerator extends BaseGenerator<SteelValveCollectorParams> {
  readonly id = 'st_collector_2';
  readonly title = 'Коллектор стальной с кранами';
  readonly paramSpecs: readonly ParamSpec[] = [
    specs.threadNominal('r1', 'Резьба трубы'),
    specs.threadNominal('r2', 'Резьба выходов (н)'),
    { kind: 'integer', key: 'count', label: 'Выходов', min: 1, max: 10 },
    specs.length('m1', 'Длина', { max: 0.5 }),
    specs.length('m2', 'Высота выхода'),
    { kind: 'choice', key: 'color', label: 'Ручки', options: ['red', 'blue'], optionLabels: { red: 'красные', blue: 'синие' } },
  ];

  private readonly pipe = new SteelCollectorPipe();

  protected override relations(params: SteelValveCollectorParams): ValidationError[] {
    const errors: ValidationError[] = [];
    if (params.m1 / 2 <= COLLECTOR_THREAD) errors.push(ParamSchema.tooShort('m1', 2 * COLLECTOR_THREAD));
    if (params.m2 <= COLLECTOR_THREAD) errors.push(ParamSchema.tooShort('m2', COLLECTOR_THREAD));
    return errors;
  }

  protected create(params: SteelValveCollectorParams): GeneratedModel {
    const d1 = ThreadSizes.require(params.r1, 'internal');
    const d2 = ThreadSizes.require(params.r2, 'external');
    const d3 = ThreadSizes.require(params.r1, 'external');
    const dc = [d1, d2, d3].reduce((max, d) => (d.n > max.n ? d : max));
    const w = COLLECTOR_THREAD;
    const s2 = params.m2 - w;
    const vertical = { x: 0, y: Math.PI, z: Math.PI / 2 };
    const pipe = { outerDiameter: d2.n, innerDiameter: d2.v, rotation: vertical };
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
        ...sleeves.build({ material: 'metal', ...pipe, length: OUTLET_NECK, center: { x, y: s2 + OUTLET_NECK / 2, z: 0 } }),
        ...sleeves.build({ material: 'metal', ...pipe, length: w, center: { x, y: s2 + OUTLET_NECK + w / 2, z: 0 }, materials: { outer: 'thread' } }),
        // Кран на выходе: у оси выхода на высоте резьбы трубы, перед трубой по Z
        ...this.valve({ x, y: w, z: HANDLE.z / 2 + d2.n / 2 }, params.color),
      );
    }

    return createMeshModel({
      title: `коллектор с кранами ${params.r1}x${params.r2}(н) [${params.count} вых.]`,
      ...merger.merge(),
      connectors: SteelCollectorPipe.connectors(
        params.m1,
        params.r1,
        outlets.map(
          (x, i): Connector => (connector(`outlet-${i + 1}`, ConnectorFrame.top, { x, y: params.m2 + OUTLET_NECK, z: 0 }, { depth: w, nominal: params.r2, joint: 'thread', gender: 'external' })),
        ),
      ),
    });
  }

  /** Шток вдоль Z и ручка-флажок цвета color с конусной втулкой; position — центр штока. */
  private valve(position: { x: number; y: number; z: number }, color: ValveColor): GeometryPart[] {
    const along = { x: 0, y: Math.PI / 2, z: 0 };
    const at = (z: number) => ({ x: position.x, y: position.y, z: position.z + z });
    const coneInner = 0.01 - 0.0027;

    const indexed = new BoxGeometry(HANDLE.x, HANDLE.y, HANDLE.z);
    indexed.translate(position.x, position.y + HANDLE.y / 2, position.z + HANDLE.shift);
    const box = indexed.toNonIndexed();
    indexed.dispose();

    return [
      { geometry: box, material: color },
      ...sleeves.build({
        length: HANDLE.z,
        outerDiameter: 0.02,
        innerDiameter: coneInner,
        outerDiameterStart: 0.01,
        innerDiameterStart: coneInner,
        rotation: along,
        center: at(HANDLE.shift),
        material: color,
      }),
      ...sleeves.build({ material: 'metal', length: HANDLE.z + 0.012, outerDiameter: 0.007, innerDiameter: 0.0001, rotation: along, center: at(0) }),
    ];
  }
}
