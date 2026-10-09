import { Group } from 'three';
import { createModelObject } from '../lib/index';
import type { Assembly, MaterialLibrary } from '../lib/index';
import type { SceneModel } from './ModelInspector';

/** Сборка в сцене: объект каждой детали стоит по её матрице из Assembly. */
export class AssemblyView {
  readonly root = new Group();
  /** По порядку assembly.parts. */
  readonly parts: (SceneModel & { name: string })[];

  constructor(
    readonly assembly: Assembly,
    library: MaterialLibrary,
  ) {
    this.root.name = assembly.label;
    this.parts = assembly.parts.map(({ name, model }) => ({ name, model, root: createModelObject(model, library) }));
    for (const { root } of this.parts) this.root.add(root);
    this.sync();
  }

  /** Переносит матрицы деталей в объекты сцены (после Assembly.setAngle). */
  sync(): void {
    this.assembly.parts.forEach(({ matrix }, index) => {
      const { root } = this.parts[index];
      matrix.decompose(root.position, root.quaternion, root.scale);
    });
    this.root.updateMatrixWorld(true);
  }

  dispose(): void {
    this.root.removeFromParent();
    this.assembly.dispose();
  }
}
