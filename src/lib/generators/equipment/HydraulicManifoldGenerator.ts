import { BoxGeometry } from 'three';
import { BaseGenerator } from '../../core/BaseGenerator';
import { connector } from '../../core/connector';
import { ConnectorFrame } from '../../core/ConnectorFrame';
import type { Connector, GeneratedModel, MaterialKey, ParamSpec, Vector3Data } from '../../core/contracts';
import { createMeshModel } from '../../core/MeshModel';
import { MaterialGroupMerger } from '../../geometry/MaterialGroupMerger';
import type { GeometryPart } from '../../geometry/MaterialGroupMerger';
import { sleeves } from '../../geometry/SleeveGeometryBuilder';
import { orientParts, threadedSize } from '../ThreadedParts';
import type { ThreadedSize } from '../ThreadedParts';

export interface HydraulicManifoldParams {
  /** Контуров (пар выходов сверху): 2–4. */
  contours: number;
  /** Резьба патрубков к котлу (внутренняя): '1' или '1 1/4'. Выходы контуров — всегда 1" (наружная). */
  nominal: string;
  /**
   * С какой стороны гидрострелка и её патрубки к котлу: `right` — справа, патрубки смотрят вправо
   * (узел ставят слева от котла), `left` — слева, патрубки влево (узел справа от котла).
   */
  side: 'right' | 'left';
}

/**
 * Условные размеры, м (изделие — обобщённое, как «гидрострелка с коллектором» у производителей котельной
 * автоматики): side — сечение корпуса гидрострелки (квадрат), height — её высота, port — высота патрубков
 * к котлу от низа и от верха.
 */
const SEPARATORS: Readonly<Record<string, { side: number; height: number; port: number }>> = {
  '1': { side: 0.08, height: 0.42, port: 0.08 },
  '1 1/4': { side: 0.1, height: 0.5, port: 0.09 },
};
/** Коллектор — слева от гидрострелки: высота корпуса и отступ его верха от верха гидрострелки, м. */
const MANIFOLD = { height: 0.12, below: 0.04 };
/**
 * Выходы контуров: подача и обратка — через 100 мм (как линии насосных модулей 106 и прямого на две
 * линии), шаг пар — под ширину насосной группы, отступы от гидрострелки (`start`) и от левого торца
 * коллектора (`end`), м.
 */
export const HYDRAULIC_MANIFOLD_LINES = 0.1;
export const HYDRAULIC_MANIFOLD_STEP = 0.25;
const MARGIN = { start: 0.08, end: 0.06 };
const OUTLET = '1';
/** Патрубки: выход к котлу и выход контура — длина трубки до резьбы, м. */
const STUB = 0.03;
/** Гнёзда воздухоотводчика и слива — 1/2 (внутренняя), бобышка над корпусом, м. */
const SERVICE = '1/2';
const BOSS = 0.012;

interface Layout {
  separator: (typeof SEPARATORS)[string];
  /** Длина коллектора по X от левой грани гидрострелки, м. */
  length: number;
  boiler: ThreadedSize;
  outlet: ThreadedSize;
  service: ThreadedSize;
}

/**
 * Гидрострелка с коллектором (позиция 107 реестра — одним корпусом): вертикальная гидрострелка
 * квадратного сечения справа и горизонтальный двухкамерный коллектор слева от неё. Справа у
 * гидрострелки — патрубки к котлу (подача выше, обратка ниже, внутренняя резьба), сверху — гнездо 1/2
 * под воздухоотводчик, снизу — 1/2 под кран слива. Сверху коллектора — пары выходов 1" (наружная
 * резьба) под нижние краны насосных групп, контуры слева направо: подача контура слева, обратка —
 * через 100 мм справа. Задняя грань — к стене (−Z). Размеры условные.
 *
 * Патрубки к котлу — справа: узел ставят слева от настенного котла (со стороны его подачи), и трубы от
 * кранов обвязки — подача к верхнему патрубку, обратка к нижнему — ложатся вдоль стены без пересечения.
 *
 * Начало координат — ось гидрострелки у её низа, на середине глубины.
 */
export class HydraulicManifoldGenerator extends BaseGenerator<HydraulicManifoldParams, Layout> {
  readonly id = 'equipment.hydraulic-manifold';
  readonly version = 1;
  readonly title = 'Гидрострелка с коллектором';
  readonly paramSpecs: readonly ParamSpec[] = [
    { kind: 'integer', key: 'contours', label: 'Контуров', min: 2, max: 4 },
    { kind: 'choice', key: 'nominal', label: 'Резьба к котлу (в)', options: Object.keys(SEPARATORS) },
    { kind: 'choice', key: 'side', label: 'Гидрострелка', options: ['right', 'left'], optionLabels: { right: 'справа', left: 'слева' } },
  ];
  readonly defaults: HydraulicManifoldParams = { contours: 2, nominal: '1', side: 'right' };

  protected override layout(p: HydraulicManifoldParams): Layout {
    return {
      separator: SEPARATORS[p.nominal],
      length: MARGIN.start + (p.contours - 1) * HYDRAULIC_MANIFOLD_STEP + HYDRAULIC_MANIFOLD_LINES + MARGIN.end,
      boiler: threadedSize(p.nominal, 'internal'),
      outlet: threadedSize(OUTLET, 'external'),
      service: threadedSize(SERVICE, 'internal'),
    };
  }

  protected create(p: HydraulicManifoldParams, d: Layout): GeneratedModel {
    const { separator, length, boiler, outlet, service } = d;
    const { side, height, port } = separator;
    const half = side / 2;
    const merger = new MaterialGroupMerger();
    const top = height - MANIFOLD.below;
    // Корпуса: гидрострелка и коллектор вплотную к её грани со стороны контуров.
    const sign = p.side === 'left' ? -1 : 1;
    merger.add(box({ x: side, y: height, z: side }, { x: 0, y: height / 2, z: 0 }, 'red'));
    merger.add(box({ x: length, y: MANIFOLD.height, z: side }, { x: -sign * (half + length / 2), y: top - MANIFOLD.height / 2, z: 0 }, 'red'));

    const connectors: Connector[] = [];
    // К котлу: в сторону от коллектора, подача выше, обратка ниже.
    const out = sign > 0 ? ConnectorFrame.right : ConnectorFrame.left;
    for (const [id, y] of [['boiler-supply', height - port], ['boiler-return', port]] as const) {
      merger.add(...internalStub(boiler, STUB, out.direction, { x: sign * half, y, z: 0 }));
      connectors.push(connector(id, out, { x: sign * (half + STUB), y, z: 0 }, { nominal: p.nominal, joint: 'thread', gender: 'internal', depth: boiler.depth }));
    }
    // Контуры слева направо: пары выходов сверху коллектора; у гидрострелки — отступ `start`, у торца — `end`.
    const first = sign > 0 ? -half - length + MARGIN.end : half + MARGIN.start;
    for (let index = 0; index < p.contours; index += 1) {
      const x = first + index * HYDRAULIC_MANIFOLD_STEP;
      for (const [role, at] of [['supply', x], ['return', x + HYDRAULIC_MANIFOLD_LINES]] as const) {
        merger.add(...externalStub(outlet, STUB, ConnectorFrame.top.direction, { x: at, y: top, z: 0 }));
        connectors.push(connector(`${role}-${index + 1}`, ConnectorFrame.top, { x: at, y: top + STUB + outlet.depth, z: 0 },
          { nominal: OUTLET, joint: 'thread', gender: 'external', depth: outlet.depth }));
      }
    }
    // Воздухоотводчик сверху, слив снизу — гнёзда 1/2 на бобышках.
    merger.add(...internalStub(service, BOSS, ConnectorFrame.top.direction, { x: 0, y: height, z: 0 }));
    merger.add(...internalStub(service, BOSS, ConnectorFrame.bottom.direction, { x: 0, y: 0, z: 0 }));
    connectors.push(
      connector('vent', ConnectorFrame.top, { x: 0, y: height + BOSS, z: 0 }, { nominal: SERVICE, joint: 'thread', gender: 'internal', depth: service.depth }),
      connector('drain', ConnectorFrame.bottom, { x: 0, y: -BOSS, z: 0 }, { nominal: SERVICE, joint: 'thread', gender: 'internal', depth: service.depth }),
    );

    return createMeshModel({
      title: `Гидрострелка с коллектором на ${p.contours} контура, к котлу ${p.nominal}(в)${p.side === 'left' ? ', гидрострелка слева' : ''}`,
      ...merger.merge(),
      connectors,
    });
  }
}

/** Прямоугольный корпус: размер, середина, материал. */
function box(size: Vector3Data, center: Vector3Data, material: MaterialKey): GeometryPart {
  const indexed = new BoxGeometry(size.x, size.y, size.z);
  const geometry = indexed.toNonIndexed();
  indexed.dispose();
  geometry.translate(center.x, center.y, center.z);
  return { geometry, material };
}

/**
 * Патрубок с внутренней резьбой: трубка от грани корпуса длиной `length` вдоль `direction`, у торца
 * — шестигранная муфта с резьбой на глубину `size.depth`. Торец — на `length` от грани.
 */
function internalStub(size: ThreadedSize, length: number, direction: Vector3Data, origin: Vector3Data): GeometryPart[] {
  const outer = size.n * 1.25;
  const body = Math.max(0.001, length - size.depth);
  return orientParts([
    ...sleeves.build({ material: 'metal', length: body, center: { x: body / 2, y: 0, z: 0 }, outerDiameter: size.n * 1.05, innerDiameter: 0 }),
    ...sleeves.build({ material: 'metal', length: size.depth, center: { x: length - size.depth / 2, y: 0, z: 0 }, outerDiameter: outer, innerDiameter: size.v,
      outerSegments: 6, materials: { outer: 'metalFlat', inner: 'thread' } }),
  ], direction, origin);
}

/** Патрубок с наружной резьбой: трубка `length` от грани и резьба `size.depth` за ней. */
function externalStub(size: ThreadedSize, length: number, direction: Vector3Data, origin: Vector3Data): GeometryPart[] {
  return orientParts([
    ...sleeves.build({ material: 'metal', length, center: { x: length / 2, y: 0, z: 0 }, outerDiameter: size.n * 1.05, innerDiameter: size.v }),
    ...sleeves.build({ material: 'metal', length: size.depth, center: { x: length + size.depth / 2, y: 0, z: 0 }, outerDiameter: size.n, innerDiameter: size.v,
      materials: { outer: 'thread' } }),
  ], direction, origin);
}
