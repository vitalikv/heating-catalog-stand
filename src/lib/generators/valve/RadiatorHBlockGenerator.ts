import { BaseGenerator } from '../../core/BaseGenerator';
import { connector } from '../../core/connector';
import { ConnectorFrame } from '../../core/ConnectorFrame';
import type { Connector, GeneratedModel, ParamSpec, ValidationError } from '../../core/contracts';
import { createMeshModel } from '../../core/MeshModel';
import { MaterialGroupMerger } from '../../geometry/MaterialGroupMerger';
import { sleeves } from '../../geometry/SleeveGeometryBuilder';
import { ParamSchema } from '../../params/ParamSchema';
import { specs } from '../../params/specs';
import { orientParts, threadedArm, threadedSize, unionNut } from '../ThreadedParts';

export interface RadiatorHBlockParams {
  radiatorNominal: string;
  pipeNominal: string;
  spacing: number;
  /** Расстояние между торцами прямого исполнения; плечи углового — height/2. */
  height: number;
  configuration: 'straight' | 'angle';
}
type Layout = { radiator: ReturnType<typeof threadedSize>; pipe: ReturnType<typeof threadedSize> };

/** Двухтрубный H-блок с накидными гайками сверху и евроконусами снизу либо сзади. */
export class RadiatorHBlockGenerator extends BaseGenerator<RadiatorHBlockParams, Layout> {
  readonly id = 'valve.radiator-h-block';
  readonly version = 1;
  readonly title = 'Узел нижнего подключения радиатора';
  readonly defaults: RadiatorHBlockParams = { radiatorNominal: '3/4', pipeNominal: '3/4', spacing: 0.05, height: 0.06, configuration: 'straight' };
  readonly paramSpecs: readonly ParamSpec[] = [specs.threadNominal('radiatorNominal', 'Резьба к радиатору'),
    { kind: 'choice', key: 'pipeNominal', label: 'Евроконус к трубам', options: ['3/4'] },
    specs.length('spacing', 'Межосевое расстояние', { min: 0.03, max: 0.1 }), specs.length('height', 'Высота'),
    { kind: 'choice', key: 'configuration', label: 'Исполнение', options: ['straight', 'angle'], optionLabels: { straight: 'прямое', angle: 'угловое' } }];
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
    // Перемычка — механическая связь двух независимых каналов, не гидравлический байпас.
    merger.add(...sleeves.build({ material: 'metal', length: p.spacing, outerDiameter: 0.014, innerDiameter: 0 }));
    for (const [side, x] of [['left', -p.spacing / 2], ['right', p.spacing / 2]] as const) {
      const origin = { x, y: 0, z: 0 };
      merger.add(...orientParts([...threadedArm(d.radiator, 'internal', half), ...unionNut(d.radiator, half - d.radiator.depth / 2)], ConnectorFrame.top.direction, origin),
        ...orientParts([...threadedArm(d.pipe, 'external', half - 0.003),
          ...sleeves.build({ material: 'metal', length: 0.003, outerDiameterStart: d.pipe.n, outerDiameter: d.pipe.v,
            innerDiameter: d.pipe.v * 0.8, center: { x: half - 0.0015, y: 0, z: 0 } })], output.direction, origin),
        ...orientParts(sleeves.build({ material: 'metalFlat', length: 0.008, outerDiameter: 0.015, innerDiameter: 0,
          outerSegments: 6, center: { x: 0.013, y: 0, z: 0 } }), { x: 0, y: 0, z: 1 }, origin));
      connectors.push(connector(`radiator-${side}`, ConnectorFrame.top, { x, y: half, z: 0 },
        { nominal: p.radiatorNominal, joint: 'thread', gender: 'internal', depth: d.radiator.depth }),
      connector(`pipe-${side}`, output, { x, y: output.direction.y * half, z: output.direction.z * half },
        { nominal: p.pipeNominal, joint: 'eurocone', gender: 'external', depth: 0.003 }));
    }
    return createMeshModel({ title: `H-блок ${p.configuration === 'straight' ? 'прямой' : 'угловой'}, ${Math.round(p.spacing * 1000)} мм`, ...merger.merge(), connectors });
  }
}
