import {
  ArrowHelper,
  Box3Helper,
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
import type { GeneratedModel } from '../lib/index';

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
 * нейтральный материал и стрелки разъёмов с подписями.
 * Материалы и геометрию модели не меняет — только подменяет материал меша.
 */
export class ModelInspector {
  readonly options: InspectorOptions = {
    wireframe: false,
    normals: false,
    bounds: false,
    neutral: false,
    connectors: true,
  };

  private readonly overlays = new Group();
  private readonly neutralMaterial = new MeshStandardMaterial({ color: 0xb0b0b0, side: DoubleSide });
  private readonly wireMaterial = new LineBasicMaterial({ color: new Color(0x1f5fbf) });
  private readonly originalMaterials = new Map<Mesh, Material | Material[]>();
  private model: GeneratedModel | null = null;

  constructor(parent: Object3D) {
    this.overlays.name = 'inspector';
    parent.add(this.overlays);
  }

  /** Показывает оверлеи для модели; null — убирает их. */
  attach(model: GeneratedModel | null): void {
    this.restoreMaterials();
    this.model = model;
    this.update();
  }

  /** Перестраивает оверлеи после изменения options. */
  update(): void {
    this.clearOverlays();
    this.restoreMaterials();
    const model = this.model;
    if (!model) return;

    model.root.updateMatrixWorld(true);
    const meshes = this.meshesOf(model.root);
    const size = model.bounds.getSize(new Vector3());
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
      this.overlays.add(new Box3Helper(model.bounds.clone(), 0xe08000));
    }

    if (this.options.connectors) {
      for (const connector of model.connectors) {
        const origin = new Vector3().copy(connector.position).applyMatrix4(model.root.matrixWorld);
        const direction = new Vector3().copy(connector.direction).normalize();
        const length = scale * 0.6;
        const arrow = new ArrowHelper(direction, origin, length, 0x18a058, length * 0.25, length * 0.12);

        const element = document.createElement('div');
        element.className = 'connector-label';
        const kind = connector.joint === 'thread' ? (connector.gender === 'internal' ? 'в' : 'н') : 'пайка';
        element.textContent = `${connector.id} · ${connector.nominal} (${kind})`;
        const label = new CSS2DObject(element);
        label.position.set(0, length * 1.15, 0);
        arrow.add(label);

        this.overlays.add(arrow);
      }
    }
  }

  dispose(): void {
    this.attach(null);
    this.overlays.removeFromParent();
    this.neutralMaterial.dispose();
    this.wireMaterial.dispose();
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
        // Каркас: своя геометрия, общий wireMaterial.
        overlay.geometry.dispose();
      }
      overlay.removeFromParent();
    }
  }
}
