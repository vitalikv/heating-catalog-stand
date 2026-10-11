import { BaseGenerator } from '../../core/BaseGenerator';
import { connector } from '../../core/connector';
import { ConnectorFrame } from '../../core/ConnectorFrame';
import type { Frame } from '../../core/ConnectorFrame';
import type { GeneratedModel, MaterialKey, ParamSpec, ValidationError } from '../../core/contracts';
import { createMeshModel } from '../../core/MeshModel';
import { MaterialGroupMerger } from '../../geometry/MaterialGroupMerger';
import type { GeometryPart } from '../../geometry/MaterialGroupMerger';
import { sleeves } from '../../geometry/SleeveGeometryBuilder';
import { orientParts, threadedSize } from '../ThreadedParts';
import type { ThreadedSize } from '../ThreadedParts';

export type GaugeKind = 'manometer' | 'thermometer' | 'thermomanometer';

export interface GaugeParams {
  /** Прибор: манометр (позиция 79), термометр (80), термоманометр (96) — общий корпус. */
  kind: GaugeKind;
  /** Диаметр корпуса, мм. */
  diameter: 40 | 50 | 63 | 80 | 100;
  /** Подключение: снизу (радиальное), сзади по оси, сверху. */
  connection: 'bottom' | 'back' | 'top';
  /** Наружная резьба штуцера. */
  nominal: '1/4' | '1/2';
  /** Погружная часть термометра за резьбой, м. */
  probe: number;
}

/**
 * Диск циферблата, под который подогнаны повтор и сдвиг текстуры (MaterialLibrary.setDialTexture):
 * манометр группы безопасности, 0,9 × 66 мм. UV диска — в метрах, поэтому для другого диаметра
 * они масштабируются, чтобы шкала целиком ложилась на циферблат.
 */
const DIAL_REFERENCE = 0.0594;
/** Глубина корпуса к диаметру (не меньше 25 мм), циферблат и ободок к диаметру; штуцер — шейка, шестигранник (условно). */
const CASE_DEPTH = 0.4;
const CASE_DEPTH_MIN = 0.025;
const DIAL_SHARE = 0.9;
const BEZEL = 0.003;
const NECK = 0.004;

type Layout = { thread: ThreadedSize; radius: number; depth: number; hex: number };

const alongZ = { x: 0, y: -Math.PI / 2, z: 0 };
const spanZ = (from: number, to: number) => ({ length: to - from, center: { x: 0, y: 0, z: (from + to) / 2 }, rotation: alongZ });

/** Выход штуцера и точка, где он начинается на корпусе. */
const CONNECTIONS: Readonly<Record<GaugeParams['connection'], { frame: Frame; start: (d: Layout) => { x: number; y: number; z: number } }>> = {
  bottom: { frame: ConnectorFrame.bottom, start: (d) => ({ x: 0, y: -d.radius, z: -d.depth / 2 }) },
  top: { frame: ConnectorFrame.top, start: (d) => ({ x: 0, y: d.radius, z: -d.depth / 2 }) },
  back: { frame: ConnectorFrame.back, start: (d) => ({ x: 0, y: 0, z: -d.depth }) },
};

const TITLES: Readonly<Record<GaugeKind, string>> = { manometer: 'Манометр', thermometer: 'Термометр', thermomanometer: 'Термоманометр' };
const CONNECTION_TITLES: Readonly<Record<GaugeParams['connection'], string>> = { bottom: 'радиальный', back: 'осевой', top: 'верхний' };

/**
 * Показывающий прибор (позиции 79, 80, 96) по номенклатуре VALTEC: манометры VT.TM50, TM-310, TM-510,
 * термоманометры ТМТБ, термометры БТ (фото-каталог VALTEC, с. 248–249, 290–292). Чертежей нет:
 * диаметр корпуса и резьба — по каталогу, остальное условно. Циферблат смотрит вперёд (+Z), центр
 * циферблата — в начале координат. Корпус до 50 мм — чёрный (VT.TM), больше — стальной (Rosma).
 * Штуцер латунный: шейка, шестигранник под ключ, наружная резьба; у термометра за резьбой — погружная часть.
 */
export class GaugeGenerator extends BaseGenerator<GaugeParams, Layout> {
  readonly id = 'equipment.gauge';
  readonly version = 1;
  readonly title = 'Прибор показывающий';
  readonly paramSpecs: readonly ParamSpec[] = [
    { kind: 'choice', key: 'kind', label: 'Прибор', options: ['manometer', 'thermometer', 'thermomanometer'], optionLabels: TITLES },
    { kind: 'choice', key: 'diameter', label: 'Диаметр, мм', options: [40, 50, 63, 80, 100] },
    { kind: 'choice', key: 'connection', label: 'Подключение', options: ['bottom', 'back', 'top'],
      optionLabels: { bottom: 'снизу', back: 'сзади по оси', top: 'сверху' } },
    { kind: 'choice', key: 'nominal', label: 'Резьба (н)', options: ['1/4', '1/2'] },
    { kind: 'length', key: 'probe', label: 'Погружная часть', min: 0.02, max: 0.15, step: 0.005, when: { key: 'kind', values: ['thermometer'] } },
  ];
  readonly defaults: GaugeParams = { kind: 'manometer', diameter: 63, connection: 'bottom', nominal: '1/4', probe: 0.05 };

  protected override layout(p: GaugeParams): Layout {
    const thread = threadedSize(p.nominal, 'external');
    const radius = p.diameter / 2000;
    return { thread, radius, depth: Math.max((p.diameter / 1000) * CASE_DEPTH, CASE_DEPTH_MIN), hex: thread.n * 0.9 };
  }

  protected override relations(p: GaugeParams, d: Layout): ValidationError[] {
    // Шестигранник штуцера сзади не шире корпуса; сбоку — не выходит за глубину корпуса.
    const across = d.thread.n * 1.4;
    const room = p.connection === 'back' ? 2 * d.radius : d.depth;
    return across > room ? [{ code: 'too_small', param: 'diameter', message: `Диаметр, мм: корпус мал для резьбы ${p.nominal}` }] : [];
  }

  protected create(p: GaugeParams, d: Layout): GeneratedModel {
    const caseMaterial: MaterialKey = p.diameter <= 50 ? 'black' : 'metal';
    const dial = 2 * d.radius * DIAL_SHARE;
    const face = sleeves.build({ material: p.kind, ...spanZ(-0.004, -0.003), outerDiameter: dial, innerDiameter: 0 });
    for (const { geometry } of face) {
      const uv = geometry.getAttribute('uv');
      for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * (DIAL_REFERENCE / dial), uv.getY(i) * (DIAL_REFERENCE / dial));
    }

    const merger = new MaterialGroupMerger();
    merger.add(
      // Корпус-стакан с задней стенкой, ободок спереди; циферблат утоплен на 3 мм.
      ...sleeves.build({ material: caseMaterial, ...spanZ(-d.depth, 0), outerDiameter: 2 * d.radius, innerDiameter: dial }),
      ...sleeves.build({ material: caseMaterial, ...spanZ(-d.depth, -0.004), outerDiameter: dial, innerDiameter: 0 }),
      ...sleeves.build({ material: 'metal', ...spanZ(0, BEZEL), outerDiameter: 2 * d.radius + 0.002, innerDiameter: dial }),
      ...face,
      ...this.fitting(p, d),
    );

    const { frame, start } = CONNECTIONS[p.connection];
    const reach = NECK + d.hex * 0.6 + d.thread.depth;
    const origin = start(d);
    const port = { x: origin.x + frame.direction.x * reach, y: origin.y + frame.direction.y * reach, z: origin.z + frame.direction.z * reach };
    return createMeshModel({
      title: `${TITLES[p.kind]} ${CONNECTION_TITLES[p.connection]} Ø${p.diameter}, G${p.nominal}(н)${p.kind === 'thermometer' ? `, погружная ${Math.round(p.probe * 1000)} мм` : ''}`,
      ...merger.merge(),
      connectors: [connector('connection', frame, port, { nominal: p.nominal, joint: 'thread', gender: 'external', depth: d.thread.depth })],
    });
  }

  /** Штуцер по +X из начала, затем в сторону выхода: шейка, шестигранник, резьба, погружная часть термометра. */
  private fitting(p: GaugeParams, d: Layout): GeometryPart[] {
    const { thread, hex } = d;
    const hexLength = hex * 0.6;
    const threadStart = NECK + hexLength;
    const parts = [
      // Шейка заходит в корпус на 1 мм — без щели на скруглении.
      ...sleeves.build({ material: 'bronze', length: NECK + 0.001, outerDiameter: thread.n * 0.8, innerDiameter: 0, center: { x: (NECK - 0.001) / 2, y: 0, z: 0 } }),
      ...sleeves.build({ material: 'bronze', length: hexLength, outerDiameter: thread.n * 1.4, innerDiameter: 0, outerSegments: 6,
        center: { x: NECK + hexLength / 2, y: 0, z: 0 }, materials: { outer: 'bronzeFlat' } }),
      ...sleeves.build({ material: 'bronze', length: thread.depth, outerDiameter: thread.n, innerDiameter: p.kind === 'thermometer' ? 0 : thread.v * 0.4,
        center: { x: threadStart + thread.depth / 2, y: 0, z: 0 }, materials: { outer: 'bronzeThread' } }),
    ];
    if (p.kind === 'thermometer') {
      parts.push(...sleeves.build({ material: 'metal', length: p.probe, outerDiameter: Math.min(0.008, thread.v * 0.6), innerDiameter: 0,
        center: { x: threadStart + thread.depth + p.probe / 2, y: 0, z: 0 } }));
    }
    const { frame, start } = CONNECTIONS[p.connection];
    return orientParts(parts, frame.direction, start(d));
  }
}
