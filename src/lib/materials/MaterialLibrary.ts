import { Color, DoubleSide, MathUtils, MeshPhongMaterial, RepeatWrapping, SRGBColorSpace } from 'three';
import type { Material, Texture } from 'three';
import type { MaterialKey } from '../core/contracts';

export type { MaterialKey };

// Источник: gl2/sceneParams.js. lightMap_1 не переносится.
// metal_1, rezba_1, bronz_1 и rezba_2: блик как у металла.
const METAL_COLOR = 0xc1c6c9;
const BRONZE_COLOR = 0xb87c23;
const METAL_SPECULAR = 0xa3a3a3;
const METAL_SHININESS = 100;
const THREAD_REPEAT_X = 900;
const THREAD_ROTATION_DEG = 2;
// white_1, white_2, red_1, blue_1: shininess и specular — значения Phong по умолчанию.
const PLASTIC_COLOR = 0xf0f0f0;
const PLASTIC_GREY_COLOR = 0xd1d1d1;
const RED_COLOR = 0xbf2502;
const BLUE_COLOR = 0x3e65f0;
// Труба TubeN (crTube.js): MeshStandardMaterial 0x0252f2 — здесь Phong, как остальные.
const PIPE_COLOR = 0x0252f2;
const BLACK_COLOR = 0x222222;
// manometr_1 (gr_bez.js): белый с картой циферблата.
const MANOMETER_COLOR = 0xffffff;
const MANOMETER_REPEAT = 15;
const MANOMETER_ROTATION_DEG = -90;
const MANOMETER_OFFSET = 0.5;
const DEFAULT_SPECULAR = 0x111111;
const DEFAULT_SHININESS = 30;

/** Материалы с текстурой резьбы. */
const THREADED: readonly MaterialKey[] = ['thread', 'bronzeThread'];

/**
 * Общие материалы генераторов. Модели только ссылаются на них, поэтому
 * dispose() модели их не освобождает — это делает владелец библиотеки.
 * Текстура передаётся готовой: загрузка зависит от среды (стенд, воркер).
 * Переданная текстура переходит во владение библиотеки.
 */
export class MaterialLibrary {
  private readonly materials: Record<MaterialKey, MeshPhongMaterial>;
  private threadTexture: Texture | null = null;
  private manometerTexture: Texture | null = null;

  constructor(threadTexture: Texture | null = null) {
    const metal = () => this.create(METAL_COLOR, METAL_SPECULAR, METAL_SHININESS);
    const bronze = () => this.create(BRONZE_COLOR, METAL_SPECULAR, METAL_SHININESS);
    const plastic = () => this.create(PLASTIC_COLOR, DEFAULT_SPECULAR, DEFAULT_SHININESS);
    // *_edge в gl2: тот же материал с плоским затенением — для граней гаек.
    const flat = (material: MeshPhongMaterial) => Object.assign(material, { flatShading: true });

    this.materials = {
      metal: metal(),
      metalFlat: flat(metal()),
      thread: metal(),
      plastic: plastic(),
      plasticFlat: flat(plastic()),
      plasticGrey: this.create(PLASTIC_GREY_COLOR, DEFAULT_SPECULAR, DEFAULT_SHININESS),
      bronze: bronze(),
      bronzeFlat: flat(bronze()),
      bronzeThread: bronze(),
      red: this.create(RED_COLOR, DEFAULT_SPECULAR, DEFAULT_SHININESS),
      blue: this.create(BLUE_COLOR, DEFAULT_SPECULAR, DEFAULT_SHININESS),
      pipe: this.create(PIPE_COLOR, DEFAULT_SPECULAR, DEFAULT_SHININESS),
      redFlat: flat(this.create(RED_COLOR, DEFAULT_SPECULAR, DEFAULT_SHININESS)),
      black: this.create(BLACK_COLOR, DEFAULT_SPECULAR, DEFAULT_SHININESS),
      blackFlat: flat(this.create(BLACK_COLOR, DEFAULT_SPECULAR, DEFAULT_SHININESS)),
      manometer: this.create(MANOMETER_COLOR, DEFAULT_SPECULAR, DEFAULT_SHININESS),
    };
    this.setThreadTexture(threadTexture);
  }

  get(key: MaterialKey): Material {
    return this.materials[key];
  }

  /** Без текстуры материалы резьбы выглядят как metal и bronze, но остаются отдельными. */
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

    for (const key of THREADED) {
      this.materials[key].map = texture;
      this.materials[key].needsUpdate = true;
    }
  }

  /** Циферблат манометра группы безопасности; без текстуры материал просто белый. */
  setManometerTexture(texture: Texture | null): void {
    if (texture === this.manometerTexture) return;
    this.manometerTexture?.dispose();
    this.manometerTexture = texture;

    if (texture) {
      texture.wrapS = RepeatWrapping;
      texture.wrapT = RepeatWrapping;
      texture.repeat.set(MANOMETER_REPEAT, MANOMETER_REPEAT);
      texture.rotation = MathUtils.degToRad(MANOMETER_ROTATION_DEG);
      texture.offset.set(MANOMETER_OFFSET, MANOMETER_OFFSET);
      texture.colorSpace = SRGBColorSpace;
      texture.needsUpdate = true;
    }
    this.materials.manometer.map = texture;
    this.materials.manometer.needsUpdate = true;
  }

  dispose(): void {
    for (const material of Object.values(this.materials)) material.dispose();
    this.threadTexture?.dispose();
    this.threadTexture = null;
    this.manometerTexture?.dispose();
    this.manometerTexture = null;
  }

  private create(color: number, specular: number, shininess: number): MeshPhongMaterial {
    return new MeshPhongMaterial({ color: new Color(color), specular: new Color(specular), shininess, side: DoubleSide });
  }
}
