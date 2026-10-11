import { BaseGenerator } from '../../core/BaseGenerator';
import type { ParamSpec } from '../../core/contracts';
import { specs } from '../../params/specs';
import { createRadiatorValve, HEAD_SPEC, pipeEndSpec, radiatorValveErrors, radiatorValveLayout } from './RadiatorValveParts';
import type { RadiatorPipeEnd, RadiatorValveDimensions, RadiatorValveHead, RadiatorValveLayout } from './RadiatorValveParts';

export interface AngleThermostaticValveParams extends RadiatorValveDimensions { head: RadiatorValveHead; pipeEnd?: RadiatorPipeEnd }

const HEAD_TITLES: Record<RadiatorValveHead, string> = { cap: 'колпачок', thermostatic: 'термоголовка', none: 'под термоголовку' };

/**
 * Версия 2: pipeEnd — евроконус 3/4 со стороны трубы (VALTEC VT.031.NER, позиция 131);
 * head 'none' — посадочное место M30×1,5 под термоголовку 97 или привод 69. Прежние параметры
 * строят прежнюю модель.
 */
export class AngleThermostaticValveGenerator extends BaseGenerator<AngleThermostaticValveParams, RadiatorValveLayout> {
  readonly id = 'valve.thermostatic-angle';
  readonly version = 2;
  readonly title = 'Термоклапан радиаторный угловой';
  readonly defaults: AngleThermostaticValveParams = { nominal: '1/2', armLength: 0.04, head: 'thermostatic', pipeEnd: 'internal' };
  readonly paramSpecs: readonly ParamSpec[] = [specs.threadNominal('nominal', 'Резьба'), specs.length('armLength', 'Плечо'), HEAD_SPEC, pipeEndSpec(2)];
  protected override layout(p: AngleThermostaticValveParams) { return radiatorValveLayout(p); }
  protected override relations(p: AngleThermostaticValveParams, d: RadiatorValveLayout) {
    return radiatorValveErrors({ ...p, inletLength: p.armLength, radiatorLength: p.armLength }, d, { inlet: 'armLength', radiator: 'armLength' });
  }
  protected create(p: AngleThermostaticValveParams, d: RadiatorValveLayout) {
    return createRadiatorValve({ ...p, inletLength: p.armLength, radiatorLength: p.armLength }, d, 'angle', p.head,
      `Термоклапан угловой (${HEAD_TITLES[p.head]})`);
  }
}
