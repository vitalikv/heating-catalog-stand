import { BaseGenerator } from '../../core/BaseGenerator';
import type { GeneratedModel, ParamSpec } from '../../core/contracts';
import { specs } from '../../params/specs';
import { createStraightPipe } from '../StraightPipe';

export interface MpPipeParams {
  /** Наружный диаметр трубы, мм, строкой. */
  nominal: string;
  /** Длина, м. */
  length: number;
}

/** Прямая труба МП (createTubeWF_1 с type 'mp' в gl2). */
export class MpPipeGenerator extends BaseGenerator<MpPipeParams> {
  readonly id = 'mp.pipe';
  readonly version = 1;
  readonly title = 'Труба МП';
  readonly paramSpecs: readonly ParamSpec[] = [specs.mpNominal('nominal'), specs.length('length', 'Длина', { min: 0.01, max: 10, step: 0.001 })];
  readonly defaults: MpPipeParams = { nominal: '16', length: 1 };

  protected create(params: MpPipeParams): GeneratedModel {
    return createStraightPipe('МП', 'mp-press', params.nominal, params.length);
  }
}
