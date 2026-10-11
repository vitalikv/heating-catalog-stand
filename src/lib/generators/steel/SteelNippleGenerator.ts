import { BaseGenerator } from '../../core/BaseGenerator';
import { connector } from '../../core/connector';
import { ConnectorFrame } from '../../core/ConnectorFrame';
import type { GeneratedModel, ParamSpec, ValidationError } from '../../core/contracts';
import { createMeshModel } from '../../core/MeshModel';
import { MaterialGroupMerger } from '../../geometry/MaterialGroupMerger';
import { sleeves } from '../../geometry/SleeveGeometryBuilder';
import type { SleeveShape } from '../../geometry/SleeveGeometryBuilder';
import { ParamSchema } from '../../params/ParamSchema';
import { specs } from '../../params/specs';
import { ThreadSizes } from '../../sizes/ThreadSizes';
import type { PartDiameters } from '../../sizes/ThreadSizes';

export interface SteelNippleParams {
  /** Дюймовый номинал наружной резьбы слева, например '1/2'. */
  nominalLeft: string;
  /** Номинал справа. */
  nominalRight: string;
  /** Длина ниппеля, м. */
  length: number;
  /** С версии 2: обычный или сдвоенный коллекторный с кольцами EPDM (VALTEC VT.0606). */
  kind?: 'plain' | 'double';
}

/** Длина резьбового участка — 0,3 наружного диаметра в пределах 8…12 мм. */
const MIN_THREAD_LENGTH = 0.008;
const MAX_THREAD_LENGTH = 0.012;
const HEX_SEGMENTS = 6;
/**
 * Сдвоенный ниппель VALTEC VT.0606 (технический каталог 2017, с. 205): шестигранник D и размер под ключ E
 * по таблице; выпускается только 1" и 1 1/4" с одинаковой резьбой. Кольца EPDM у граней шестигранника — условно.
 */
const DOUBLE_HEX: Readonly<Record<string, { length: number; key: number }>> = {
  '1': { length: 0.016, key: 0.037 },
  '1 1/4': { length: 0.02, key: 0.048 },
};
const O_RING = 0.002;

interface NippleLayout {
  d1: PartDiameters;
  d2: PartDiameters;
  /** Длины резьбовых участков слева и справа. */
  x1: number;
  x2: number;
  /** Шестигранник: длина и описанный диаметр. */
  hexLength: number;
  hexDiameter: number;
}

/**
 * Стальной ниппель с наружной резьбой с двух сторон (перенос st_nippel_1).
 * Версия 2: kind 'double' — сдвоенный коллекторный ниппель VT.0606 (позиция 88): длинный шестигранник
 * по таблице и кольца EPDM у его граней. Умолчание — прежний ниппель.
 */
export class SteelNippleGenerator extends BaseGenerator<SteelNippleParams, NippleLayout> {
  readonly id = 'steel.nipple';
  readonly version = 2;
  readonly title = 'Ниппель стальной';
  readonly paramSpecs: readonly ParamSpec[] = [
    specs.threadNominal('nominalLeft', 'Резьба слева'),
    specs.threadNominal('nominalRight', 'Резьба справа'),
    specs.length('length', 'Длина'),
    { kind: 'choice', key: 'kind', label: 'Исполнение', options: ['plain', 'double'],
      optionLabels: { plain: 'обычный', double: 'сдвоенный (VT.0606)' }, addedIn: 2 },
  ];
  readonly defaults: SteelNippleParams = { nominalLeft: '1/2', nominalRight: '1/2', length: 0.022, kind: 'plain' };

  protected override layout(params: SteelNippleParams): NippleLayout {
    const d1 = ThreadSizes.require(params.nominalLeft, 'external');
    const d2 = ThreadSizes.require(params.nominalRight, 'external');
    const threadLength = (d: PartDiameters) => Math.min(Math.max(0.015 * d.n * 20, MIN_THREAD_LENGTH), MAX_THREAD_LENGTH);
    const maxN = Math.max(d1.n, d2.n);
    const double = params.kind === 'double' ? DOUBLE_HEX[params.nominalLeft] : undefined;
    // Описанный диаметр шестигранника — размер под ключ / cos 30°.
    const hex = double ? { hexLength: double.length, hexDiameter: double.key / Math.cos(Math.PI / 6) } : { hexLength: maxN / 7, hexDiameter: maxN + maxN / 4 };
    return { d1, d2, x1: threadLength(d1), x2: threadLength(d2), ...hex };
  }

  protected override relations(params: SteelNippleParams, { x1, x2, hexLength }: NippleLayout): ValidationError[] {
    if (params.kind === 'double') {
      if (!DOUBLE_HEX[params.nominalLeft] || params.nominalRight !== params.nominalLeft) {
        return [{ code: 'incompatible', param: 'kind', message: `Сдвоенный ниппель VT.0606 — только 1 × 1 и 1 1/4 × 1 1/4` }];
      }
      // Резьба не заходит под шестигранник; кольцо EPDM лежит на её начале.
      const minimum = 2 * (Math.max(x1, x2) + hexLength / 2);
      return params.length <= minimum ? [ParamSchema.tooShort('length', minimum)] : [];
    }
    // Гладкий участок нулевой длины считается ошибкой, как у муфты.
    const thread = Math.max(x1, x2);
    return params.length / 2 <= thread ? [ParamSchema.tooShort('length', 2 * thread)] : [];
  }

  protected create(params: SteelNippleParams, { d1, d2, x1, x2, hexLength, hexDiameter }: NippleLayout): GeneratedModel {
    const x3L = params.length / 2 - x1;
    const x3R = params.length / 2 - x2;
    const at = (x: number) => ({ x, y: 0, z: 0 });
    const thread: Partial<SleeveShape> = { materials: { outer: 'thread' } };

    const merger = new MaterialGroupMerger();
    merger.add(
      // Резьба и гладкая часть слева
      ...sleeves.build({ material: 'metal', ...thread, length: x1, outerDiameter: d1.n, innerDiameter: d1.v, center: at(-(x3L + x1 / 2)) }),
      ...sleeves.build({ material: 'metal', length: x3L, outerDiameter: d1.n, innerDiameter: d1.v, center: at(-x3L / 2) }),
      // Шестигранник: длина n/7, описанный диаметр n + n/4; у сдвоенного — по таблице VT.0606
      ...sleeves.build({
        material: 'metal',
        length: hexLength,
        outerDiameter: hexDiameter,
        innerDiameter: Math.min(d1.v, d2.v) + 0.001,
        outerSegments: HEX_SEGMENTS,
      }),
      // Гладкая часть и резьба справа
      ...sleeves.build({ material: 'metal', length: x3R, outerDiameter: d2.n, innerDiameter: d2.v, center: at(x3R / 2) }),
      ...sleeves.build({ material: 'metal', ...thread, length: x2, outerDiameter: d2.n, innerDiameter: d2.v, center: at(x3R + x2 / 2) }),
    );
    if (params.kind === 'double') {
      // Кольца EPDM прижимаются к граням шестигранника.
      for (const [side, d] of [[-1, d1], [1, d2]] as const) {
        merger.add(...sleeves.build({ material: 'black', length: O_RING, outerDiameter: d.n + 0.003, innerDiameter: d.n,
          center: at(side * (hexLength / 2 + O_RING / 2)) }));
      }
    }

    // Торцы — концы резьбы (±length/2), глубина — длина резьбового участка.
    // В gl2 точка разъёма стояла в центре резьбового участка.
    const common = { joint: 'thread', gender: 'external' } as const;
    return createMeshModel({
      title: params.kind === 'double' ? `Ниппель сдвоенный ${params.nominalLeft}(н)` : params.nominalLeft === params.nominalRight ? `Ниппель ${params.nominalLeft}(н)` : `Ниппель ${params.nominalLeft}(н)х${params.nominalRight}(н)`,
      ...merger.merge(),
      connectors: [
        connector('left', ConnectorFrame.left, params.length / 2, { depth: x1, nominal: params.nominalLeft, ...common }),
        connector('right', ConnectorFrame.right, params.length / 2, { depth: x2, nominal: params.nominalRight, ...common }),
      ],
    });
  }
}
