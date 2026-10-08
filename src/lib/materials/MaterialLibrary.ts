import { Color, DoubleSide, MathUtils, MeshPhongMaterial, RepeatWrapping, SRGBColorSpace } from 'three';
import type { Material, Texture } from 'three';

export type MaterialKey = 'metal' | 'thread';

// Источник: gl2/sceneParams.js, metal_1 и rezba_1. lightMap_1 не переносится.
const METAL_COLOR = 0xc1c6c9;
const METAL_SPECULAR = 0xa3a3a3;
const METAL_SHININESS = 100;
const THREAD_REPEAT_X = 900;
const THREAD_ROTATION_DEG = 2;

/**
 * Общие материалы генераторов. Модели только ссылаются на них, поэтому
 * dispose() модели их не освобождает — это делает владелец библиотеки.
 * Текстура передаётся готовой: загрузка зависит от среды (стенд, воркер).
 * Переданная текстура переходит во владение библиотеки.
 */
export class MaterialLibrary {
  private readonly materials: Record<MaterialKey, MeshPhongMaterial>;
  private threadTexture: Texture | null = null;

  constructor(threadTexture: Texture | null = null) {
    this.materials = { metal: this.createMetal(), thread: this.createMetal() };
    this.setThreadTexture(threadTexture);
  }

  get(key: MaterialKey): Material {
    return this.materials[key];
  }

  /** Без текстуры материал резьбы выглядит как metal, но остаётся отдельным. */
  setThreadTexture(texture: Texture | null): void {
    if (texture === this.threadTexture) return;
    this.threadTexture?.dispose();
    this.threadTexture = texture;

    if (texture) {
      texture.wrapS = RepeatWrapping;
      texture.wrapT = RepeatWrapping;
      texture.repeat.x = THREAD_REPEAT_X;
      texture.rotation = MathUtils.degToRad(THREAD_ROTATION_DEG);
      texture.colorSpace = SRGBColorSpace;
      texture.needsUpdate = true;
    }

    this.materials.thread.map = texture;
    this.materials.thread.needsUpdate = true;
  }

  dispose(): void {
    for (const material of Object.values(this.materials)) material.dispose();
    this.threadTexture?.dispose();
    this.threadTexture = null;
  }

  private createMetal(): MeshPhongMaterial {
    return new MeshPhongMaterial({
      color: new Color(METAL_COLOR),
      specular: new Color(METAL_SPECULAR),
      shininess: METAL_SHININESS,
      side: DoubleSide,
    });
  }
}
