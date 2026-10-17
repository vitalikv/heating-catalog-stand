import { afterEach, describe, expect, it, vi } from 'vitest';
import type { MeshPhongMaterial } from 'three';
import { MATERIAL_TEXTURE_FILES, MaterialLibrary, loadMaterialTextures } from '../src/lib/index';

/** ImageBitmap глазами теста: close() отмечается, опции декодирования запоминаются. */
interface FakeBitmap {
  url: string;
  options: Record<string, unknown>;
  closed: boolean;
  close(): void;
}

/**
 * В node нет createImageBitmap, а fetch уходил бы в сеть: оба подменяются.
 * `missing` — адреса, которые не загружаются; `delay` — задержка ответа, мс.
 */
function stubLoading(missing: string[] = [], delay = 0): FakeBitmap[] {
  const bitmaps: FakeBitmap[] = [];
  vi.stubGlobal('fetch', async (url: string) => {
    if (delay) await new Promise((resolve) => setTimeout(resolve, delay));
    if (missing.includes(url)) throw new Error(`404 ${url}`);
    return { blob: async () => ({ url }) };
  });
  vi.stubGlobal('createImageBitmap', async (blob: { url: string }, options: Record<string, unknown>) => {
    const bitmap: FakeBitmap = {
      url: blob.url,
      options: { ...options },
      closed: false,
      close() { this.closed = true; },
    };
    bitmaps.push(bitmap);
    return bitmap;
  });
  return bitmaps;
}

const urlOf = (file: string) => `/pkg/textures/${file}`;
const mapOf = (materials: MaterialLibrary, key: 'thread' | 'manometer' | 'thermometer' | 'thermomanometer') =>
  (materials.get(key) as MeshPhongMaterial).map;

afterEach(() => vi.unstubAllGlobals());

describe('loadMaterialTextures', () => {
  it('грузит все текстуры через ImageBitmap, переворачивая картинку при декодировании', async () => {
    const bitmaps = stubLoading();
    const materials = new MaterialLibrary();
    const result = await loadMaterialTextures(materials, urlOf);

    expect(result.failed).toEqual([]);
    expect([...result.loaded].sort()).toEqual(Object.keys(MATERIAL_TEXTURE_FILES).sort());
    expect(bitmaps.map((bitmap) => bitmap.url).sort())
      .toEqual(Object.values(MATERIAL_TEXTURE_FILES).map(urlOf).sort());
    for (const bitmap of bitmaps) expect(bitmap.options.imageOrientation).toBe('flipY');

    const thread = mapOf(materials, 'thread');
    expect(thread?.image).toBe(bitmaps.find((bitmap) => bitmap.url === urlOf('rezba_1.png')));
    // flipY у ImageBitmap не действует — переворот уже сделан при декодировании.
    expect(thread?.flipY).toBe(false);
    expect((materials.get('bronzeThread') as MeshPhongMaterial).map).toBe(thread);
    expect(mapOf(materials, 'thermometer')?.image).toBe(bitmaps.find((bitmap) => bitmap.url === urlOf('termometr.png')));

    materials.dispose();
    expect(bitmaps.every((bitmap) => bitmap.closed)).toBe(true);
  });

  it('отказ одной текстуры не мешает остальным: материал остаётся без карты', async () => {
    stubLoading([urlOf('manometr.png')]);
    const materials = new MaterialLibrary();
    const result = await loadMaterialTextures(materials, urlOf);

    expect(result.failed.map((item) => [item.key, item.url])).toEqual([['manometer', urlOf('manometr.png')]]);
    expect(result.loaded).toHaveLength(3);
    expect(mapOf(materials, 'manometer')).toBeNull();
    expect(mapOf(materials, 'thread')).not.toBeNull();
    materials.dispose();
  });

  it('текстура, пришедшая после dispose библиотеки, сразу освобождается', async () => {
    const bitmaps = stubLoading([], 20);
    const materials = new MaterialLibrary();
    const loading = loadMaterialTextures(materials, urlOf);
    materials.dispose();
    await loading;

    expect(bitmaps).toHaveLength(4);
    expect(bitmaps.every((bitmap) => bitmap.closed)).toBe(true);
    expect(mapOf(materials, 'thread')).toBeNull();
  });

  it('замена текстуры закрывает ImageBitmap прежней', async () => {
    const bitmaps = stubLoading();
    const materials = new MaterialLibrary();
    await loadMaterialTextures(materials, urlOf);
    const first = bitmaps.find((bitmap) => bitmap.url === urlOf('rezba_1.png'));
    materials.setThreadTexture(null);
    expect(first?.closed).toBe(true);
    materials.dispose();
  });
});
