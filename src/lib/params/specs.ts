import type { ParamSpec } from '../core/contracts';
import { MpPipeSizes } from '../sizes/MpPipeSizes';
import { PpPipeSizes } from '../sizes/PpPipeSizes';
import { ThreadSizes } from '../sizes/ThreadSizes';

/** Границы длины, м; по умолчанию 1 мм … 200 мм с шагом 0,5 мм. */
export interface LengthRange {
  min?: number;
  max?: number;
  step?: number;
}

/** Повторяющиеся описания параметров: одинаковые подписи, варианты и границы у всех генераторов. */
export const specs = {
  threadNominal(key: string, label: string): ParamSpec {
    return { kind: 'choice', key, label, options: ThreadSizes.nominals };
  },

  ppNominal(key: string, label = 'Труба, мм'): ParamSpec {
    return { kind: 'choice', key, label, options: PpPipeSizes.nominals };
  },

  mpNominal(key: string, label = 'Труба, мм'): ParamSpec {
    return { kind: 'choice', key, label, options: MpPipeSizes.nominals };
  },

  /** Сторона резьбы детали: внутренняя или наружная. */
  threadGender(key = 'threadGender', label = 'Резьба'): ParamSpec {
    return { kind: 'choice', key, label, options: ['internal', 'external'], optionLabels: { internal: 'внутренняя', external: 'наружная' } };
  },

  length(key: string, label: string, { min = 0.001, max = 0.2, step = 0.0005 }: LengthRange = {}): ParamSpec {
    return { kind: 'length', key, label, min, max, step };
  },
};
