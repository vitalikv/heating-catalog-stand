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
  entry('valve.radiator-h-block', [
    ...(['straight', 'angle'] as const).map((configuration) => ({
      label: `3/4, 50 мм, ${configuration === 'straight' ? 'прямой' : 'угловой'}`,
      params: { radiatorNominal: '3/4', pipeNominal: '3/4', spacing: 0.05, height: 0.06, configuration },
    })),
    // Версия 3, позиция 100: VALTEC VT.345K (каталог 2017, с. 520) — A = 49, B = 50 мм, шаровые краны.
    { label: '3/4, 50 мм, прямой с кранами (VT.345K)',
      params: { radiatorNominal: '3/4', pipeNominal: '3/4', spacing: 0.05, height: 0.049, configuration: 'straight', shutoff: 'ball' } },
  ]),
  // Кран двойной регулировки (позиция 99) — VALTEC VT.004, каталог 2017, с. 524: A, H, мм.
  entry('valve.double-regulation', ([['1/2', 52, 82], ['3/4', 62, 88]] as const).map(([nominal, a, h]) => ({
    label: `${nominal} (VT.004)`, params: { nominal, length: a / 1000, height: h / 1000 },
  }))),
  // Инжекторный узел (позиция 101) — VALTEC VT.022 (ручка сверху) и VT.025 (по оси), каталог 2017, с. 566, 569.
  entry('valve.injector', (['top', 'axial'] as const).map((handle) => ({
    label: `1/2 × 3/4 ЕК (${handle === 'top' ? 'VT.022' : 'VT.025'}), зонд 200 мм`, params: { handle, probeLength: 0.2 },
  }))),
  entry('steel.union', [
    ...['1/2', '3/4', '1'].flatMap((nominal, i) => (['straight', 'angle'] as const).map((configuration) => ({
      label: `${nominal}, ${configuration === 'straight' ? 'прямая' : 'угловая'}`, params: { nominal, armLength: 0.035 + i * 0.01, configuration },
    }))),
    // Версия 2, позиция 132: VALTEC VTr.340 (В–В) и VTr.728 (Н–Н), каталог 2017, с. 71 и 83; armLength = A / 2.
    ...([['internal', 'В–В', 'VTr.340', [['1/2', 34], ['3/4', 40], ['1', 47], ['1 1/4', 53]]],
      ['external', 'Н–Н', 'VTr.728', [['1/2', 48], ['3/4', 57], ['1', 69]]]] as const).flatMap(([ends, title, code, sizes]) =>
      sizes.map(([nominal, a]) => ({
        label: `${nominal}, ${title} (${code})`, params: { nominal, armLength: a / 2000, configuration: 'straight' as const, ends },
      }))),
  ]),
  // Удлинитель В–Н (позиция 11) — VALTEC VTr.197 / VTr.198.C, каталог 2017, с. 69: длина A, мм.
  entry('steel.extension', ([['1/2', [20, 25, 30, 35, 40, 50, 60]], ['3/4', [26, 31, 36, 41, 51]], ['1', [27, 32, 37, 42, 52]]] as const)
    .flatMap(([nominal, lengths]) => lengths.map((a) => ({ label: `${nominal}, A = ${a} мм (VTr.197)`, params: { nominal, length: a / 1000 } })))),
  // Сгон Н–Н (позиция 12) — VALTEC VTr.653, каталог 2017, с. 79: L1 = 40, L2 = 10 мм.
  entry('steel.running-nipple', [80, 100, 150, 200, 250].map((a) => ({
    label: `1/2 × ${a} (VTr.653)`, params: { nominal: '1/2', length: a / 1000, longThread: 0.04, shortThread: 0.01 },
  }))),
  // Контргайка (позиция 13) — VALTEC VTr.656, каталог 2017, с. 81.
  entry('steel.locknut', (['1/2', '3/4', '1', '1 1/4', '1 1/2', '2'] as const).map((nominal) => ({
    label: `${nominal} (VTr.656)`, params: { nominal },
  }))),
  // Штуцер под шланг (позиция 17) — VALTEC VTr.654, каталог 2017, с. 80: A = 44 мм.
  entry('steel.hose-adapter', [
    ...['10', '12', '14', '16', '18', '20'].map((hoseNominal) => ({ label: `1/2(в) × ${hoseNominal} (VTr.654)`, params: { nominal: '1/2', hoseNominal, length: 0.044 } })),
    { label: '3/4(в) × 20 (VTr.654)', params: { nominal: '3/4', hoseNominal: '20', length: 0.044 } },
  ]),
  // ПП-заглушка (позиция 29) — VALTEC VTp.790, каталог 2017, с. 134: A, мм.
  entry('pp.cap', ([['20', 21.5], ['25', 24], ['32', 27.5], ['40', 33], ['50', 39], ['63', 44], ['75', 58]] as const).map(([nominal, a]) => ({
    label: `${nominal} (VTp.790)`, params: { nominal, length: a / 1000 },
  }))),
  // ПП-разъёмное соединение (позиция 30) — VALTEC VTp.763, 761, 762 (с. 132) и VTp.708 (с. 124): A, мм.
  entry('pp.union', [
    ...([['20', 42], ['25', 45], ['32', 53], ['40', 62], ['50', 70], ['63', 83]] as const).map(([pipeNominal, a]) => ({
      label: `${pipeNominal} × ${pipeNominal} (VTp.763)`, params: { pipeNominal, end: 'socket' as const, threadNominal: '1/2', length: a / 1000 },
    })),
    ...([['20', '1/2', 45], ['25', '3/4', 49], ['32', '1', 53], ['20', '1', 48], ['25', '1', 50], ['40', '1 1/4', 60.5], ['50', '1 1/2', 73], ['63', '2', 85]] as const)
      .map(([pipeNominal, threadNominal, a]) => ({
        label: `${pipeNominal} × ${threadNominal}(н) (VTp.761)`, params: { pipeNominal, end: 'external' as const, threadNominal, length: a / 1000 },
      })),
    ...([['20', '1/2', 35], ['25', '3/4', 40], ['32', '1', 43.5], ['20', '1', 38.5], ['25', '1', 40.5], ['40', '1 1/4', 51], ['50', '1 1/2', 63]] as const)
      .map(([pipeNominal, threadNominal, a]) => ({
        label: `${pipeNominal} × ${threadNominal}(в) (VTp.762)`, params: { pipeNominal, end: 'internal' as const, threadNominal, length: a / 1000 },
      })),
    ...([['20', '1/2', 57], ['20', '3/4', 59], ['25', '3/4', 61.5]] as const).map(([pipeNominal, threadNominal, a]) => ({
      label: `${pipeNominal} × гайка ${threadNominal} (VTp.708)`, params: { pipeNominal, end: 'nut' as const, threadNominal, length: a / 1000 },
    })),
  ]),
  // ПП-угольник с накидной гайкой (позиция 81) — VALTEC VTp.758, каталог 2017, с. 131: A, C, мм.
  entry('pp.nut-elbow', ([['20', '1/2', 26.5, 48], ['20', '3/4', 28, 48], ['25', '3/4', 31, 49.5]] as const).map(([pipeNominal, threadNominal, a, c]) => ({
    label: `${pipeNominal} × гайка ${threadNominal} (VTp.758)`, params: { pipeNominal, threadNominal, socketArm: a / 1000, nutArm: c / 1000 },
  }))),
  // ПП-шаровой кран (позиция 32) — VALTEC VTp.743 (с. 139), VTp.742 (с. 143), VTp.745 (с. 145): A, высота, ручка, мм.
  entry('pp.ball-valve', [
    ...([['20', 70, 34, 56], ['25', 80, 54, 56], ['32', 88, 63, 65], ['40', 100, 78, 65], ['50', 112, 97, 74], ['63', 128, 116, 80]] as const)
      .map(([pipeNominal, a, h, b]) => ({
        label: `${pipeNominal} (VTp.743)`, params: { pipeNominal, ends: 'socket' as const, threadNominal: '1/2', length: a / 1000, height: h / 1000, handleLength: b / 1000 },
      })),
    ...([['20', '1/2', 65, 36, 91], ['25', '3/4', 73, 42, 91], ['32', '1', 89, 50, 116]] as const).map(([pipeNominal, threadNominal, a, b, c]) => ({
      label: `${pipeNominal} × ${threadNominal}(в) (VTp.742)`,
      params: { pipeNominal, ends: 'union-internal' as const, threadNominal, length: a / 1000, height: b / 1000, handleLength: c / 1000 },
    })),
    ...([['20', 65, 36, 91], ['25', 85, 42, 91], ['32', 95, 50, 116], ['40', 110, 60, 116]] as const).map(([pipeNominal, a, b, c]) => ({
      label: `${pipeNominal} × ${pipeNominal} (VTp.745)`,
      params: { pipeNominal, ends: 'union' as const, threadNominal: '1/2', length: a / 1000, height: b / 1000, handleLength: c / 1000 },
    })),
  ]),
  // МП-водорозетка (позиция 35) — VALTEC VTm.254 / 255 (пресс, с. 49), VTm.254.H (с. 51), VTm.354 / 355 (обжим, с. 39): A, B, мм.
  entry('mp.wall-outlet', ([
    ['VTm.254', 'press', 'internal', '16', '1/2', 47, 40], ['VTm.254', 'press', 'internal', '20', '1/2', 51, 44],
    ['VTm.254', 'press', 'internal', '20', '3/4', 56, 47], ['VTm.254', 'press', 'internal', '26', '3/4', 58, 47],
    ['VTm.254.H', 'press', 'internal', '16', '1/2', 44, 46.5], ['VTm.255', 'press', 'external', '16', '1/2', 47, 40],
    ['VTm.354', 'compression', 'internal', '16', '1/2', 35, 40], ['VTm.354', 'compression', 'internal', '20', '1/2', 41, 44],
    ['VTm.354', 'compression', 'internal', '20', '3/4', 45, 47], ['VTm.355', 'compression', 'external', '16', '1/2', 35, 40],
  ] as const).map(([code, pipeEnd, threadGender, pipeNominal, threadNominal, a, b]) => ({
    label: `${pipeNominal} × ${threadNominal}${threadGender === 'internal' ? '(в)' : '(н)'} (${code})`,
    params: { pipeNominal, pipeEnd, threadNominal, threadGender, pipeArm: a / 1000, height: b / 1000 },
  }))),
  // Монтажная пластина водорозеток (позиция 117) — VALTEC VTm.224, каталог 2017, с. 52.
  entry('mp.outlet-plate', (['150', '112.5', '75'] as const).map((spacing) => ({
    label: `186 × 35, межцентровое ${spacing.replace('.', ',')} мм (VTm.224)`, params: { spacing },
  }))),
  // МП с накидной гайкой (позиция 82) — VALTEC VTm.222, каталог 2017, с. 50: A, мм.
  entry('mp.nut-adapter', ([['16', '1/2', 45], ['20', '3/4', 52], ['32', '1 1/4', 57]] as const).map(([pipeNominal, threadNominal, a]) => ({
    label: `${pipeNominal} × гайка ${threadNominal} (VTm.222)`, params: { pipeNominal, threadNominal, length: a / 1000 },
  }))),
  // Угольник под евроконус (позиция 87) — VALTEC VTr.092.NE 3/4 × 3/4, фото-каталог, с. 65; размеры условные.
  entry('steel.eurocone-elbow', [{ label: '3/4(г) × 3/4 ЕК (VTr.092.NE)', params: { nominal: '3/4', armLength: 0.028 } }]),
  // Тройник косой под гильзу (позиция 89) — VALTEC VTr.136, фото-каталог, с. 67: ряд размеров; длины условные.
  entry('steel.y-tee', ([['1/2', 0.06], ['3/4', 0.066], ['1', 0.072]] as const).map(([nominal, length]) => ({
    label: `${nominal} × 1/2 × ${nominal} (VTr.136)`, params: { nominal, branchNominal: '1/2', length, branchLength: 0.045 },
  }))),
  // Эксцентрик (позиция 15) — VALTEC VTr.670, каталог 2017, с. 82.
  entry('steel.eccentric', (['cup', 'none'] as const).map((cup) => ({
    label: `1/2 × 3/4, 9 мм (VTr.670)${cup === 'cup' ? ', с чашкой' : ', без чашки'}`,
    params: { nominalLeft: '1/2', nominalRight: '3/4', offset: 0.009, length: 0.043, cup },
  }))),
  entry('steel.bushing', [
    ...[['3/4', '1/2'], ['1', '1/2'], ['1', '3/4']].map(([outerNominal, innerNominal]) => ({
      label: `${outerNominal}(н) × ${innerNominal}(в)`, params: { outerNominal, innerNominal, length: 0.025 },
    })),
    // Переход под манометр (позиция 16) — футорка VALTEC VTr.581 1/2 × 1/4, каталог 2017, с. 74: A = 14 мм.
    { label: '1/2(н) × 1/4(в), под манометр (VTr.581)', params: { outerNominal: '1/2', innerNominal: '1/4', length: 0.014 } },
  ]),
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
  // Гасители гидроударов VALTEC VT.CAR19 / VT.CAR20 (позиция 111, каталог 2017, с. 434–435).
  entry('equipment.water-hammer-arrester', (['CAR19', 'CAR20'] as const).map((model) => ({
    label: `G1/2 (VT.${model})${model === 'CAR20' ? ', с манометром' : ''}`, params: { model },
  }))),
  // Группа безопасности бойлера VALTEC VT.461 (позиция 112, каталог 2017, с. 440–441).
  entry('equipment.boiler-safety-group', [{ label: '3/4 × 3/4, слив 1 1/4, 7 бар (VT.461)', params: { setting: 7 } }]),
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
