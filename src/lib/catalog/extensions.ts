import { entry } from './entry';
import type { CatalogEntry } from './entry';
import { FILTER_CATALOG } from './filters';
import { INSTRUMENT_CATALOG } from './instruments';
import { MANIFOLD_CATALOG } from './manifold';

/** Обобщённые модели вне gl2. Размеры — стартовые параметры для стенда, не паспортные изделия. */
export const EXTENSION_CATALOG: CatalogEntry[] = [
  // Обратный клапан VALTEC VT.161, В–В (технический каталог 2017, с. 360): длина B, мм.
  // Наружной резьбы у обратных клапанов VALTEC нет (VT.161, 151, 171, 202 — все ВР-ВР).
  entry('valve.check', ([['1/2', 46], ['3/4', 54], ['1', 58], ['1 1/4', 67], ['1 1/2', 75.5], ['2', 80.5]] as const).flatMap(([nominal, b]) =>
    (['left-to-right', 'right-to-left'] as const).map((flow) => ({
      label: `${nominal} (VT.161), ${flow === 'left-to-right' ? '→' : '←'}`, params: { nominal, length: b / 1000, flow },
    })))),
  entry('valve.thermostatic-angle', [
    ...['1/2', '3/4'].flatMap((nominal, i) => (['cap', 'thermostatic'] as const).map((head) => ({
      label: `${nominal}, ${head === 'cap' ? 'колпачок' : 'термоголовка'}`, params: { nominal, armLength: 0.04 + i * 0.005, head },
    }))),
    // Версия 2: под отдельную термоголовку 97 или привод 69; евроконус (131) — как VT.031.NER 1/2 × 3/4 ЕК.
    ...['1/2', '3/4'].map((nominal, i) => ({
      label: `${nominal}, под термоголовку M30×1,5`, params: { nominal, armLength: 0.04 + i * 0.005, head: 'none' as const },
    })),
    { label: '1/2 × 3/4 ЕК, под термоголовку (как VT.031.NER)', params: { nominal: '1/2', armLength: 0.04, head: 'none', pipeEnd: 'eurocone' } },
  ]),
  entry('valve.lockshield', [
    ...['1/2', '3/4'].flatMap((nominal, i) => (['straight', 'angle'] as const).map((configuration) => ({
      label: `${nominal}, ${configuration === 'straight' ? 'прямой' : 'угловой'}`, params: { nominal, armLength: 0.035 + i * 0.005, configuration },
    }))),
    // Версия 2, позиция 131: VALTEC VT.020.NER (прямой) и VT.019.NER (угловой), 1/2 × 3/4 ЕК.
    ...(['straight', 'angle'] as const).map((configuration) => ({
      label: `1/2 × 3/4 ЕК, ${configuration === 'straight' ? 'прямой (как VT.020.NER)' : 'угловой (как VT.019.NER)'}`,
      params: { nominal: '1/2', armLength: 0.035, configuration, pipeEnd: 'eurocone' as const },
    })),
  ]),
  // Прямой термоклапан (позиция 45) — VALTEC VT.032, каталог 2017, с. 532: A, B, мм; плечо к трубе A − B.
  // VT.032.NER (1/2 × 3/4 ЕК) чертежа нет — плечи как у VT.032 1/2, условно.
  entry('valve.thermostatic-straight', [
    ...([['1/2', 82, 55], ['3/4', 97.5, 65.5]] as const).flatMap(([nominal, a, b]) => (['cap', 'none'] as const).map((head) => ({
      label: `${nominal} (VT.032), ${head === 'cap' ? 'колпачок' : 'под термоголовку'}`,
      params: { nominal, inletLength: (a - b) / 1000, radiatorLength: b / 1000, head, pipeEnd: 'internal' as const },
    }))),
    { label: '1/2 × 3/4 ЕК (VT.032.NER), под термоголовку', params: { nominal: '1/2', inletLength: 0.027, radiatorLength: 0.055, head: 'none', pipeEnd: 'eurocone' } },
  ]),
  // Осевой термоклапан (позиция 98) — VALTEC VT.179 1/2, каталог 2017, с. 546.
  entry('valve.thermostatic-axial', (['cap', 'none'] as const).map((head) => ({
    label: `1/2 (VT.179), ${head === 'cap' ? 'колпачок' : 'под термоголовку'}`,
    params: { nominal: '1/2', inletLength: 0.026, radiatorLength: 0.0535, head },
  }))),
  // Термоголовка (позиция 97) — VALTEC VT.5000, каталог 2017, с. 576.
  entry('valve.thermostatic-head', (['*', '3', '5'] as const).map((setting) => ({
    label: `M30×1,5 (VT.5000), шкала ${setting}`, params: { setting },
  }))),
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
  // Обжимные фитинги МП (часть 22) по таблицам VALTEC VTm.300, Технический каталог 2017, с. 31–37.
  // Длины A, B — габариты корпуса между торцами штуцеров (резьбы), мм → м.
  entry('mp.compression-coupling', (
    [['16', '16', 45], ['20', '20', 50], ['26', '26', 65], ['32', '32', 65],
      ['20', '16', 48], ['26', '16', 54], ['26', '20', 55], ['32', '16', 57], ['32', '20', 60], ['32', '26', 63]] as const
  ).map(([nominalLeft, nominalRight, a]) => ({
    label: `${nominalLeft === nominalRight ? nominalLeft : `${nominalLeft} × ${nominalRight}`} (VTm.303)`,
    params: { nominalLeft, nominalRight, length: a / 1000 },
  }))),
  entry('mp.compression-elbow', [
    ...([['16', 36], ['20', 38.5], ['26', 44], ['32', 53]] as const).map(([nominal, a]) => ({
      label: `${nominal} (VTm.351)`, params: { nominal, armLength: a / 1000 },
    })),
    // «Обжим × резьба» (позиция 126): A — резьбовое плечо, B — обжимное.
    ...(['internal', 'external'] as const).flatMap((threadGender) => (
      [['16', '1/2', 27, 32], ['16', '3/4', 32, 35], ['20', '1/2', 39, 29], ['20', '3/4', 39, 32],
        ['26', '3/4', 46, 35], ['26', '1', 44, 39], ['32', '1', 54, 43], ['32', '1 1/4', 59, 52]] as const
    ).map(([nominal, threadNominal, a, b]) => ({
      label: `${nominal} × ${threadNominal}${threadGender === 'internal' ? '(в) (VTm.352)' : '(н) (VTm.353)'}`,
      params: { nominal, armLength: b / 1000, topEnd: 'thread', threadGender, threadNominal, threadArmLength: a / 1000 },
    }))),
  ]),
  entry('mp.compression-tee', [
    ...([['16', '16', 65, 32], ['20', '20', 77, 38.5], ['26', '26', 88, 44], ['32', '32', 105, 52.5],
      ['16', '20', 65, 38.5], ['20', '16', 77, 35.5], ['20', '26', 81, 45], ['26', '16', 88, 41], ['26', '20', 88.5, 41.5],
      ['26', '32', 99, 52.5], ['32', '16', 105, 42], ['32', '20', 105, 52.5], ['32', '26', 105, 49.5]] as const
    ).map(([nominal, nominalBranch, a, b]) => ({
      label: `${nominal === nominalBranch ? nominal : `${nominal} × ${nominalBranch} × ${nominal}`} (VTm.331)`,
      params: { nominal, nominalBranch, length: a / 1000, branchLength: b / 1000 },
    })),
    // Резьба на отводе (позиция 127).
    ...(['internal', 'external'] as const).flatMap((threadGender) => (
      [['16', '1/2', 65, 27.5], ['20', '1/2', 77, 27.5], ['20', '3/4', 77, 31.5], ['26', '3/4', 88, 35],
        ['26', '1', 88, 39], ['32', '1', 105, 42], ['32', '1 1/4', 105, 50]] as const
    ).map(([nominal, threadNominal, a, b]) => ({
      label: `${nominal} × ${threadNominal}${threadGender === 'internal' ? '(в)' : '(н)'} × ${nominal} (VTm.${threadGender === 'internal' ? '332' : '333'})`,
      params: { nominal, nominalBranch: nominal, length: a / 1000, branchLength: b / 1000, branchEnd: 'thread', threadGender, threadNominal },
    }))),
  ]),
  entry('mp.compression-thread-adapter', ([
    ['external', [['16', '1/2', 38], ['16', '3/4', 39], ['20', '1/2', 40], ['20', '3/4', 42], ['26', '3/4', 48], ['26', '1', 51],
      ['32', '3/4', 55], ['32', '1', 55], ['32', '1 1/4', 57]]],
    ['internal', [['16', '1/2', 35], ['16', '3/4', 39], ['20', '1/2', 40], ['20', '3/4', 42], ['26', '3/4', 45], ['26', '1', 49],
      ['32', '3/4', 50], ['32', '1', 52], ['32', '1 1/4', 57]]],
  ] as const).flatMap(([threadGender, rows]) => rows.map(([pipeNominal, threadNominal, a]) => ({
    label: `${pipeNominal} × ${threadNominal}${threadGender === 'internal' ? '(в) (VTm.302)' : '(н) (VTm.301)'}`,
    params: { threadGender, pipeNominal, threadNominal, length: a / 1000 },
  })))),
  // VALTEC VT.4420 NE: 16(2,0) и 20(2,0) × 3/4ЕК, L = 26 мм (технический каталог 2017, с. 206).
  entry('mp.eurocone-adapter', ['16', '20'].map((pipeNominal) => ({
    label: `3/4 × МП ${pipeNominal} (VT.4420)`, params: { pipeNominal, euroconeNominal: '3/4', length: 0.026 },
  }))),
  ...MANIFOLD_CATALOG,
  ...FILTER_CATALOG,
  ...INSTRUMENT_CATALOG,
  // Автоматический воздухоотводчик VALTEC VT.502 (NH, NV, NA) и отсекающий клапан VT.539 — части 26.
  entry('equipment.air-vent', (['NH', 'NV', 'NA'] as const).map((execution) => ({
    label: `1/2 (VT.502.${execution}), ${{ NH: 'выпуск сбоку', NV: 'выпуск сверху', NA: 'угловой' }[execution]}`, params: { execution },
  }))),
  entry('valve.vent-shutoff', [{ label: '1/2(н) × 1/2(в) (VT.539)', params: {} }]),
  // Клапан подпиточный VALTEC VT.515 (позиция 113, каталог 2017, с. 412–413): размеры A, B, C, D — в генераторе.
  entry('valve.make-up', ['1/2', '3/4'].map((nominal) => ({ label: `${nominal} (VT.515)`, params: { nominal } }))),
  // Труба МП по траектории (часть 07): радиус — ручной гиб VALTEC (с. 29) для 16 и 20.
  entry('mp.pipe-path', [
    { label: '16: пространственный угол, R80', params: { nominal: '16', bendRadius: 0.08,
      path: [{ x: 0, y: 0, z: 0 }, { x: 0.3, y: 0, z: 0 }, { x: 0.3, y: 0.3, z: 0 }, { x: 0.3, y: 0.3, z: 0.3 }] } },
    { label: '16: петля 0,6 × 0,4 м, R80', params: { nominal: '16', bendRadius: 0.08,
      path: [{ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0.4 }, { x: 0.6, y: 0, z: 0.4 }, { x: 0.6, y: 0, z: 0.05 }, { x: 0.05, y: 0, z: 0.05 }] } },
    { label: '20: обвод, R100', params: { nominal: '20', bendRadius: 0.1,
      path: [{ x: 0, y: 0, z: 0 }, { x: 0.25, y: 0, z: 0 }, { x: 0.25, y: 0.2, z: 0 }, { x: 0.55, y: 0.2, z: 0 }, { x: 0.55, y: 0, z: 0 }, { x: 0.8, y: 0, z: 0 }] } },
  ]),
  // Смесительные клапаны VALTEC VT.MIX03/04 (каталог 2017, с. 371, 375): размеры A, D, E — в генераторе по номиналу.
  entry('valve.mixing', ([3, 4] as const).flatMap((ways) => ['3/4', '1', '1 1/4'].map((nominal) => ({
    label: `${ways}-ходовой ${nominal} (VT.MIX0${ways})`, params: { ways, nominal, control: 'handle' as const },
  })))),
];
