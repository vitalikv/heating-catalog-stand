import { Box3, Group, MathUtils } from 'three';
import { ConnectorMating, createModelObject } from '../lib/index';
import type { Connector, GeneratedModel, GeneratorRegistry, MaterialLibrary, MatingCheck } from '../lib/index';
import type { AssemblyDefinition } from './assemblies';

export interface AssemblyJoint {
  /** Имя присоединяемой детали. */
  part: string;
  /** 'ниппель.left → переходник.outlet' */
  label: string;
  check: MatingCheck;
  /** Угол стыка, градусы. */
  angle: number;
}

/** Как поставлена деталь: к какому разъёму какой детали. */
interface Placement {
  part: AssemblyPartModel;
  target: AssemblyPartModel;
  fixed: Connector;
  moving: Connector;
  joint: AssemblyJoint;
}

export interface AssemblyPartModel {
  name: string;
  model: GeneratedModel;
  /** Объект детали в сцене; его матрица ставит деталь по разъёмам. */
  root: Group;
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
  /** По порядку описания: детали ставятся после тех, к кому присоединены. */
  private readonly placements: Placement[] = [];

  constructor(registry: GeneratorRegistry, library: MaterialLibrary, definition: AssemblyDefinition) {
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
      const placed = { name: part.name, model, root: createModelObject(model, library) };
      this.root.add(placed.root);
      this.parts.push(placed);

      if (!part.attach) continue;
      const { connector, to, toConnector, angle = 0 } = part.attach;
      const target = this.parts.find((placed) => placed.name === to);
      const fixed = target?.model.connectors.find((c) => c.id === toConnector);
      const moving = model.connectors.find((c) => c.id === connector);
      if (!target || !fixed || !moving) {
        this.errors.push(`${part.name}: нет разъёма ${connector} или ${to}.${toConnector}`);
        continue;
      }

      const joint = { part: part.name, label: `${part.name}.${connector} → ${to}.${toConnector}`, check: ConnectorMating.check(fixed, moving), angle };
      this.joints.push(joint);
      const placement = { part: placed, target, fixed, moving, joint };
      this.placements.push(placement);
      Assembly.place(placement);
    }
  }

  /**
   * Меняет угол стыка детали и переставляет её и все детали после неё по описанию
   * (среди них — присоединённые к ней дальше по цепочке). Модели не перестраиваются.
   */
  setAngle(partName: string, degrees: number): void {
    const start = this.placements.findIndex(({ joint }) => joint.part === partName);
    if (start < 0) return;
    this.placements[start].joint.angle = degrees;
    for (const placement of this.placements.slice(start)) Assembly.place(placement);
  }

  private static place({ part, target, fixed, moving, joint }: Placement): void {
    target.root.updateMatrixWorld(true);
    const matrix = ConnectorMating.place(fixed, target.root.matrixWorld, moving, MathUtils.degToRad(joint.angle));
    matrix.decompose(part.root.position, part.root.quaternion, part.root.scale);
    part.root.updateMatrixWorld(true);
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
