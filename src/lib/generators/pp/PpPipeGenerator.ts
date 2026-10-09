import { BaseGenerator } from '../../core/BaseGenerator';
import type { GeneratedModel, ParamSpec } from '../../core/contracts';
import { specs } from '../../params/specs';
import { createStraightPipe } from '../StraightPipe';

export interface PpPipeParams {
  /** Наружный диаметр трубы, мм, строкой. */
  nominal: string;
  /** Длина, м. */
  length: number;
}

/** Прямая труба ПП (createTubeWF_1 с type 'pp' в gl2). */
export class PpPipeGenerator extends BaseGenerator<PpPipeParams> {
  readonly id = 'pp.pipe';
  readonly version = 1;
  readonly title = 'Труба ПП';
  readonly paramSpecs: readonly ParamSpec[] = [specs.ppNominal('nominal'), specs.length('length', 'Длина', { min: 0.01, max: 10, step: 0.001 })];
  readonly defaults: PpPipeParams = { nominal: '20', length: 1 };

  protected create(params: PpPipeParams): GeneratedModel {
    return createStraightPipe('ПП', 'pp-socket', params.nominal, params.length);
  }
}
