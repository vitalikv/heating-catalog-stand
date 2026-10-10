import { Box3, Euler, MathUtils, Matrix4, Quaternion, Vector3 } from 'three';
import type { BoundsData, Connector, GeneratedModel, Vector3Data } from '../core/contracts';
import type { GeneratorRegistry } from '../generators/GeneratorRegistry';
import { ConnectorMating } from './ConnectorMating';
import type { MatingCheck } from './ConnectorMating';

/**
 * Явное положение независимой детали: сдвиг at, м, и поворот rotation, градусы (оси X, Y, Z
 * по порядку, как Euler 'XYZ'). relativeTo — уже поставленная деталь: положение задано
 * в её координатах и следует за ней, когда её переставляет setAngle.
 */
export interface AssemblyPlacement {
  at: Vector3Data;
  rotation?: Vector3Data;
  relativeTo?: string;
}

/**
 * Деталь сборки ставится одним способом: attach — к какому разъёму уже поставленной детали её
 * присоединить, angle — доворот вокруг оси стыка, градусы (по умолчанию up разъёмов совпадают);
 * placement — явное положение без стыка. Оба сразу — ошибка описания. Без них деталь стоит
 * в начале координат (так ставится первая деталь).
 */
export interface AssemblyPart {
  name: string;
  generatorId: string;
  params: unknown;
  attach?: { connector: string; to: string; toConnector: string; angle?: number };
  placement?: AssemblyPlacement;
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

/** Как поставлена деталь: к какому разъёму какой детали или явным положением. */
type Placement =
  | { kind: 'attach'; part: AssemblyPartModel; target: AssemblyPartModel; fixed: Connector; moving: Connector; joint: AssemblyJoint }
  | { kind: 'explicit'; part: AssemblyPartModel; reference: AssemblyPartModel | null; local: Matrix4 };

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
  /** По порядку описания: детали ставятся после тех, к кому присоединены или относительно кого стоят. */
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

      if (part.attach && part.placement) {
        this.errors.push(`${part.name}: задано и присоединение, и явное положение — нужно одно`);
        continue;
      }
      if (part.placement) {
        this.placeExplicitly(placed, part.placement);
        continue;
      }
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
      const placement = { kind: 'attach' as const, part: placed, target, fixed, moving, joint };
      this.placements.push(placement);
      Assembly.place(placement);
    }
  }

  /**
   * Меняет угол стыка детали и переставляет её и все детали после неё по описанию
   * (среди них — присоединённые к ней дальше по цепочке и поставленные относительно неё).
   * Модели не перестраиваются.
   */
  setAngle(partName: string, degrees: number): void {
    const start = this.placements.findIndex((placement) => placement.kind === 'attach' && placement.joint.part === partName);
    if (start < 0) return;
    const placement = this.placements[start];
    if (placement.kind === 'attach') placement.joint.angle = degrees;
    for (const next of this.placements.slice(start)) Assembly.place(next);
  }

  private placeExplicitly(part: AssemblyPartModel, { at, rotation = { x: 0, y: 0, z: 0 }, relativeTo }: AssemblyPlacement): void {
    const reference = relativeTo === undefined ? null : this.parts.find((placed) => placed.name === relativeTo && placed !== part);
    if (reference === undefined) {
      this.errors.push(`${part.name}: деталь ${relativeTo} для положения не найдена или ещё не поставлена`);
      return;
    }
    const turn = new Quaternion().setFromEuler(new Euler(MathUtils.degToRad(rotation.x), MathUtils.degToRad(rotation.y), MathUtils.degToRad(rotation.z), 'XYZ'));
    const local = new Matrix4().compose(new Vector3(at.x, at.y, at.z), turn, new Vector3(1, 1, 1));
    const placement = { kind: 'explicit' as const, part, reference, local };
    this.placements.push(placement);
    Assembly.place(placement);
  }

  private static place(placement: Placement): void {
    if (placement.kind === 'explicit') {
      const { part, reference, local } = placement;
      part.matrix.copy(reference ? new Matrix4().multiplyMatrices(reference.matrix, local) : local);
      return;
    }
    const { part, target, fixed, moving, joint } = placement;
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
