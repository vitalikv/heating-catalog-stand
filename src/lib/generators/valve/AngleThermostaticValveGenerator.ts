import { BaseGenerator } from '../../core/BaseGenerator';
import type { ParamSpec } from '../../core/contracts';
import { specs } from '../../params/specs';
import { createRadiatorValve, radiatorValveErrors, radiatorValveLayout } from './RadiatorValveParts';
import type { RadiatorValveDimensions, RadiatorValveLayout } from './RadiatorValveParts';

export interface AngleThermostaticValveParams extends RadiatorValveDimensions { head: 'cap' | 'thermostatic' }

export class AngleThermostaticValveGenerator extends BaseGenerator<AngleThermostaticValveParams, RadiatorValveLayout> {
  readonly id = 'valve.thermostatic-angle';
  readonly version = 1;
  readonly title = 'Термоклапан радиаторный угловой';
  readonly defaults: AngleThermostaticValveParams = { nominal: '1/2', armLength: 0.04, head: 'thermostatic' };
  readonly paramSpecs: readonly ParamSpec[] = [specs.threadNominal('nominal', 'Резьба'), specs.length('armLength', 'Плечо'),
    { kind: 'choice', key: 'head', label: 'Головка', options: ['cap', 'thermostatic'], optionLabels: { cap: 'колпачок', thermostatic: 'термоголовка' } }];
  protected override layout(p: AngleThermostaticValveParams) { return radiatorValveLayout(p); }
  protected override relations(p: AngleThermostaticValveParams, d: RadiatorValveLayout) { return radiatorValveErrors(p, d); }
  protected create(p: AngleThermostaticValveParams, d: RadiatorValveLayout) {
    return createRadiatorValve(p, d, true, p.head === 'thermostatic', `Термоклапан угловой (${p.head === 'thermostatic' ? 'термоголовка' : 'колпачок'})`);
  }
}
