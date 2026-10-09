import type { StandParams } from './presets';

/**
 * Деталь сборки; attach — к какому разъёму уже поставленной детали её присоединить,
 * angle — доворот вокруг оси стыка, градусы (по умолчанию up разъёмов совпадают).
 */
export interface AssemblyPart {
  name: string;
  generatorId: string;
  params: StandParams;
  attach?: { connector: string; to: string; toConnector: string; angle?: number };
}

export interface AssemblyDefinition {
  label: string;
  parts: AssemblyPart[];
}

const radiator = (count: number, height: number): StandParams => ({ count, size: { x: 0.08, y: height, z: 0.08 }, r1: '1' });

/**
 * Сборки для проверки стыковки. Сначала совместимые стыки, потом заведомо
 * несовместимые (название начинается с «Ошибка») — стенд должен показать причину.
 */
export const STAND_ASSEMBLIES: AssemblyDefinition[] = [
  {
    label: 'Радиатор → переходник → ниппель → муфта',
    parts: [
      { name: 'радиатор', generatorId: 'al_radiator_1', params: radiator(3, 0.5) },
      {
        name: 'переходник',
        generatorId: 'al_zagl_radiator_1',
        params: { type: 'prh', r1: '1', r2: '1/2' },
        attach: { connector: 'radiator', to: 'радиатор', toConnector: 'top-right' },
      },
      {
        name: 'ниппель',
        generatorId: 'st_nippel_1',
        params: { r1: '1/2', r2: '1/2', m1: 0.022 },
        attach: { connector: 'left', to: 'переходник', toConnector: 'outlet' },
      },
      {
        name: 'муфта',
        generatorId: 'st_mufta_1',
        params: { r1: '1/2', r2: '1/2', m1: 0.03 },
        attach: { connector: 'left', to: 'ниппель', toConnector: 'right' },
      },
    ],
  },
  {
    label: 'Радиатор: заглушка, воздухоотводчик, переходники',
    parts: [
      { name: 'радиатор', generatorId: 'al_radiator_1', params: radiator(5, 0.35) },
      {
        name: 'воздухоотводчик',
        generatorId: 'al_zagl_radiator_1',
        params: { type: 'vsd', r1: '1', r2: 0 },
        attach: { connector: 'radiator', to: 'радиатор', toConnector: 'top-left' },
      },
      {
        name: 'заглушка',
        generatorId: 'al_zagl_radiator_1',
        params: { type: 'zgl', r1: '1', r2: 0 },
        attach: { connector: 'radiator', to: 'радиатор', toConnector: 'bottom-left' },
      },
      {
        name: 'переходник 3/4',
        generatorId: 'al_zagl_radiator_1',
        params: { type: 'prh', r1: '1', r2: '3/4' },
        attach: { connector: 'radiator', to: 'радиатор', toConnector: 'top-right' },
      },
      {
        name: 'переходник 1/2',
        generatorId: 'al_zagl_radiator_1',
        params: { type: 'prh', r1: '1', r2: '1/2' },
        attach: { connector: 'radiator', to: 'радиатор', toConnector: 'bottom-right' },
      },
    ],
  },
  {
    label: 'Переходная муфта 1×1/2 и ниппели',
    parts: [
      { name: 'муфта', generatorId: 'st_mufta_1', params: { r1: '1', r2: '1/2', m1: 0.034 } },
      {
        name: 'ниппель 1',
        generatorId: 'st_nippel_1',
        params: { r1: '1', r2: '1', m1: 0.034 },
        attach: { connector: 'right', to: 'муфта', toConnector: 'left' },
      },
      {
        name: 'ниппель 1/2',
        generatorId: 'st_nippel_1',
        params: { r1: '1/2', r2: '1/2', m1: 0.022 },
        attach: { connector: 'left', to: 'муфта', toConnector: 'right' },
      },
    ],
  },
  {
    label: 'Тройник: ниппели, угол с доворотом, краны',
    parts: [
      { name: 'тройник', generatorId: 'st_troinik_1', params: { side: 'v', r1: '1/2', r2: '1/2', r3: '1/2', m1: 0.046, m2: 0.023 } },
      {
        name: 'кран н-н',
        generatorId: 'shar_kran_n_1',
        params: { r1: '1/2', m1: 0.063, t1: 0.053 },
        attach: { connector: 'left', to: 'тройник', toConnector: 'top' },
      },
      {
        name: 'ниппель слева',
        generatorId: 'st_nippel_1',
        params: { r1: '1/2', r2: '1/2', m1: 0.022 },
        attach: { connector: 'right', to: 'тройник', toConnector: 'left' },
      },
      {
        // Доворот на 90°: второй выход угла смотрит вдоль Z, а не вверх.
        name: 'угол',
        generatorId: 'st_ugol_90_1',
        params: { side: 'v', r1: '1/2', m1: 0.023 },
        attach: { connector: 'right', to: 'ниппель слева', toConnector: 'left', angle: 90 },
      },
      {
        name: 'ниппель справа',
        generatorId: 'st_nippel_1',
        params: { r1: '1/2', r2: '1/2', m1: 0.022 },
        attach: { connector: 'left', to: 'тройник', toConnector: 'right' },
      },
      {
        name: 'кран в-в',
        generatorId: 'shar_kran_v_1',
        params: { r1: '1/2', m1: 0.0475, t1: 0.053 },
        attach: { connector: 'left', to: 'ниппель справа', toConnector: 'right' },
      },
    ],
  },
  {
    label: 'Коллектор: краны на выходах, ниппель и муфта',
    parts: [
      { name: 'коллектор', generatorId: 'st_collector_1', params: { side: 'n', r1: '1', r2: '1/2', count: 3, m1: 0.132, m2: 0.036 } },
      // Без доворота ручки смотрели бы вдоль трубы (up выхода — +X) и упирались в соседние краны.
      ...[1, 2, 3].map((i) => ({
        name: `кран ${i}`,
        generatorId: 'shar_kran_v_1',
        params: { r1: '1/2', m1: 0.0475, t1: 0.053 },
        attach: { connector: 'left', to: 'коллектор', toConnector: `outlet-${i}`, angle: -90 },
      })),
      {
        name: 'ниппель',
        generatorId: 'st_nippel_1',
        params: { r1: '1', r2: '1', m1: 0.034 },
        attach: { connector: 'right', to: 'коллектор', toConnector: 'left' },
      },
      {
        name: 'муфта',
        generatorId: 'st_mufta_1',
        params: { r1: '1', r2: '1', m1: 0.035 },
        attach: { connector: 'left', to: 'коллектор', toConnector: 'right' },
      },
    ],
  },
  {
    label: 'Стальной радиатор: полусгон, кран, воздухоотводчик, заглушка',
    parts: [
      { name: 'радиатор', generatorId: 'st_radiator_1', params: { size: { x: 0.6, y: 0.5, z: 0.07 }, r1: '1/2' } },
      {
        name: 'воздухоотводчик',
        generatorId: 'rad_vozduhotvod_1',
        params: { r1: '1/2', type: 'vsd' },
        attach: { connector: 'left', to: 'радиатор', toConnector: 'top-left' },
      },
      {
        name: 'полусгон',
        generatorId: 'st_pol_sgon_1',
        params: { r1: '3/4', r2: '1/2', m1: 0.04 },
        attach: { connector: 'pipe', to: 'радиатор', toConnector: 'bottom-left' },
      },
      {
        name: 'заглушка',
        generatorId: 'st_zagl_nr',
        params: { r1: '1/2', m1: 0.022 },
        attach: { connector: 'left', to: 'радиатор', toConnector: 'top-right' },
      },
      {
        name: 'кран с полусгоном',
        generatorId: 'shar_kran_sgon_1',
        params: { r1: '1/2', r2: '3/4', m1: 0.055, m2: 0.026, t1: 0.053 },
        attach: { connector: 'right', to: 'радиатор', toConnector: 'bottom-right' },
      },
    ],
  },
  {
    label: 'ПП и металлопластик на резьбе стальной муфты',
    parts: [
      { name: 'муфта', generatorId: 'st_mufta_1', params: { r1: '1/2', r2: '1/2', m1: 0.03 } },
      {
        name: 'соединитель ПП',
        generatorId: 'pl_perehod_rezba_1',
        params: { side: 'n', r1: '20', r2: '1/2', m1: 0.036 },
        attach: { connector: 'right', to: 'муфта', toConnector: 'left' },
      },
      {
        name: 'соединитель МП',
        generatorId: 'mpl_perehod_rezba_1',
        params: { side: 'n', r1: '16', r2: '1/2', m1: 0.048 },
        attach: { connector: 'right', to: 'муфта', toConnector: 'right' },
      },
    ],
  },
  {
    label: 'Труба ПП: угол, труба, муфта',
    parts: [
      { name: 'угол', generatorId: 'pl_ugol_90_1', params: { r1: '20', m1: 0.026 } },
      {
        name: 'труба',
        generatorId: 'createTubeWF_1',
        params: { type: 'pp', ppSize: '20', length: 0.3 },
        attach: { connector: 'start', to: 'угол', toConnector: 'right' },
      },
      {
        name: 'муфта',
        generatorId: 'pl_mufta_1',
        params: { r1: '20', r2: '20', m1: 0.032 },
        attach: { connector: 'left', to: 'труба', toConnector: 'end' },
      },
    ],
  },
  {
    label: 'Труба МП: угол, труба, соединитель',
    parts: [
      { name: 'угол', generatorId: 'mpl_ugol_1', params: { r1: '16', m1: 0.044 } },
      {
        name: 'труба',
        generatorId: 'createTubeWF_1',
        params: { type: 'mp', mpSize: '16', length: 0.3 },
        attach: { connector: 'start', to: 'угол', toConnector: 'right' },
      },
      {
        name: 'соединитель',
        generatorId: 'mpl_perehod_1',
        params: { r1: '16', r3: '16', m1: 0.06 },
        attach: { connector: 'left', to: 'труба', toConnector: 'end' },
      },
    ],
  },
  {
    // Проверка стыков; перенос crSborka_zr_nasos_1 как сборки — позже (план переноса, п. 6).
    label: 'Насос: гайки, полусгон',
    parts: [
      { name: 'насос', generatorId: 'cr_zr_nasos_1', params: { r1: '1 1/4' } },
      {
        name: 'гайка слева',
        generatorId: 'cr_gaika_nasos_1',
        params: { r1: '1 1/4', r2: '1' },
        attach: { connector: 'pump', to: 'насос', toConnector: 'left' },
      },
      {
        name: 'гайка справа',
        generatorId: 'cr_gaika_nasos_1',
        params: { r1: '1 1/4', r2: '1' },
        attach: { connector: 'pump', to: 'насос', toConnector: 'right' },
      },
      {
        name: 'полусгон',
        generatorId: 'st_pol_sgon_1',
        params: { r1: '1 1/4', r2: '1', m1: 0.052 },
        attach: { connector: 'pipe', to: 'гайка справа', toConnector: 'pipe' },
      },
    ],
  },
  {
    label: 'Котёл: фильтр, муфта, бак',
    parts: [
      { name: 'котёл', generatorId: 'cr_kotel_1', params: { size: { x: 0.4, y: 0.73, z: 0.3 }, r1: '3/4', type: 'bottom' } },
      {
        name: 'фильтр',
        generatorId: 'filtr_kosoy_1',
        params: { r1: '3/4', m1: 0.065 },
        attach: { connector: 'left', to: 'котёл', toConnector: 'bottom-right' },
      },
      {
        name: 'муфта',
        generatorId: 'st_mufta_1',
        params: { r1: '3/4', r2: '3/4', m1: 0.033 },
        attach: { connector: 'left', to: 'котёл', toConnector: 'bottom-left' },
      },
      {
        name: 'бак',
        generatorId: 'cr_rash_bak_1',
        params: { d: 0.245, h1: 0.25, r1: '3/4', name: '6л' },
        attach: { connector: 'bottom', to: 'муфта', toConnector: 'right' },
      },
    ],
  },
  {
    label: 'Группа безопасности на ниппеле',
    parts: [
      { name: 'ниппель', generatorId: 'st_nippel_1', params: { r1: '1', r2: '1', m1: 0.034 } },
      {
        name: 'группа',
        generatorId: 'gr_bez_1',
        params: { size: { x: 0.18, y: 0.05, z: 0.05 }, r1: '1' },
        attach: { connector: 'bottom', to: 'ниппель', toConnector: 'right' },
      },
    ],
  },
  {
    label: 'Ошибка: труба МП 20 в ПП-раструб 20',
    parts: [
      { name: 'муфта ПП', generatorId: 'pl_mufta_1', params: { r1: '20', r2: '20', m1: 0.032 } },
      {
        name: 'труба МП',
        generatorId: 'createTubeWF_1',
        params: { type: 'mp', mpSize: '20', length: 0.3 },
        attach: { connector: 'start', to: 'муфта ПП', toConnector: 'right' },
      },
    ],
  },
  {
    label: 'Ошибка: ниппель 1 прямо в радиатор',
    parts: [
      { name: 'радиатор', generatorId: 'al_radiator_1', params: radiator(1, 0.2) },
      {
        name: 'ниппель',
        generatorId: 'st_nippel_1',
        params: { r1: '1', r2: '1', m1: 0.034 },
        attach: { connector: 'left', to: 'радиатор', toConnector: 'top-right' },
      },
    ],
  },
  {
    label: 'Ошибка: муфта к муфте',
    parts: [
      { name: 'муфта 1', generatorId: 'st_mufta_1', params: { r1: '1/2', r2: '1/2', m1: 0.03 } },
      {
        name: 'муфта 2',
        generatorId: 'st_mufta_1',
        params: { r1: '1/2', r2: '1/2', m1: 0.03 },
        attach: { connector: 'left', to: 'муфта 1', toConnector: 'right' },
      },
    ],
  },
  {
    label: 'Ошибка: ПП-муфта на раструб ПП-угла',
    parts: [
      { name: 'угол', generatorId: 'pl_ugol_90_1', params: { r1: '20', m1: 0.026 } },
      {
        name: 'муфта',
        generatorId: 'pl_mufta_1',
        params: { r1: '20', r2: '20', m1: 0.032 },
        attach: { connector: 'left', to: 'угол', toConnector: 'right' },
      },
    ],
  },
  {
    label: 'Ошибка: металлопластик на ПП-раструб того же диаметра',
    parts: [
      { name: 'угол ПП', generatorId: 'pl_ugol_90_1', params: { r1: '20', m1: 0.026 } },
      {
        name: 'угол МП',
        generatorId: 'mpl_ugol_1',
        params: { r1: '20', m1: 0.044 },
        attach: { connector: 'right', to: 'угол ПП', toConnector: 'top' },
      },
    ],
  },
  {
    label: 'Ошибка: ниппель 3/4 в муфту 1/2',
    parts: [
      { name: 'муфта', generatorId: 'st_mufta_1', params: { r1: '1/2', r2: '1/2', m1: 0.03 } },
      {
        name: 'ниппель',
        generatorId: 'st_nippel_1',
        params: { r1: '3/4', r2: '3/4', m1: 0.022 },
        attach: { connector: 'left', to: 'муфта', toConnector: 'right' },
      },
    ],
  },
];
