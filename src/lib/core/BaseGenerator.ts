import { ParamSchema } from '../params/ParamSchema';
import type { GeneratedModel, ModelGenerator, ParamSpec, ValidationError } from './contracts';
import { GeneratorParamsError } from './GeneratorParamsError';

/**
 * Каркас генератора: схема параметров → размеры (layout) → связи параметров → построение.
 * L — размеры, которые нужны и проверке связей, и построению; таблицы размеров читаются в layout().
 */
export abstract class BaseGenerator<P, L = void> implements ModelGenerator<P> {
  abstract readonly id: string;
  abstract readonly title: string;
  abstract readonly paramSpecs: readonly ParamSpec[];

  /**
   * Размеры по параметрам — единственное место, где читаются таблицы размеров, если размеры
   * нужны и связям, и построению. Вызывается только для параметров, прошедших схему.
   */
  protected layout(_params: P): L {
    return undefined as L;
  }

  /** Связи параметров (длина больше суммы участков и т. п.). */
  protected relations(_params: P, _layout: L): ValidationError[] {
    return [];
  }

  protected abstract create(params: P, layout: L): GeneratedModel;

  validate(params: P): ValidationError[] {
    const errors = ParamSchema.validate(this.paramSpecs, params);
    return errors.length > 0 ? errors : this.relations(params, this.layout(params));
  }

  build(params: P): GeneratedModel {
    const errors = this.validate(params);
    if (errors.length > 0) throw new GeneratorParamsError(this.id, errors);
    return this.create(params, this.layout(params));
  }
}
