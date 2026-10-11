import { BaseGenerator } from '../../core/BaseGenerator';
import { connector } from '../../core/connector';
import { ConnectorFrame } from '../../core/ConnectorFrame';
import type { Connector, GeneratedModel, ParamSpec, ValidationError } from '../../core/contracts';
import { createMeshModel } from '../../core/MeshModel';
import { MaterialGroupMerger } from '../../geometry/MaterialGroupMerger';
import { shapes } from '../../geometry/ExtrudedShapeBuilder';
import { sleeves } from '../../geometry/SleeveGeometryBuilder';
import { spheres } from '../../geometry/SphereGeometryBuilder';
import { ParamSchema } from '../../params/ParamSchema';
import { specs } from '../../params/specs';
import { angleCorner, armBodyDiameter, EUROCONE_TIP, euroconeArm, orientParts, threadedArm, threadedSize, unionNut } from '../ThreadedParts';

export interface RadiatorHBlockParams {
  radiatorNominal: string;
  pipeNominal: string;
  spacing: number;
  /** Расстояние между торцами прямого исполнения; плечи углового — height/2. */
  height: number;
  configuration: 'straight' | 'angle';
  /** Версия 3: запорные шаровые краны в каналах, как VALTEC VT.345K (позиция 100). Нет — прежняя модель. */
  shutoff?: 'none' | 'ball';
}
type Layout = { radiator: ReturnType<typeof threadedSize>; pipe: ReturnType<typeof threadedSize> };

/** Шестигранник под ключ спереди канала (+Z): длина и описанный диаметр, м. */
const KEY_BOSS = { length: 0.008, diameter: 0.015 };
/** Шлиц шарового крана на торце шестигранника, м — условно. */
const SLOT = { width: 0.0016, length: 0.009, depth: 0.0005 };

/**
 * Двухтрубный H-блок с накидными гайками сверху и евроконусами снизу либо сзади.
 * Версия 2: глубина выхода евроконуса — резьба и носик (раньше только носик 3 мм), чтобы
 * накидная гайка фитинга садилась на резьбу. Геометрия не изменилась.
 * Версия 3: shutoff 'ball' — шар запорного крана в каждом канале на оси перемычки, шестигранник
 * со шлицем вынесен за шар (VT.345K, каталог 2017, с. 520). Порты не меняются.
 */
export class RadiatorHBlockGenerator extends BaseGenerator<RadiatorHBlockParams, Layout> {
  readonly id = 'valve.radiator-h-block';
  readonly version = 3;
  readonly title = 'Узел нижнего подключения радиатора';
  readonly defaults: RadiatorHBlockParams = { radiatorNominal: '3/4', pipeNominal: '3/4', spacing: 0.05, height: 0.06, configuration: 'straight', shutoff: 'none' };
  readonly paramSpecs: readonly ParamSpec[] = [specs.threadNominal('radiatorNominal', 'Резьба к радиатору'),
    { kind: 'choice', key: 'pipeNominal', label: 'Евроконус к трубам', options: ['3/4'] },
    specs.length('spacing', 'Межосевое расстояние', { min: 0.03, max: 0.1 }), specs.length('height', 'Высота'),
    { kind: 'choice', key: 'configuration', label: 'Исполнение', options: ['straight', 'angle'], optionLabels: { straight: 'прямое', angle: 'угловое' } },
    { kind: 'choice', key: 'shutoff', label: 'Запорные краны', options: ['none', 'ball'], optionLabels: { none: 'нет', ball: 'шаровые' }, addedIn: 3 }];
  protected override layout(p: RadiatorHBlockParams): Layout {
    return { radiator: threadedSize(p.radiatorNominal, 'internal'), pipe: threadedSize(p.pipeNominal, 'external') };
  }
  protected override relations(p: RadiatorHBlockParams, d: Layout): ValidationError[] {
    const errors: ValidationError[] = [];
    const minimum = 2 * Math.max(d.radiator.depth + 0.005, d.pipe.depth + 0.005);
    if (p.height <= minimum) errors.push(ParamSchema.tooShort('height', minimum));
    const width = Math.max(d.radiator.n * 1.6, d.pipe.n * 1.3);
    if (p.spacing <= width) errors.push(ParamSchema.tooShort('spacing', width));
    return errors;
  }
  protected create(p: RadiatorHBlockParams, d: Layout): GeneratedModel {
    const merger = new MaterialGroupMerger();
    const connectors: Connector[] = [];
    const output = p.configuration === 'straight' ? ConnectorFrame.bottom : ConnectorFrame.back;
    const half = p.height / 2;
    const ball = p.shutoff === 'ball' ? armBodyDiameter(d.radiator, 'internal') * 0.55 : 0;
    // Без кранов шестигранник начинается внутри корпуса канала, как в версии 2.
    const bossStart = ball > 0 ? ball - 0.001 : 0.009;
    // Перемычка — механическая связь двух независимых каналов, не гидравлический байпас.
    merger.add(...sleeves.build({ material: 'metal', length: p.spacing, outerDiameter: 0.014, innerDiameter: 0 }));
    for (const [side, x] of [['left', -p.spacing / 2], ['right', p.spacing / 2]] as const) {
      const origin = { x, y: 0, z: 0 };
      merger.add(...orientParts([...threadedArm(d.radiator, 'internal', half), ...unionNut(d.radiator, half - d.radiator.depth / 2)], ConnectorFrame.top.direction, origin),
        ...orientParts(euroconeArm(d.pipe, half), output.direction, origin),
        ...orientParts(sleeves.build({ material: 'metalFlat', length: KEY_BOSS.length, outerDiameter: KEY_BOSS.diameter, innerDiameter: 0,
          outerSegments: 6, center: { x: bossStart + KEY_BOSS.length / 2, y: 0, z: 0 } }), { x: 0, y: 0, z: 1 }, origin));
      if (ball > 0) {
        merger.add(spheres.build({ material: 'metal', radius: ball, center: origin }),
          shapes.build({ material: 'black', depth: SLOT.depth, position: { x, y: 0, z: bossStart + KEY_BOSS.length },
            points: [{ x: -SLOT.length / 2, y: -SLOT.width / 2 }, { x: SLOT.length / 2, y: -SLOT.width / 2 },
              { x: SLOT.length / 2, y: SLOT.width / 2 }, { x: -SLOT.length / 2, y: SLOT.width / 2 }] }));
      }
      // Конус у основания трубного плеча не заходит на резьбу.
      if (p.configuration === 'angle') merger.add(...angleCorner(d.radiator, d.pipe, ConnectorFrame.top.direction, output.direction, half - EUROCONE_TIP - d.pipe.depth, origin));
      connectors.push(connector(`radiator-${side}`, ConnectorFrame.top, { x, y: half, z: 0 },
        { nominal: p.radiatorNominal, joint: 'thread', gender: 'internal', depth: d.radiator.depth }),
      connector(`pipe-${side}`, output, { x, y: output.direction.y * half, z: output.direction.z * half },
        { nominal: p.pipeNominal, joint: 'eurocone', gender: 'external', depth: d.pipe.depth + EUROCONE_TIP }));
    }
    const shutoff = p.shutoff === 'ball' ? ' с кранами' : '';
    return createMeshModel({ title: `H-блок ${p.configuration === 'straight' ? 'прямой' : 'угловой'}${shutoff}, ${Math.round(p.spacing * 1000)} мм`, ...merger.merge(), connectors });
  }
}
