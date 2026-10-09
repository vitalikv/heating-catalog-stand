import {
  ArrowHelper,
  Box3,
  Box3Helper,
  BufferGeometry,
  Color,
  DoubleSide,
  Group,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshStandardMaterial,
  Vector3,
  WireframeGeometry,
} from 'three';
import type { Material, Object3D } from 'three';
import { CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import { VertexNormalsHelper } from 'three/examples/jsm/helpers/VertexNormalsHelper.js';
import type { BoundsData, GeneratedModel } from '../lib/index';

/** Модель в сцене: данные генератора и её объект (createModelObject). */
export interface SceneModel {
  model: GeneratedModel;
  root: Object3D;
}

/** Габарит модели как Box3. */
export function boundsBox(bounds: BoundsData): Box3 {
  return new Box3(new Vector3().copy(bounds.min), new Vector3().copy(bounds.max));
}

/** Переключатели диагностики. */
export interface InspectorOptions {
  wireframe: boolean;
  normals: boolean;
  bounds: boolean;
  neutral: boolean;
  connectors: boolean;
}

/**
 * Диагностические оверлеи поверх модели: каркас, нормали, габарит,
 * нейтральный материал, стрелки разъёмов с подписями, глубиной ввода и up (синий отрезок).
 * Материалы и геометрию модели не меняет — только подменяет материал меша.
 */
export class ModelInspector {
  static defaultOptions(): InspectorOptions {
    return { wireframe: false, normals: false, bounds: false, neutral: false, connectors: true };
  }

  private readonly overlays = new Group();
  private readonly neutralMaterial = new MeshStandardMaterial({ color: 0xb0b0b0, side: DoubleSide });
  private readonly wireMaterial = new LineBasicMaterial({ color: new Color(0x1f5fbf) });
  /** Глубина ввода разъёма: видна сквозь деталь. */
  private readonly depthMaterial = new LineBasicMaterial({ color: new Color(0xe0560b), depthTest: false });
  /** Опорное направление разъёма up: от него считается поворот вокруг оси при стыковке. */
  private readonly upMaterial = new LineBasicMaterial({ color: new Color(0x2050d0), depthTest: false });
  private readonly originalMaterials = new Map<Mesh, Material | Material[]>();
  private part: SceneModel | null = null;
  /** Разъёмы, которые не рисуются: в сборке — уже состыкованные. */
  private hidden: ReadonlySet<string> = new Set();

  /** options можно разделить между несколькими инспекторами (детали сборки). */
  constructor(
    parent: Object3D,
    readonly options: InspectorOptions = ModelInspector.defaultOptions(),
  ) {
    this.overlays.name = 'inspector';
    parent.add(this.overlays);
  }

  /** Показывает оверлеи для модели; null — убирает их. */
  attach(part: SceneModel | null, hiddenConnectors: ReadonlySet<string> = new Set()): void {
    this.hidden = hiddenConnectors;
    this.restoreMaterials();
    this.part = part;
    this.update();
  }

  /** Габарит модели вместе с оверлеями (стрелки разъёмов); подписи учитываются запасом. */
  framingBox(): Box3 {
    const box = this.part ? boundsBox(this.part.model.bounds).applyMatrix4(this.part.root.matrixWorld) : new Box3();
    for (const overlay of this.overlays.children) {
      if (overlay instanceof ArrowHelper) {
        // Остриё стрелки — cone.position.y; подпись стоит выше него на 15 % длины.
        overlay.updateMatrixWorld(true);
        box.expandByPoint(overlay.localToWorld(new Vector3(0, overlay.cone.position.y * 1.3, 0)));
      }
    }
    return box;
  }

  /** Перестраивает оверлеи после изменения options. */
  update(): void {
    this.clearOverlays();
    this.restoreMaterials();
    if (!this.part) return;
    const { model, root } = this.part;

    root.updateMatrixWorld(true);
    const meshes = this.meshesOf(root);
    // bounds и разъёмы модели — в её локальных координатах; деталь сборки может стоять со сдвигом и поворотом.
    const localBounds = boundsBox(model.bounds);
    const worldBounds = localBounds.clone().applyMatrix4(root.matrixWorld);
    const size = localBounds.getSize(new Vector3());
    const scale = Math.max(size.x, size.y, size.z);

    if (this.options.neutral) {
      for (const mesh of meshes) {
        this.originalMaterials.set(mesh, mesh.material);
        mesh.material = Array.isArray(mesh.material) ? mesh.material.map(() => this.neutralMaterial) : this.neutralMaterial;
      }
    }

    if (this.options.wireframe) {
      for (const mesh of meshes) {
        const lines = new LineSegments(new WireframeGeometry(mesh.geometry), this.wireMaterial);
        lines.matrixAutoUpdate = false;
        lines.matrix.copy(mesh.matrixWorld);
        this.overlays.add(lines);
      }
    }

    if (this.options.normals) {
      for (const mesh of meshes) this.overlays.add(new VertexNormalsHelper(mesh, scale * 0.04, 0xd02020));
    }

    if (this.options.bounds) {
      this.overlays.add(new Box3Helper(worldBounds, 0xe08000));
    }

    if (this.options.connectors) {
      for (const connector of model.connectors) {
        if (this.hidden.has(connector.id)) continue;
        const origin = new Vector3().copy(connector.position).applyMatrix4(root.matrixWorld);
        const direction = new Vector3().copy(connector.direction).transformDirection(root.matrixWorld);
        // От габарита, но не длиннее 6 см: у радиатора иначе стрелки на полметра.
        const length = Math.min(scale * 0.6, 0.06);
        const arrow = new ArrowHelper(direction, origin, length, 0x18a058, length * 0.25, length * 0.12);

        const element = document.createElement('div');
        element.className = 'connector-label';
        const gender = connector.gender === 'internal' ? 'в' : 'н';
        const kind = { thread: gender, 'radiator-thread': `рад. ${gender}`, 'pp-socket': 'пайка', 'mp-press': 'пресс', eurocone: 'евроконус', 'hose-barb': 'шланг' }[connector.joint];
        element.textContent = `${connector.id} · ${connector.nominal} (${kind})`;
        const label = new CSS2DObject(element);
        label.position.set(0, length * 1.15, 0);
        arrow.add(label);

        this.overlays.add(arrow);

        // Отрезок от торца внутрь на глубину ввода ответной детали.
        const end = origin.clone().addScaledVector(direction, -connector.depth);
        const depth = new LineSegments(new BufferGeometry().setFromPoints([origin, end]), this.depthMaterial);
        depth.renderOrder = 1;
        this.overlays.add(depth);

        const up = new Vector3().copy(connector.up).transformDirection(root.matrixWorld);
        const upLine = new LineSegments(new BufferGeometry().setFromPoints([origin, origin.clone().addScaledVector(up, length * 0.4)]), this.upMaterial);
        upLine.renderOrder = 1;
        this.overlays.add(upLine);
      }
    }
  }

  dispose(): void {
    this.attach(null);
    this.overlays.removeFromParent();
    this.neutralMaterial.dispose();
    this.wireMaterial.dispose();
    this.depthMaterial.dispose();
    this.upMaterial.dispose();
  }

  private meshesOf(root: Object3D): Mesh[] {
    const meshes: Mesh[] = [];
    root.traverse((object) => {
      if (object instanceof Mesh) meshes.push(object);
    });
    return meshes;
  }

  private restoreMaterials(): void {
    for (const [mesh, material] of this.originalMaterials) mesh.material = material;
    this.originalMaterials.clear();
  }

  private clearOverlays(): void {
    for (const overlay of [...this.overlays.children]) {
      // Подписи — дочерние объекты стрелок: событие removed до них не доходит.
      overlay.traverse((object) => {
        if (object instanceof CSS2DObject) object.element.remove();
      });
      if (overlay instanceof ArrowHelper || overlay instanceof Box3Helper || overlay instanceof VertexNormalsHelper) {
        overlay.dispose();
      } else if (overlay instanceof LineSegments) {
        // Каркас, глубина и up разъёма: своя геометрия, общий материал.
        overlay.geometry.dispose();
      }
      overlay.removeFromParent();
    }
  }
}
