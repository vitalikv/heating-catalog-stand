import { BaseGenerator } from '../../core/BaseGenerator';
import type { ParamSpec } from '../../core/contracts';
import { specs } from '../../params/specs';
import { createRadiatorValve, HEAD_SPEC, radiatorValveErrors, radiatorValveLayout } from './RadiatorValveParts';
import type { RadiatorValveHead, RadiatorValveLayout } from './RadiatorValveParts';

export interface AxialThermostaticValveParams {
  nominal: string;
  inletLength: number;
  radiatorLength: number;
  head: RadiatorValveHead;
}

/**
 * Осевой термостатический клапан, позиция 98, по VALTEC VT.179 (технический каталог 2017, с. 546):
 * вход снизу, головка соосна выходу к радиатору. 53,5 мм — от оси входа до торца к радиатору,
 * 26 мм — от оси выхода до торца входа. Только В–Н: евроконусного исполнения у VALTEC нет.
 */
export class AxialThermostaticValveGenerator extends BaseGenerator<AxialThermostaticValveParams, RadiatorValveLayout> {
  readonly id = 'valve.thermostatic-axial';
  readonly version = 1;
  readonly title = 'Термоклапан радиаторный осевой';
  readonly defaults: AxialThermostaticValveParams = { nominal: '1/2', inletLength: 0.026, radiatorLength: 0.0535, head: 'cap' };
  readonly paramSpecs: readonly ParamSpec[] = [specs.threadNominal('nominal', 'Резьба'),
    specs.length('inletLength', 'Плечо к трубе'), specs.length('radiatorLength', 'Плечо к радиатору'), HEAD_SPEC];
  protected override layout(p: AxialThermostaticValveParams) { return radiatorValveLayout(p); }
  protected override relations(p: AxialThermostaticValveParams, d: RadiatorValveLayout) {
    return radiatorValveErrors({ ...p, pipeEnd: 'internal' }, d);
  }
  protected create(p: AxialThermostaticValveParams, d: RadiatorValveLayout) {
    return createRadiatorValve({ ...p, pipeEnd: 'internal' }, d, 'axial', p.head, 'Термоклапан осевой');
  }
}
