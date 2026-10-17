import { BaseGenerator } from '../../core/BaseGenerator';
import { connector } from '../../core/connector';
import { ConnectorFrame } from '../../core/ConnectorFrame';
import type { Connector, GeneratedModel, ParamSpec, ThreadGender, ValidationError } from '../../core/contracts';
import { createMeshModel } from '../../core/MeshModel';
import { MaterialGroupMerger } from '../../geometry/MaterialGroupMerger';
import type { GeometryPart } from '../../geometry/MaterialGroupMerger';
import { sleeves } from '../../geometry/SleeveGeometryBuilder';
import type { SleeveShape } from '../../geometry/SleeveGeometryBuilder';
import { ParamSchema } from '../../params/ParamSchema';
import { specs } from '../../params/specs';
import { ThreadSizes } from '../../sizes/ThreadSizes';
import type { PartDiameters } from '../../sizes/ThreadSizes';
import { BallValveParts, VALVE_BODY_STEP, VALVE_NUT_SCALE } from './BallValveParts';

/** Резьба концов крана: обе внутренние, обе наружные, слева внутренняя и справа наружная. */
export type BallValveEnds = 'internal' | 'external' | 'internal-external';

export interface BallValveParams {
  ends: BallValveEnds;
  /** Дюймовый номинал резьбы обоих концов, например '1/2'. */
  nominal: string;
  /** Длина крана, м. */
  length: number;
  /** Длина ручки-бабочки, м; у рычага и ручки с термометром — вылет рычага от оси штока. */
  handleLength: number;
  /** С версии 2: ручка-бабочка (gl2), рычаг или ручка с термометром (VALTEC VT.808). */
  handle?: 'butterfly' | 'lever' | 'thermometer';
  /** С версии 2: гнездо M10×1 под датчик температуры снизу (VALTEC VT.247). */
  sensorPort?: 'none' | 'M10x1';
}

/** VT.808 (технический каталог 2017, с. 310): циферблат D = 41 мм, верх ручки B = 67 / 72 мм над осью для 1/2, 3/4. */
const THERMOMETER_HANDLE: Readonly<Record<string, number>> = { '1/2': 0.067, '3/4': 0.072 };
const THERMOMETER_DIAL = 0.041;
/** VT.247 (с. 301): гнездо датчика M10×1 снизу, 1/2…1; вылет гнезда от оси — 1,6 n, Ø16 мм, резьба 8 мм — условно. */
const SENSOR_NOMINALS = ['1/2', '3/4', '1'];
const SENSOR = { nominal: 'M10x1', boss: 0.016, bore: 0.009, depth: 0.008, reach: 1.6 };

/** Концы слева и справа и суффикс названия. */
const ENDS: Record<BallValveEnds, { left: ThreadGender; right: ThreadGender; suffix: string }> = {
  internal: { left: 'internal', right: 'internal', suffix: '(в-в)' },
  external: { left: 'external', right: 'external', suffix: '(н-н)' },
  'internal-external': { left: 'internal', right: 'external', suffix: '(в-н)' },
};

/**
 * Шаровой кран с резьбой на обоих концах (перенос shar_kran_v_1, shar_kran_n_1, shar_kran_v_n_1).
 * Версия 2: handle — рычаг или ручка с термометром (VT.808, позиция 93), sensorPort — гнездо датчика
 * температуры M10×1 снизу (VT.247, позиция 94). Умолчания — прежний кран с бабочкой.
 * Три функции gl2 отличаются только концами — здесь это параметр ends. Внутренняя резьба — под
 * шестигранной гайкой той же длины, наружная — снаружи, за гайкой длиной 0,2 n.
 * Шток и ручка — вверх (+Y), часть общего меша.
 */
export class BallValveGenerator extends BaseGenerator<BallValveParams, PartDiameters> {
  readonly id = 'valve.ball';
  readonly version = 2;
  readonly title = 'Кран шаровой';
  readonly paramSpecs: readonly ParamSpec[] = [
    {
      kind: 'choice',
      key: 'ends',
      label: 'Концы',
      options: ['internal', 'external', 'internal-external'],
      optionLabels: { internal: 'в-в', external: 'н-н', 'internal-external': 'в-н' },
    },
    specs.threadNominal('nominal', 'Резьба'),
    specs.length('length', 'Длина', { max: 0.3 }),
    specs.length('handleLength', 'Длина ручки', { min: 0.01, step: 0.001 }),
    { kind: 'choice', key: 'handle', label: 'Ручка', options: ['butterfly', 'lever', 'thermometer'],
      optionLabels: { butterfly: 'бабочка', lever: 'рычаг', thermometer: 'с термометром' }, addedIn: 2 },
    { kind: 'choice', key: 'sensorPort', label: 'Гнездо датчика', options: ['none', 'M10x1'], optionLabels: { none: 'нет', M10x1: 'M10×1 снизу' }, addedIn: 2 },
  ];
  readonly defaults: BallValveParams = { ends: 'external', nominal: '1/2', length: 0.063, handleLength: 0.053, handle: 'butterfly', sensorPort: 'none' };

  private readonly parts = new BallValveParts();

  /** Диаметры корпуса: у крана н-н — по наружной резьбе, иначе по внутренней. */
  protected override layout(params: BallValveParams): PartDiameters {
    return ThreadSizes.require(params.nominal, ENDS[params.ends].left);
  }

  protected override relations(params: BallValveParams, d: PartDiameters): ValidationError[] {
    // Правая часть корпуса (x_2R в gl2) была бы нулевой или отрицательной длины.
    const minimum = 2 * (VALVE_BODY_STEP + this.endLength(d, ENDS[params.ends].right));
    const errors = params.length <= minimum ? [ParamSchema.tooShort('length', minimum)] : [];
    // Только выпускаемые исполнения: VT.808 и VT.247 — в-в.
    if (params.handle === 'thermometer' && (params.ends !== 'internal' || !(params.nominal in THERMOMETER_HANDLE))) {
      errors.push({ code: 'incompatible', param: 'handle', message: 'Ручка с термометром — только кран в-в 1/2 и 3/4 (VT.808)' });
    }
    if (params.sensorPort === 'M10x1' && (params.ends !== 'internal' || !SENSOR_NOMINALS.includes(params.nominal))) {
      errors.push({ code: 'incompatible', param: 'sensorPort', message: 'Гнездо датчика — только кран в-в 1/2, 3/4, 1 (VT.247)' });
    }
    return errors;
  }

  protected create(params: BallValveParams, d: PartDiameters): GeneratedModel {
    const variant = ENDS[params.ends];
    const left = variant.left;
    const half = params.length / 2;
    const x1 = BallValveParts.threadLength(d);

    const merger = new MaterialGroupMerger();
    merger.add(
      ...this.end(params.nominal, d, left, -1, half),
      ...this.parts.body(d, half - this.endLength(d, left), half - VALVE_BODY_STEP - this.endLength(d, variant.right)),
      ...this.handle(params, d),
      ...this.end(params.nominal, d, variant.right, 1, half),
    );
    const sensor = params.sensorPort === 'M10x1';
    if (sensor) merger.add(...this.sensorBoss(d));

    // Торцы — концы крана (±length/2), глубина — длина резьбы. В gl2 точки — в центрах резьбы.
    const common = { depth: x1, nominal: params.nominal, joint: 'thread' } as const;
    const connectors: Connector[] = [
      connector('left', ConnectorFrame.left, half, { gender: left, ...common }),
      connector('right', ConnectorFrame.right, half, { gender: variant.right, ...common }),
    ];
    // Гнездо датчика — свободная граница: датчиков температуры в каталоге нет.
    if (sensor) {
      connectors.push(connector('sensor', ConnectorFrame.bottom, SENSOR.reach * d.n,
        { nominal: SENSOR.nominal, joint: 'thread', gender: 'internal', depth: SENSOR.depth }));
    }
    const extras = `${params.handle === 'thermometer' ? ', с термометром' : ''}${sensor ? ', гнездо датчика M10×1' : ''}`;
    return createMeshModel({
      title: `Шаровой кран ${params.nominal}${variant.suffix}${extras}`,
      ...merger.merge(),
      connectors,
    });
  }

  /** Шток и ручка выбранного исполнения. */
  private handle(params: BallValveParams, d: PartDiameters): GeometryPart[] {
    if (params.handle === 'lever') return [...this.parts.stem(d), ...this.parts.lever(d, params.handleLength)];
    if (params.handle === 'thermometer') {
      return [...this.parts.stem(d), ...this.parts.thermometerHandle(d, params.handleLength, THERMOMETER_HANDLE[params.nominal], THERMOMETER_DIAL)];
    }
    return this.parts.stemAndHandle(d, params.handleLength);
  }

  /** Бобышка гнезда датчика вниз от корпуса с внутренней резьбой на конце. */
  private sensorBoss(d: PartDiameters): GeometryPart[] {
    const reach = SENSOR.reach * d.n;
    const from = d.v / 2;
    const down = { x: 0, y: 0, z: Math.PI / 2 };
    return [
      ...sleeves.build({ material: 'metal', length: reach - from - SENSOR.depth, outerDiameter: SENSOR.boss, innerDiameter: 0.004, rotation: down,
        center: { x: 0, y: -(from + reach - SENSOR.depth) / 2, z: 0 } }),
      ...sleeves.build({ material: 'metal', length: SENSOR.depth, outerDiameter: SENSOR.boss, innerDiameter: SENSOR.bore, rotation: down,
        center: { x: 0, y: -(reach - SENSOR.depth / 2), z: 0 }, materials: { inner: 'thread' } }),
    ];
  }

  /** Длина конца от торца до корпуса: резьба, у наружной — ещё гайка 0,2 n. */
  private endLength(d: PartDiameters, gender: ThreadGender): number {
    return BallValveParts.threadLength(d) + (gender === 'external' ? 0.01 * d.n * 20 : 0);
  }

  /** Конец крана со стороны side (−1 — слева, 1 — справа); гайка — по диаметрам корпуса d. */
  private end(nominal: string, d: PartDiameters, gender: ThreadGender, side: number, half: number): GeometryPart[] {
    const x1 = BallValveParts.threadLength(d);
    const at = (x: number) => ({ x: side * x, y: 0, z: 0 });
    const nut = { outerDiameter: d.n * VALVE_NUT_SCALE, innerDiameter: d.v + 0.001, outerSegments: 6, materials: { outer: 'metalFlat' } } satisfies Partial<SleeveShape>;

    if (gender === 'internal') {
      return [
        ...sleeves.build({ material: 'metal', ...nut, length: x1, center: at(half - x1 / 2) }),
        ...sleeves.build({ material: 'metal', length: x1, outerDiameter: d.n, innerDiameter: d.v, center: at(half - x1 / 2), materials: { inner: 'thread' } }),
      ];
    }
    const x2 = 0.01 * d.n * 20;
    const external = ThreadSizes.require(nominal, 'external');
    return [
      ...sleeves.build({ material: 'metal', length: x1, outerDiameter: external.n, innerDiameter: external.v, center: at(half - x1 / 2), materials: { outer: 'thread' } }),
      ...sleeves.build({ material: 'metal', ...nut, length: x2, center: at(half - x1 - x2 / 2) }),
    ];
  }
}
