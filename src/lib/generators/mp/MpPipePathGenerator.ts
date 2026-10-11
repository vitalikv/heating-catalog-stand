import { BaseGenerator } from '../../core/BaseGenerator';
import type { Connector, GeneratedModel, ParamSpec, ValidationError, Vector3Data } from '../../core/contracts';
import { createMeshModel } from '../../core/MeshModel';
import { MaterialGroupMerger } from '../../geometry/MaterialGroupMerger';
import { PipePathBuilder } from '../../geometry/PipePathBuilder';
import type { PipePathEnd } from '../../geometry/PipePathBuilder';
import { specs } from '../../params/specs';

export interface MpPipePathParams {
  /** Наружный диаметр трубы, мм, строкой. */
  nominal: string;
  /** Осевая линия — ломаная, м, в координатах модели; изгибы скругляются радиусом bendRadius. */
  path: Vector3Data[];
  /** Радиус изгиба по оси трубы, м. */
  bendRadius: number;
}

/**
 * Минимальный радиус изгиба металлополимерной трубы VALTEC, м (технический каталог 2017, с. 29):
 * hand — вручную, tool — с кондуктором или трубогибом.
 */
const BEND: Readonly<Record<string, { hand: number; tool: number }>> = {
  '16': { hand: 0.08, tool: 0.045 },
  '20': { hand: 0.1, tool: 0.06 },
  '26': { hand: 0.13, tool: 0.095 },
  '32': { hand: 0.16, tool: 0.125 },
  '40': { hand: 0.55, tool: 0.18 },
};

/**
 * Труба МП по пространственной траектории (позиция 8): PipePathBuilder по наружному диаметру,
 * концы — как у прямой трубы mp.pipe (наружный 'mp-press': пресс- и обжимные фитинги).
 * Глубина конца — прямой участок у торца: фитинг не садится на изгиб.
 * Радиус меньше гиба трубогибом отклоняется; меньше ручного — предупреждение.
 */
export class MpPipePathGenerator extends BaseGenerator<MpPipePathParams> {
  readonly id = 'mp.pipe-path';
  readonly version = 1;
  readonly title = 'Труба МП по траектории';
  readonly paramSpecs: readonly ParamSpec[] = [
    specs.mpNominal('nominal'),
    { kind: 'path', key: 'path', label: 'Траектория', minPoints: 2, maxPoints: 16, extent: 10 },
    specs.length('bendRadius', 'Радиус изгиба', { min: 0.04, max: 1, step: 0.005 }),
  ];
  readonly defaults: MpPipePathParams = {
    nominal: '16', bendRadius: 0.08,
    path: [{ x: 0, y: 0, z: 0 }, { x: 0.3, y: 0, z: 0 }, { x: 0.3, y: 0.3, z: 0 }, { x: 0.3, y: 0.3, z: 0.3 }],
  };

  protected override relations(p: MpPipePathParams): ValidationError[] {
    const minimum = BEND[p.nominal].tool;
    if (p.bendRadius < minimum - 1e-9) {
      return [{ code: 'too_small', param: 'bendRadius', message: `Радиус изгиба: меньше ${minimum * 1000} мм (трубогиб VALTEC для ${p.nominal})` }];
    }
    return PipePathBuilder.analyze(p.path, p.bendRadius, Number(p.nominal) / 1000).map((issue) => ({ code: issue.code, param: 'path', message: issue.message }));
  }

  protected create(p: MpPipePathParams): GeneratedModel {
    const pipe = PipePathBuilder.build(p.path, p.bendRadius, Number(p.nominal) / 1000);
    const merger = new MaterialGroupMerger();
    merger.add({ geometry: pipe.geometry, material: 'pipe' });
    const end = (id: string, side: PipePathEnd): Connector => ({
      id, position: side.position, direction: side.direction, up: side.up, depth: side.straight, nominal: p.nominal, joint: 'mp-press', gender: 'external',
    });
    const model = createMeshModel({
      title: `Труба МП ${p.nominal} по траектории (${Math.round(pipe.length * 100) / 100}м, R${Math.round(p.bendRadius * 1000)})`,
      ...merger.merge(),
      connectors: [end('start', pipe.start), end('end', pipe.end)],
    });
    if (p.bendRadius < BEND[p.nominal].hand - 1e-9) {
      model.warnings.push(`Радиус ${Math.round(p.bendRadius * 1000)} мм меньше ручного гиба VALTEC (${BEND[p.nominal].hand * 1000} мм) — нужен кондуктор или трубогиб`);
    }
    return model;
  }
}
