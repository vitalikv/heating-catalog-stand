import { BaseGenerator } from '../../core/BaseGenerator';
import { connector } from '../../core/connector';
import { ConnectorFrame } from '../../core/ConnectorFrame';
import type { GeneratedModel, ParamSpec, ValidationError } from '../../core/contracts';
import { createMeshModel } from '../../core/MeshModel';
import { MaterialGroupMerger } from '../../geometry/MaterialGroupMerger';
import { sleeves } from '../../geometry/SleeveGeometryBuilder';
import { ParamSchema } from '../../params/ParamSchema';
import { specs } from '../../params/specs';
import { PpPipeSizes } from '../../sizes/PpPipeSizes';
import { ppSocket, ppSocketDepth } from './PpUnionParts';

export interface PpCapParams {
  nominal: string;
  /** Общая длина A, м. */
  length: number;
}

/**
 * ПП-заглушка под пайку (позиция 29) по VALTEC VTp.790 (каталог 2017, с. 134): раструб B
 * и глухое дно. Порт socket — торец раструба x = 0, смотрит −X; дно — в +X.
 */
export class PpCapGenerator extends BaseGenerator<PpCapParams> {
  readonly id = 'pp.cap';
  readonly version = 1;
  readonly title = 'Заглушка ПП';
  readonly defaults: PpCapParams = { nominal: '20', length: 0.0215 };
  readonly paramSpecs: readonly ParamSpec[] = [specs.ppNominal('nominal'), specs.length('length', 'Длина')];

  protected override relations(p: PpCapParams): ValidationError[] {
    const min = ppSocketDepth(p.nominal) + 0.003;
    return p.length < min ? [ParamSchema.tooShort('length', min)] : [];
  }

  protected create(p: PpCapParams): GeneratedModel {
    const d = PpPipeSizes.require(p.nominal);
    const socket = ppSocketDepth(p.nominal);
    const merger = new MaterialGroupMerger();
    merger.add(...ppSocket(d, 0, socket),
      ...sleeves.build({ material: 'plastic', length: p.length - socket, outerDiameter: d.n, innerDiameter: 0,
        center: { x: (socket + p.length) / 2, y: 0, z: 0 } }));
    return createMeshModel({
      title: `Заглушка ПП ${p.nominal}`,
      ...merger.merge(),
      connectors: [connector('socket', ConnectorFrame.left, { x: 0, y: 0, z: 0 }, { nominal: p.nominal, joint: 'pp-socket', gender: 'internal', depth: socket })],
    });
  }
}
