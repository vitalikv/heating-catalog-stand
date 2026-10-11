import { BaseGenerator } from '../../core/BaseGenerator';
import type { ParamSpec } from '../../core/contracts';
import { specs } from '../../params/specs';
import { createRadiatorValve, pipeEndSpec, radiatorValveErrors, radiatorValveLayout } from './RadiatorValveParts';
import type { RadiatorPipeEnd, RadiatorValveDimensions, RadiatorValveLayout } from './RadiatorValveParts';

export interface LockshieldValveParams extends RadiatorValveDimensions { configuration: 'straight' | 'angle'; pipeEnd?: RadiatorPipeEnd }

/** Версия 2: pipeEnd — евроконус 3/4 со стороны трубы (VALTEC VT.019.NER / VT.020.NER, позиция 131). */
export class LockshieldValveGenerator extends BaseGenerator<LockshieldValveParams, RadiatorValveLayout> {
  readonly id = 'valve.lockshield';
  readonly version = 2;
  readonly title = 'Клапан радиаторный обратки';
  readonly defaults: LockshieldValveParams = { nominal: '1/2', armLength: 0.035, configuration: 'angle', pipeEnd: 'internal' };
  readonly paramSpecs: readonly ParamSpec[] = [specs.threadNominal('nominal', 'Резьба'), specs.length('armLength', 'Плечо'),
    { kind: 'choice', key: 'configuration', label: 'Исполнение', options: ['straight', 'angle'], optionLabels: { straight: 'прямой', angle: 'угловой' } },
    pipeEndSpec(2)];
  protected override layout(p: LockshieldValveParams) { return radiatorValveLayout(p); }
  protected override relations(p: LockshieldValveParams, d: RadiatorValveLayout) {
    return radiatorValveErrors({ ...p, inletLength: p.armLength, radiatorLength: p.armLength }, d, { inlet: 'armLength', radiator: 'armLength' });
  }
  protected create(p: LockshieldValveParams, d: RadiatorValveLayout) {
    return createRadiatorValve({ ...p, inletLength: p.armLength, radiatorLength: p.armLength }, d, p.configuration, 'cap',
      `Клапан обратки ${p.configuration === 'angle' ? 'угловой' : 'прямой'}`);
  }
}
