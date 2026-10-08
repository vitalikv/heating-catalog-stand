import type { StandParams } from './presets';

/** Деталь сборки; attach — к какому разъёму уже поставленной детали её присоединить. */
export interface AssemblyPart {
  name: string;
  generatorId: string;
  params: StandParams;
  attach?: { connector: string; to: string; toConnector: string };
}

export interface AssemblyDefinition {
  label: string;
  parts: AssemblyPart[];
}

const radiator = (count: number, height: number): StandParams => ({ count, size: { x: 0.08, y: height, z: 0.08 }, r1: '1' });

/**
 * Сборки для проверки стыковки. Первые три — совместимые стыки,
 * остальные — заведомо несовместимые, стенд должен показать причину.
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
