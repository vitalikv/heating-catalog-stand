import { BaseGenerator } from '../../core/BaseGenerator';
import type { ParamSpec } from '../../core/contracts';
import { specs } from '../../params/specs';
import { createRadiatorValve, HEAD_SPEC, pipeEndSpec, radiatorValveErrors, radiatorValveLayout } from './RadiatorValveParts';
import type { RadiatorPipeEnd, RadiatorValveHead, RadiatorValveLayout, RadiatorValveShape } from './RadiatorValveParts';

export interface StraightThermostaticValveParams extends RadiatorValveShape { head: RadiatorValveHead; pipeEnd: RadiatorPipeEnd }

/**
 * Прямой (проходной) термостатический клапан, позиция 45, по VALTEC VT.032 (технический каталог 2017,
 * с. 532): A — между торцами, B — от оси штока до торца к радиатору; inletLength = A − B.
 * Плечи разные, поэтому вместо armLength углового — две длины. Евроконус — VT.032.NER.
 */
export class StraightThermostaticValveGenerator extends BaseGenerator<StraightThermostaticValveParams, RadiatorValveLayout> {
  readonly id = 'valve.thermostatic-straight';
  readonly version = 1;
  readonly title = 'Термоклапан радиаторный прямой';
  readonly defaults: StraightThermostaticValveParams = { nominal: '1/2', inletLength: 0.027, radiatorLength: 0.055, head: 'cap', pipeEnd: 'internal' };
  readonly paramSpecs: readonly ParamSpec[] = [specs.threadNominal('nominal', 'Резьба'),
    specs.length('inletLength', 'Плечо к трубе'), specs.length('radiatorLength', 'Плечо к радиатору'), HEAD_SPEC, pipeEndSpec()];
  protected override layout(p: StraightThermostaticValveParams) { return radiatorValveLayout(p); }
  protected override relations(p: StraightThermostaticValveParams, d: RadiatorValveLayout) { return radiatorValveErrors(p, d); }
  protected create(p: StraightThermostaticValveParams, d: RadiatorValveLayout) {
    return createRadiatorValve(p, d, 'straight', p.head, 'Термоклапан прямой');
  }
}
