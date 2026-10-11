import { BaseGenerator } from '../../core/BaseGenerator';
import { connector } from '../../core/connector';
import { ConnectorFrame } from '../../core/ConnectorFrame';
import type { GeneratedModel, ParamSpec, ValidationError } from '../../core/contracts';
import { createMeshModel } from '../../core/MeshModel';
import { MaterialGroupMerger } from '../../geometry/MaterialGroupMerger';
import type { GeometryPart } from '../../geometry/MaterialGroupMerger';
import { sleeves } from '../../geometry/SleeveGeometryBuilder';
import { spheres } from '../../geometry/SphereGeometryBuilder';
import { ParamSchema } from '../../params/ParamSchema';
import { specs } from '../../params/specs';
import { ThreadSizes } from '../../sizes/ThreadSizes';
import { orientParts } from '../ThreadedParts';
import { BallValveParts, VALVE_BODY_STEP, VALVE_NUT_SCALE } from './BallValveParts';
import type { UnionValveLayout } from './BallValveParts';

export interface BallValveUnionParams {
  /** Номинал резьбы со стороны крана и наружной резьбы сгона, например '1/2'. */
  nominal: string;
  /** Номинал наружной резьбы справа на кране и накидной гайки сгона, например '3/4'. */
  unionNominal: string;
  /** Длина крана без сгона, м; у углового — удвоенный вылет корпуса вправо от оси, как у прямого. */
  length: number;
  /** Длина сгона, м. */
  unionLength: number;
  /** Длина ручки-бабочки, м. */
  handleLength: number;
  /** С версии 2: резьба со стороны крана — внутренняя (VT.227, gl2) или наружная (VT.226). */
  valveEnd?: 'internal' | 'external';
  /** С версии 2: прямой или угловой (VT.228: вход снизу, только внутренняя резьба). */
  configuration?: 'straight' | 'angle';
  /** С версии 2: у углового — от оси прохода до торца входа (Г), м. */
  inletLength?: number;
}

/**
 * Шаровой кран с полусгоном (перенос shar_kran_sgon_1): слева резьба nominal,
 * справа наружная резьба unionNominal, на неё навёрнут сгон с наружной резьбой nominal на конце.
 * Версия 2: valveEnd 'external' — слева наружная резьба за гайкой 0,2 n, как у valve.ball н-н
 * (VALTEC VT.226, позиция 133); configuration 'angle' — вход внутренней резьбой вниз на inletLength
 * (VT.228, позиция 95). Умолчания — прежний кран gl2 (VT.227).
 */
export class BallValveUnionGenerator extends BaseGenerator<BallValveUnionParams, UnionValveLayout> {
  readonly id = 'valve.ball-union';
  readonly version = 2;
  readonly title = 'Кран шаровой с полусгоном';
  readonly paramSpecs: readonly ParamSpec[] = [
    specs.threadNominal('nominal', 'Резьба'),
    specs.threadNominal('unionNominal', 'Резьба гайки сгона'),
    specs.length('length', 'Длина крана', { max: 0.3 }),
    specs.length('unionLength', 'Длина сгона'),
    specs.length('handleLength', 'Ручка', { min: 0.01, step: 0.001 }),
    { kind: 'choice', key: 'valveEnd', label: 'Резьба крана', options: ['internal', 'external'],
      optionLabels: { internal: 'внутренняя', external: 'наружная' }, addedIn: 2 },
    { kind: 'choice', key: 'configuration', label: 'Исполнение', options: ['straight', 'angle'],
      optionLabels: { straight: 'прямое', angle: 'угловое' }, addedIn: 2 },
    { ...specs.length('inletLength', 'Вход от оси'), when: { key: 'configuration', values: ['angle'] }, addedIn: 2 },
  ];
  readonly defaults: BallValveUnionParams = {
    nominal: '1/2',
    unionNominal: '3/4',
    length: 0.055,
    unionLength: 0.026,
    handleLength: 0.053,
    valveEnd: 'internal',
    configuration: 'straight',
    inletLength: 0.031,
  };

  private readonly parts = new BallValveParts();

  protected override layout(params: BallValveUnionParams): UnionValveLayout {
    const d1 = ThreadSizes.require(params.nominal, 'internal');
    return { d1, d2: ThreadSizes.require(params.unionNominal, 'external'), x1: BallValveParts.threadLength(d1) };
  }

  protected override relations(params: BallValveUnionParams, { d1, x1 }: UnionValveLayout): ValidationError[] {
    const errors: ValidationError[] = [];
    // Правая часть корпуса (x_2R) и гладкий участок сгона (x_3R) были бы нулевой или отрицательной длины.
    const minimum = 2 * (VALVE_BODY_STEP + x1 + 0.01 * d1.n * 20);
    if (params.length <= minimum) errors.push(ParamSchema.tooShort('length', minimum));
    const union = BallValveParts.unionPipeLength(params.nominal, params.unionLength);
    if (union <= 0) errors.push(ParamSchema.tooShort('unionLength', params.unionLength - union));
    if (params.configuration === 'angle') {
      // VT.228 выпускается только с внутренней резьбой входа.
      if (params.valveEnd === 'external') {
        errors.push({ code: 'incompatible', param: 'valveEnd', message: 'Угловой кран с полусгоном — только с внутренней резьбой входа (VT.228)' });
      }
      // Гладкий участок входа выходит из-под правой части корпуса.
      const inlet = x1 + (d1.n + 0.015) / 2;
      if (params.inletLength! <= inlet) errors.push(ParamSchema.tooShort('inletLength', inlet));
    }
    return errors;
  }

  protected create(params: BallValveUnionParams, { d1, d2, x1 }: UnionValveLayout): GeneratedModel {
    const half = params.length / 2;
    const x2 = 0.01 * d1.n * 20;
    const right = half - VALVE_BODY_STEP - x2 - x1;
    const at = (x: number) => ({ x, y: 0, z: 0 });
    const angle = params.configuration === 'angle';
    const external = params.valveEnd === 'external';
    // Сгон: гайка unionNominal на резьбе крана, со сдвигом на 0,1 её длины от начала резьбы.
    const union = this.parts.union(params.unionNominal, params.nominal, params.unionLength, VALVE_BODY_STEP + right + x1 * 0.1);
    // Вход — по −X до reach; у углового повёрнут вниз.
    const reach = angle ? params.inletLength! : half;
    const inlet = [...this.inletEnd(params.nominal, d1, external, reach), ...this.parts.bodyInlet(d1, reach - x1 - (external ? x2 : 0))];

    const merger = new MaterialGroupMerger();
    merger.add(
      ...(angle ? orientParts(inlet, ConnectorFrame.top.direction) : inlet),
      ...this.parts.bodyOutlet(d1, right),
      ...this.parts.stemAndHandle(d1, params.handleLength),
      // Справа: наружная резьба крана под гайкой сгона
      ...sleeves.build({ material: 'metal', length: x1, outerDiameter: d2.n, innerDiameter: d2.v, center: at(VALVE_BODY_STEP + right + x1 / 2), materials: { outer: 'thread' } }),
      ...union.parts,
    );
    // У углового стык входа и прохода закрыт корпусом шара.
    if (angle) merger.add(spheres.build({ material: 'metal', radius: (d1.n + 0.015) / 2 }));

    // Слева — торец крана, глубина — резьба. Справа — конец резьбы сгона, глубина — вся его резьба.
    // В gl2 точки стояли в центрах резьбы крана и концевой резьбы сгона.
    const common = { nominal: params.nominal, joint: 'thread' } as const;
    const inletFrame = angle ? ConnectorFrame.bottom : ConnectorFrame.left;
    const kind = angle ? 'угловой ' : '';
    return createMeshModel({
      title: `Шаровой кран ${kind}с полусгоном ${params.nominal}${external ? ' (н)' : ''}`,
      ...merger.merge(),
      connectors: [
        connector('left', inletFrame, reach, { depth: x1, gender: external ? 'external' : 'internal', ...common }),
        connector('right', ConnectorFrame.right, union.end, { depth: union.threadLength, gender: 'external', ...common }),
      ],
    });
  }

  /**
   * Конец входа у торца −reach: внутренняя резьба под гайкой длиной резьбы x_1 либо, как у valve.ball н-н,
   * наружная резьба x_1 и за ней гайка 0,2 n по диаметрам корпуса.
   */
  private inletEnd(nominal: string, d1: UnionValveLayout['d1'], external: boolean, reach: number): GeometryPart[] {
    const x1 = BallValveParts.threadLength(d1);
    const at = (x: number) => ({ x, y: 0, z: 0 });
    const nut = { outerDiameter: d1.n * VALVE_NUT_SCALE, outerSegments: 6, materials: { outer: 'metalFlat' } } as const;
    if (!external) {
      return [
        ...sleeves.build({ material: 'metal', ...nut, length: x1, innerDiameter: d1.v + 0.001, center: at(-(reach - x1 / 2)) }),
        ...sleeves.build({ material: 'metal', length: x1, outerDiameter: d1.n, innerDiameter: d1.v, center: at(-(reach - x1 / 2)), materials: { inner: 'thread' } }),
      ];
    }
    const x2 = 0.01 * d1.n * 20;
    const thread = ThreadSizes.require(nominal, 'external');
    return [
      ...sleeves.build({ material: 'metal', length: x1, outerDiameter: thread.n, innerDiameter: thread.v, center: at(-(reach - x1 / 2)), materials: { outer: 'thread' } }),
      ...sleeves.build({ material: 'metal', ...nut, length: x2, innerDiameter: d1.v + 0.001, center: at(-(reach - x1 - x2 / 2)) }),
    ];
  }
}
