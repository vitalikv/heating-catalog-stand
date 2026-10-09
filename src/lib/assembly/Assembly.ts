import { Box3, MathUtils, Matrix4, Vector3 } from 'three';
import type { BoundsData, Connector, GeneratedModel } from '../core/contracts';
import type { GeneratorRegistry } from '../generators/GeneratorRegistry';
import { ConnectorMating } from './ConnectorMating';
import type { MatingCheck } from './ConnectorMating';

/**
 * Деталь сборки; attach — к какому разъёму уже поставленной детали её присоединить,
 * angle — доворот вокруг оси стыка, градусы (по умолчанию up разъёмов совпадают).
 */
export interface AssemblyPart {
  name: string;
  generatorId: string;
  params: unknown;
  attach?: { connector: string; to: string; toConnector: string; angle?: number };
}

export interface AssemblyDefinition {
  label: string;
  parts: AssemblyPart[];
}

export interface AssemblyJoint {
  /** Имя присоединяемой детали. */
  part: string;
  /** 'ниппель.left → переходник.outlet' */
  label: string;
  check: MatingCheck;
  /** Угол стыка, градусы. */
  angle: number;
}

export interface AssemblyPartModel {
  name: string;
  model: GeneratedModel;
  /** Положение детали в координатах сборки; первая деталь стоит в начале координат. */
  matrix: Matrix4;
}

/** Как поставлена деталь: к какому разъёму какой детали. */
interface Placement {
  part: AssemblyPartModel;
  target: AssemblyPartModel;
  fixed: Connector;
  moving: Connector;
  joint: AssemblyJoint;
}

/**
 * Сборка из нескольких моделей: каждая деталь ставится по ConnectorMating
 * к разъёму уже поставленной. Несовместимые детали тоже ставятся — чтобы
 * их было видно, — а стык помечается причиной. Результат — модели и матрицы деталей;
 * объекты сцены строит потребитель (createModelObject).
 */
export class Assembly {
  readonly label: string;
  readonly parts: AssemblyPartModel[] = [];
  readonly joints: AssemblyJoint[] = [];
  /** Ошибки описания: неизвестный генератор, неверные параметры, нет разъёма. */
  readonly errors: string[] = [];
  /** По порядку описания: детали ставятся после тех, к кому присоединены. */
  private readonly placements: Placement[] = [];

  constructor(registry: GeneratorRegistry, definition: AssemblyDefinition) {
    this.label = definition.label;

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
      const placed = { name: part.name, model, matrix: new Matrix4() };
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
    part.matrix.copy(ConnectorMating.place(fixed, target.matrix, moving, MathUtils.degToRad(joint.angle)));
  }

  /** Габарит всей сборки: габариты деталей, поставленные их матрицами. */
  bounds(): BoundsData {
    const box = new Box3();
    for (const { model, matrix } of this.parts) {
      box.union(new Box3(new Vector3().copy(model.bounds.min), new Vector3().copy(model.bounds.max)).applyMatrix4(matrix));
    }
    return { min: { x: box.min.x, y: box.min.y, z: box.min.z }, max: { x: box.max.x, y: box.max.y, z: box.max.z } };
  }

  dispose(): void {
    for (const { model } of this.parts) model.dispose();
    this.parts.length = 0;
  }
}
