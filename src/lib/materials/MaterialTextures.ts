import { ImageBitmapLoader, Texture } from 'three';
import type { DialKey, MaterialLibrary } from './MaterialLibrary';

/**
 * Текстуры материалов и их файлы в пакете (`textures/`). Ключ — куда текстура
 * идёт: резьба или циферблат прибора.
 */
export const MATERIAL_TEXTURE_FILES = {
  thread: 'rezba_1.png',
  manometer: 'manometr.png',
  thermometer: 'termometr.png',
  thermomanometer: 'termomanometr.png',
} as const;

export type MaterialTextureKey = keyof typeof MATERIAL_TEXTURE_FILES;

export interface MaterialTexturesResult {
  loaded: MaterialTextureKey[];
  /** Что не загрузилось: материал остаётся без карты — резьба гладкая, циферблат белый. */
  failed: { key: MaterialTextureKey; url: string; message: string }[];
}

/**
 * Загружает текстуры материалов и передаёт их в библиотеку. Работает одинаково
 * в главном потоке и в воркере: через ImageBitmapLoader (fetch и
 * createImageBitmap), без Image и DOM.
 *
 * Ориентация: у ImageBitmap `Texture.flipY` не действует, поэтому картинка
 * переворачивается при декодировании (`imageOrientation: 'flipY'`) — результат
 * тот же, что у TextureLoader с flipY по умолчанию.
 *
 * Текстуры переходят во владение библиотеки вместе с ImageBitmap. Если
 * библиотеку освободили, пока шла загрузка, пришедшая текстура сразу
 * освобождается (MaterialLibrary). Отказ одной текстуры другие не отменяет;
 * промис не отклоняется — список отказов в результате.
 *
 * @param resolveUrl адрес файла: потребитель знает, где лежат файлы пакета
 *   (например, `import url from '<пакет>/textures/rezba_1.png?url'` в Vite).
 */
export async function loadMaterialTextures(
  materials: MaterialLibrary,
  resolveUrl: (file: string, key: MaterialTextureKey) => string,
): Promise<MaterialTexturesResult> {
  const loader = new ImageBitmapLoader();
  loader.setOptions({ imageOrientation: 'flipY', premultiplyAlpha: 'none' });
  const result: MaterialTexturesResult = { loaded: [], failed: [] };
  const keys = Object.keys(MATERIAL_TEXTURE_FILES) as MaterialTextureKey[];
  await Promise.all(keys.map(async (key) => {
    const url = resolveUrl(MATERIAL_TEXTURE_FILES[key], key);
    try {
      const bitmap = await loader.loadAsync(url);
      const texture = new Texture(bitmap);
      texture.flipY = false;
      texture.needsUpdate = true;
      if (key === 'thread') materials.setThreadTexture(texture);
      else materials.setDialTexture(key satisfies DialKey, texture);
      result.loaded.push(key);
    } catch (error) {
      result.failed.push({ key, url, message: error instanceof Error ? error.message : String(error) });
    }
  }));
  return result;
}
