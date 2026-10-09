import type { ParamSpec } from '../core/contracts';
import { MpPipeSizes } from '../sizes/MpPipeSizes';
import { PpPipeSizes } from '../sizes/PpPipeSizes';
import { ThreadSizes } from '../sizes/ThreadSizes';

/** Сторона резьбы в формате gl2: 'v' — внутренняя, 'n' — наружная. */
export type ThreadSideCode = 'v' | 'n';

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

  /** Сторона резьбы в кодах gl2: 'v' — внутренняя, 'n' — наружная. */
  threadSide(key = 'side', label = 'Резьба'): ParamSpec {
    return { kind: 'choice', key, label, options: ['v', 'n'], optionLabels: { v: 'внутренняя', n: 'наружная' } };
  },

  length(key: string, label: string, { min = 0.001, max = 0.2, step = 0.0005 }: LengthRange = {}): ParamSpec {
    return { kind: 'length', key, label, min, max, step };
  },
};
