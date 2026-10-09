import { BaseGenerator } from '../../core/BaseGenerator';
import type { ParamSpec } from '../../core/contracts';
import { specs } from '../../params/specs';
import { createRadiatorValve, radiatorValveErrors, radiatorValveLayout } from './RadiatorValveParts';
import type { RadiatorValveDimensions, RadiatorValveLayout } from './RadiatorValveParts';

export interface LockshieldValveParams extends RadiatorValveDimensions { configuration: 'straight' | 'angle' }

export class LockshieldValveGenerator extends BaseGenerator<LockshieldValveParams, RadiatorValveLayout> {
  readonly id = 'valve.lockshield';
  readonly version = 1;
  readonly title = 'Клапан радиаторный обратки';
  readonly defaults: LockshieldValveParams = { nominal: '1/2', armLength: 0.035, configuration: 'angle' };
  readonly paramSpecs: readonly ParamSpec[] = [specs.threadNominal('nominal', 'Резьба'), specs.length('armLength', 'Плечо'),
    { kind: 'choice', key: 'configuration', label: 'Исполнение', options: ['straight', 'angle'], optionLabels: { straight: 'прямой', angle: 'угловой' } }];
  protected override layout(p: LockshieldValveParams) { return radiatorValveLayout(p); }
  protected override relations(p: LockshieldValveParams, d: RadiatorValveLayout) { return radiatorValveErrors(p, d); }
  protected create(p: LockshieldValveParams, d: RadiatorValveLayout) {
    return createRadiatorValve(p, d, p.configuration === 'angle', false, `Клапан обратки ${p.configuration === 'angle' ? 'угловой' : 'прямой'}`);
  }
}
