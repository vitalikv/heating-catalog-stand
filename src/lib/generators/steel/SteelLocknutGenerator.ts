import { BaseGenerator } from '../../core/BaseGenerator';
import { connector } from '../../core/connector';
import { ConnectorFrame } from '../../core/ConnectorFrame';
import type { GeneratedModel, ParamSpec } from '../../core/contracts';
import { createMeshModel } from '../../core/MeshModel';
import { MaterialGroupMerger } from '../../geometry/MaterialGroupMerger';
import { sleeves } from '../../geometry/SleeveGeometryBuilder';
import { threadedSize } from '../ThreadedParts';

/** VALTEC VTr.656 «Контргайка по ГОСТ» (каталог 2017, с. 81): толщина A и размер под ключ S, мм. */
export const LOCKNUTS = {
  '1/2': { a: 6.5, s: 32 }, '3/4': { a: 6.8, s: 36 }, '1': { a: 7, s: 46 },
  '1 1/4': { a: 7, s: 55 }, '1 1/2': { a: 7, s: 60 }, '2': { a: 8, s: 75 },
} as const;
export type LocknutNominal = keyof typeof LOCKNUTS;

export interface SteelLocknutParams { nominal: LocknutNominal }

/** Толщина контргайки, м; undefined — номинала нет в таблице VTr.656. */
export const locknutThickness = (nominal: string): number | undefined =>
  nominal in LOCKNUTS ? LOCKNUTS[nominal as LocknutNominal].a / 1000 : undefined;

/** Шестигранник: размер под ключ s, мм → описанный диаметр, м. */
export const hexDiameter = (s: number) => s / 1000 / Math.cos(Math.PI / 6);

/**
 * Контргайка (позиция 13) по VTr.656: шестигранник с внутренней резьбой на всю толщину.
 * Порт thread — торец x = 0, смотрит −X; гайка лежит в x ∈ [0, A]. На сгоне её ставят
 * на разъём locknut у начала длинной резьбы.
 */
export class SteelLocknutGenerator extends BaseGenerator<SteelLocknutParams> {
  readonly id = 'steel.locknut';
  readonly version = 1;
  readonly title = 'Контргайка';
  readonly defaults: SteelLocknutParams = { nominal: '1/2' };
  readonly paramSpecs: readonly ParamSpec[] = [{ kind: 'choice', key: 'nominal', label: 'Резьба', options: Object.keys(LOCKNUTS) }];

  protected create(p: SteelLocknutParams): GeneratedModel {
    const { a, s } = LOCKNUTS[p.nominal];
    const thread = threadedSize(p.nominal, 'internal');
    const length = a / 1000;
    const merger = new MaterialGroupMerger();
    merger.add(...sleeves.build({ material: 'metal', length, outerDiameter: hexDiameter(s), innerDiameter: thread.n, outerSegments: 6,
      center: { x: length / 2, y: 0, z: 0 }, materials: { outer: 'metalFlat', inner: 'thread' } }));
    return createMeshModel({
      title: `Контргайка ${p.nominal}`,
      ...merger.merge(),
      connectors: [connector('thread', ConnectorFrame.left, { x: 0, y: 0, z: 0 }, { nominal: p.nominal, joint: 'thread', gender: 'internal', depth: length })],
    });
  }
}
