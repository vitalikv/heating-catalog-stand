import { Box3, Group } from 'three';
import { ConnectorMating } from '../lib/index';
import type { GeneratedModel, GeneratorRegistry, MatingCheck } from '../lib/index';
import type { AssemblyDefinition } from './assemblies';

export interface AssemblyJoint {
  /** 'ниппель.left → переходник.outlet' */
  label: string;
  check: MatingCheck;
}

export interface AssemblyPartModel {
  name: string;
  model: GeneratedModel;
}

/**
 * Сборка из нескольких моделей: каждая деталь ставится по ConnectorMating
 * к разъёму уже поставленной. Несовместимые детали тоже ставятся — чтобы
 * их было видно, — а стык помечается причиной.
 */
export class Assembly {
  readonly root = new Group();
  readonly parts: AssemblyPartModel[] = [];
  readonly joints: AssemblyJoint[] = [];
  /** Ошибки описания: неизвестный генератор, неверные параметры, нет разъёма. */
  readonly errors: string[] = [];

  constructor(registry: GeneratorRegistry, definition: AssemblyDefinition) {
    this.root.name = definition.label;

    for (const part of definition.parts) {
      const generator = registry.get(part.generatorId);
      if (!generator) {
        this.errors.push(`${part.name}: генератор не найден: ${part.generatorId}`);
        continue;
      }
      const errors = generator.validate(part.params);
      if (errors.length > 0) {
        this.errors.push(...errors.map((error) => `${part.name}: ${error.message}`));
        continue;
      }

      const model = generator.build(part.params);
      this.root.add(model.root);
      this.parts.push({ name: part.name, model });

      if (!part.attach) continue;
      const { connector, to, toConnector } = part.attach;
      const target = this.parts.find((placed) => placed.name === to);
      const fixed = target?.model.connectors.find((c) => c.id === toConnector);
      const moving = model.connectors.find((c) => c.id === connector);
      if (!target || !fixed || !moving) {
        this.errors.push(`${part.name}: нет разъёма ${connector} или ${to}.${toConnector}`);
        continue;
      }

      target.model.root.updateMatrixWorld(true);
      const matrix = ConnectorMating.place(fixed, target.model.root.matrixWorld, moving);
      matrix.decompose(model.root.position, model.root.quaternion, model.root.scale);
      model.root.updateMatrixWorld(true);

      this.joints.push({ label: `${part.name}.${connector} → ${to}.${toConnector}`, check: ConnectorMating.check(fixed, moving) });
    }
  }

  /** Габарит всей сборки в координатах сцены. */
  bounds(): Box3 {
    this.root.updateMatrixWorld(true);
    return new Box3().setFromObject(this.root);
  }

  dispose(): void {
    this.root.removeFromParent();
    for (const { model } of this.parts) model.dispose();
    this.parts.length = 0;
  }
}
