import { BaseGenerator } from '../../core/BaseGenerator';
import { connector } from '../../core/connector';
import { ConnectorFrame } from '../../core/ConnectorFrame';
import type { GeneratedModel, ParamSpec, ValidationError } from '../../core/contracts';
import { createMeshModel } from '../../core/MeshModel';
import { MaterialGroupMerger } from '../../geometry/MaterialGroupMerger';
import { spheres } from '../../geometry/SphereGeometryBuilder';
import { ParamSchema } from '../../params/ParamSchema';
import { armBodyDiameter, orientParts, threadedArm, threadedSize } from '../ThreadedParts';
import type { ThreadedSize } from '../ThreadedParts';

export interface SteelYTeeParams {
  /** Внутренняя резьба прохода: VTr.136 — 1/2, 3/4, 1. */
  nominal: string;
  /** Внутренняя резьба косого отвода под гильзу; у VTr.136 всегда 1/2. */
  branchNominal: string;
  /** Длина прохода между торцами, м. */
  length: number;
  /** От оси прохода до торца отвода по его оси, м. */
  branchLength: number;
}
type Layout = { run: ThreadedSize; branch: ThreadedSize };

/** Отвод под 45° к проходу, назад по ходу −X: гильза смотрит навстречу потоку слева направо. */
const BRANCH = ConnectorFrame.leftTurned(-Math.PI / 4);

/**
 * Тройник косой для гильзы погружного датчика (позиция 89) по образцу VALTEC VTr.136 (фото-каталог, с. 67, 234:
 * 1/2 × 1/2 × 1/2, 3/4 × 1/2 × 3/4, 1 × 1/2 × 1; чертежа нет — размеры условные). Все концы — внутренняя резьба;
 * отвод 1/2 под 45° вверх-назад, чтобы гильза (позиция 90) доходила до оси трубы. Никелированная латунь.
 */
export class SteelYTeeGenerator extends BaseGenerator<SteelYTeeParams, Layout> {
  readonly id = 'steel.y-tee';
  readonly version = 1;
  readonly title = 'Тройник косой под гильзу';
  readonly paramSpecs: readonly ParamSpec[] = [
    { kind: 'choice', key: 'nominal', label: 'Проход (в)', options: ['1/2', '3/4', '1'] },
    { kind: 'choice', key: 'branchNominal', label: 'Отвод (в)', options: ['1/2'] },
    { kind: 'length', key: 'length', label: 'Длина прохода', min: 0.03, max: 0.12, step: 0.001 },
    { kind: 'length', key: 'branchLength', label: 'Отвод от оси', min: 0.02, max: 0.08, step: 0.001 },
  ];
  readonly defaults: SteelYTeeParams = { nominal: '1/2', branchNominal: '1/2', length: 0.06, branchLength: 0.045 };

  protected override layout(p: SteelYTeeParams): Layout {
    return { run: threadedSize(p.nominal, 'internal'), branch: threadedSize(p.branchNominal, 'internal') };
  }

  /**
   * Резьба прохода не заходит под отвод: проекция корпуса отвода на ось ≈ его радиус / sin 45°.
   * Резьба отвода начинается за корпусом прохода.
   */
  protected override relations(p: SteelYTeeParams, d: Layout): ValidationError[] {
    const errors: ValidationError[] = [];
    const runMinimum = 2 * (d.run.depth + armBodyDiameter(d.branch, 'internal') / 2 / Math.SQRT1_2);
    if (p.length <= runMinimum) errors.push(ParamSchema.tooShort('length', runMinimum));
    const branchMinimum = d.branch.depth + armBodyDiameter(d.run, 'internal') / 2 / Math.SQRT1_2;
    if (p.branchLength <= branchMinimum) errors.push(ParamSchema.tooShort('branchLength', branchMinimum));
    return errors;
  }

  protected create(p: SteelYTeeParams, d: Layout): GeneratedModel {
    const half = p.length / 2;
    const merger = new MaterialGroupMerger();
    merger.add(
      ...orientParts(threadedArm(d.run, 'internal', half), ConnectorFrame.left.direction),
      ...orientParts(threadedArm(d.run, 'internal', half), ConnectorFrame.right.direction),
      ...orientParts(threadedArm(d.branch, 'internal', p.branchLength), BRANCH.direction),
      spheres.build({ material: 'metal', radius: armBodyDiameter(d.run, 'internal') / 2 }),
    );
    const run = { nominal: p.nominal, joint: 'thread', gender: 'internal', depth: d.run.depth } as const;
    return createMeshModel({
      title: `Тройник косой ${p.nominal} × ${p.branchNominal} × ${p.nominal} (в)`,
      ...merger.merge(),
      connectors: [
        connector('left', ConnectorFrame.left, half, run),
        connector('right', ConnectorFrame.right, half, run),
        connector('branch', BRANCH, p.branchLength, { nominal: p.branchNominal, joint: 'thread', gender: 'internal', depth: d.branch.depth }),
      ],
    });
  }
}
