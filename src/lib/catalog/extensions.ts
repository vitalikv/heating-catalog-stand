import { entry } from './entry';
import type { CatalogEntry } from './entry';

/** Обобщённые модели вне gl2. Размеры — стартовые параметры для стенда, не паспортные изделия. */
export const EXTENSION_CATALOG: CatalogEntry[] = [
  entry('valve.check', ['1/2', '3/4', '1'].flatMap((nominal, i) =>
    (['left-to-right', 'right-to-left'] as const).map((flow) => ({
      label: `${nominal}, ${flow === 'left-to-right' ? '→' : '←'}`, params: { nominal, length: 0.055 + i * 0.01, flow },
    })))),
  entry('valve.thermostatic-angle', ['1/2', '3/4'].flatMap((nominal, i) =>
    (['cap', 'thermostatic'] as const).map((head) => ({
      label: `${nominal}, ${head === 'cap' ? 'колпачок' : 'термоголовка'}`, params: { nominal, armLength: 0.04 + i * 0.005, head },
    })))),
  entry('valve.lockshield', ['1/2', '3/4'].flatMap((nominal, i) =>
    (['straight', 'angle'] as const).map((configuration) => ({
      label: `${nominal}, ${configuration === 'straight' ? 'прямой' : 'угловой'}`, params: { nominal, armLength: 0.035 + i * 0.005, configuration },
    })))),
  entry('valve.radiator-h-block', (['straight', 'angle'] as const).map((configuration) => ({
    label: `3/4, 50 мм, ${configuration === 'straight' ? 'прямой' : 'угловой'}`,
    params: { radiatorNominal: '3/4', pipeNominal: '3/4', spacing: 0.05, height: 0.06, configuration },
  }))),
  entry('steel.union', ['1/2', '3/4', '1'].flatMap((nominal, i) =>
    (['straight', 'angle'] as const).map((configuration) => ({
      label: `${nominal}, ${configuration === 'straight' ? 'прямая' : 'угловая'}`, params: { nominal, armLength: 0.035 + i * 0.01, configuration },
    })))),
  entry('steel.bushing', [['3/4', '1/2'], ['1', '1/2'], ['1', '3/4']].map(([outerNominal, innerNominal]) => ({
    label: `${outerNominal}(н) × ${innerNominal}(в)`, params: { outerNominal, innerNominal, length: 0.025 },
  }))),
  entry('steel.cap', ['1/2', '3/4', '1'].map((nominal, i) => ({ label: `${nominal}(в)`, params: { nominal, length: 0.022 + i * 0.005 } }))),
  entry('valve.drain', ['13', '16', '20'].map((hoseNominal) => ({
    label: `1/2 × шланг ${hoseNominal} мм`, params: { nominal: '1/2', hoseNominal, length: 0.06 },
  }))),
];
