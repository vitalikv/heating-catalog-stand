import { BaseGenerator } from '../../core/BaseGenerator';
import { connector } from '../../core/connector';
import { ConnectorFrame } from '../../core/ConnectorFrame';
import type { GeneratedModel, ParamSpec, ValidationError } from '../../core/contracts';
import { createMeshModel } from '../../core/MeshModel';
import { MaterialGroupMerger } from '../../geometry/MaterialGroupMerger';
import type { GeometryPart } from '../../geometry/MaterialGroupMerger';
import { sleeves } from '../../geometry/SleeveGeometryBuilder';
import { ParamSchema } from '../../params/ParamSchema';
import { ThreadSizes } from '../../sizes/ThreadSizes';
import type { PartDiameters } from '../../sizes/ThreadSizes';
import { BallValveParts, VALVE_BODY_STEP, VALVE_NUT_SCALE } from './BallValveParts';

export interface GaugeTapParams {
  /** Вход G1 1/2: внутренняя резьба (VT.807) или наружная (VT.806). */
  inlet: 'internal' | 'external';
  /** Резьба накидной гайки G2 под манометр. */
  gaugeNominal: '1/4' | '3/8' | '1/2';
  /** Длина A между торцами, м. */
  length: number;
  /** Длина ручки-бабочки, м. */
  handleLength: number;
}
type Layout = { d: PartDiameters; nut: PartDiameters; x1: number; nutLength: number };

/** Вход — всегда G1/2 (таблица VT.806/807). */
const INLET = '1/2';
/** Шейка патрубка между корпусом и накидной гайкой; сервисный патрубок с винтом М6 на корпусе (+Z), м — условно. */
const NECK = 0.004;
const SERVICE = { length: 0.007, diameter: 0.009, screw: 0.006 };

/**
 * Кран шаровой для подключения манометра (позиция 91) по VALTEC VT.806 / VT.807 (технический каталог 2017,
 * с. 656: A = 75 / 73 / 73 и 67 / 65 / 65 мм для G2 1/2, 3/8, 1/4; B = 37 мм). Корпус и ручка-бабочка —
 * общие части шаровых кранов; вход 1/2 слева (у VT.806 — наружная резьба за гайкой, как у valve.ball н-н),
 * справа — патрубок с накидной гайкой G2 под манометр. Сервисный патрубок с винтом М6 — спереди корпуса,
 * без разъёма (поверочного манометра в каталоге нет). Отдельный ID: у valve.ball нет накидной гайки на выходе.
 */
export class GaugeTapGenerator extends BaseGenerator<GaugeTapParams, Layout> {
  readonly id = 'valve.gauge-tap';
  readonly version = 1;
  readonly title = 'Кран для манометра';
  readonly paramSpecs: readonly ParamSpec[] = [
    { kind: 'choice', key: 'inlet', label: 'Вход 1/2', options: ['internal', 'external'], optionLabels: { internal: 'внутренняя (VT.807)', external: 'наружная (VT.806)' } },
    { kind: 'choice', key: 'gaugeNominal', label: 'Гайка G2', options: ['1/4', '3/8', '1/2'] },
    { kind: 'length', key: 'length', label: 'Длина A', min: 0.03, max: 0.1, step: 0.0005 },
    { kind: 'length', key: 'handleLength', label: 'Ручка', min: 0.03, max: 0.07, step: 0.001 },
  ];
  readonly defaults: GaugeTapParams = { inlet: 'internal', gaugeNominal: '1/4', length: 0.065, handleLength: 0.036 };

  private readonly parts = new BallValveParts();

  protected override layout(p: GaugeTapParams): Layout {
    const d = ThreadSizes.require(INLET, 'internal');
    const nut = ThreadSizes.require(p.gaugeNominal, 'internal');
    return { d, nut, x1: BallValveParts.threadLength(d), nutLength: Math.max(0.4 * nut.n, 0.01) };
  }

  /** Левая половина корпуса и правый корпус до шейки — не короче 4 мм. */
  protected override relations(p: GaugeTapParams, l: Layout): ValidationError[] {
    const left = this.inletLength(p, l) + 0.004;
    const right = VALVE_BODY_STEP + NECK + l.nutLength + 0.004;
    const minimum = 2 * Math.max(left, right);
    return p.length <= minimum ? [ParamSchema.tooShort('length', minimum)] : [];
  }

  protected create(p: GaugeTapParams, l: Layout): GeneratedModel {
    const { d, nut, x1, nutLength } = l;
    const half = p.length / 2;
    const at = (x: number) => ({ x, y: 0, z: 0 });
    const right = half - VALVE_BODY_STEP - NECK - nutLength;
    const neckStart = VALVE_BODY_STEP + right;
    const merger = new MaterialGroupMerger();
    merger.add(
      ...this.inlet(p, l, half),
      ...this.parts.bodyInlet(d, half - this.inletLength(p, l)),
      ...this.parts.bodyOutlet(d, right),
      ...this.parts.stemAndHandle(d, p.handleLength),
      // Патрубок под манометр: шейка и накидная гайка с внутренней резьбой G2.
      ...sleeves.build({ material: 'metal', length: NECK, outerDiameter: nut.n * 0.9, innerDiameter: 0.004, center: at(neckStart + NECK / 2) }),
      ...sleeves.build({ material: 'metal', length: nutLength, outerDiameter: nut.n * VALVE_NUT_SCALE * 1.1, innerDiameter: nut.v, outerSegments: 6,
        center: at(half - nutLength / 2), materials: { outer: 'metalFlat', inner: 'thread' } }),
      // Сервисный патрубок с винтом спереди корпуса.
      ...sleeves.build({ material: 'metal', length: SERVICE.length, outerDiameter: SERVICE.diameter, innerDiameter: 0,
        rotation: { x: 0, y: -Math.PI / 2, z: 0 }, center: { x: neckStart / 2, y: 0, z: (d.n + 0.015) / 2 + SERVICE.length / 2 - 0.002 } }),
      ...sleeves.build({ material: 'metalFlat', length: 0.002, outerDiameter: SERVICE.screw * 1.4, innerDiameter: 0,
        rotation: { x: 0, y: -Math.PI / 2, z: 0 }, center: { x: neckStart / 2, y: 0, z: (d.n + 0.015) / 2 + SERVICE.length - 0.001 } }),
    );
    const vt = p.inlet === 'external' ? 'VT.806' : 'VT.807';
    return createMeshModel({
      title: `Кран для манометра ${INLET}(${p.inlet === 'external' ? 'н' : 'в'}) × гайка ${p.gaugeNominal} (${vt})`,
      ...merger.merge(),
      connectors: [
        connector('inlet', ConnectorFrame.left, half, { nominal: INLET, joint: 'thread', gender: p.inlet, depth: x1 }),
        connector('gauge', ConnectorFrame.right, half, { nominal: p.gaugeNominal, joint: 'thread', gender: 'internal', depth: nutLength }),
      ],
    });
  }

  /** Длина конца входа: резьба, у наружной — ещё гайка 0,2 n. */
  private inletLength(p: GaugeTapParams, { d, x1 }: Layout): number {
    return x1 + (p.inlet === 'external' ? 0.2 * d.n : 0);
  }

  /** Вход у торца −half: как у valve.ball — гайка над внутренней резьбой или наружная резьба и гайка за ней. */
  private inlet(p: GaugeTapParams, { d, x1 }: Layout, half: number): GeometryPart[] {
    const at = (x: number) => ({ x, y: 0, z: 0 });
    const hex = { outerDiameter: d.n * VALVE_NUT_SCALE, innerDiameter: d.v + 0.001, outerSegments: 6, materials: { outer: 'metalFlat' } } as const;
    if (p.inlet === 'internal') {
      return [
        ...sleeves.build({ material: 'metal', ...hex, length: x1, center: at(-(half - x1 / 2)) }),
        ...sleeves.build({ material: 'metal', length: x1, outerDiameter: d.n, innerDiameter: d.v, center: at(-(half - x1 / 2)), materials: { inner: 'thread' } }),
      ];
    }
    const thread = ThreadSizes.require(INLET, 'external');
    const x2 = 0.2 * d.n;
    return [
      ...sleeves.build({ material: 'metal', length: x1, outerDiameter: thread.n, innerDiameter: thread.v, center: at(-(half - x1 / 2)), materials: { outer: 'thread' } }),
      ...sleeves.build({ material: 'metal', ...hex, length: x2, center: at(-(half - x1 - x2 / 2)) }),
    ];
  }
}
