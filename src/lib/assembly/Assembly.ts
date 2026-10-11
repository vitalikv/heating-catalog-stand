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

/**
 * Замыкание вне дерева attach: разъём connector детали part соединён с разъёмом toConnector
 * детали to, но обе детали уже поставлены другими стыками (вторая труба контура, второй порт
 * H-блока). Деталь не переставляется — проверяются совместимость и совпадение положения.
 */
export interface AssemblyClosureDefinition {
  part: string;
  connector: string;
  to: string;
  toConnector: string;
}

export interface AssemblyDefinition {
  label: string;
  parts: AssemblyPart[];
  closures?: AssemblyClosureDefinition[];
}

/** Допуски замыкания: зазор между торцом и местом посадки, м, и перекос осей, рад. */
export const CLOSURE_TOLERANCE = { gap: 1e-4, angle: MathUtils.degToRad(0.1) };

export interface AssemblyClosure {
  /** 'труба обратки.end → адаптер.pipe' */
  label: string;
  check: MatingCheck;
  /** Расстояние от торца разъёма part до места посадки на разъёме to, м. */
  gap: number;
  /** Угол между осями разъёмов и встречным направлением, рад. */
  misalignment: number;
  /** Совместимы и сходятся в пределах CLOSURE_TOLERANCE. */
  closed: boolean;
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

interface ClosureEnds {
  moving: AssemblyPartModel;
  fixed: AssemblyPartModel;
  movingConnector: Connector;
  fixedConnector: Connector;
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
  /** Замыкания из описания; пересчитываются при setAngle. */
  readonly closures: AssemblyClosure[] = [];
  /** Ошибки описания: неизвестный генератор, неверные параметры, нет разъёма. */
  readonly errors: string[] = [];
  /** По порядку описания: детали ставятся после тех, к кому присоединены или относительно кого стоят. */
  private readonly placements: Placement[] = [];
  /** Разъёмы замыканий, по порядку closures: по ним замыкания пересчитываются после перестановки. */
  private readonly closureEnds: ClosureEnds[] = [];

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

    for (const closure of definition.closures ?? []) this.addClosure(closure);
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
    this.closureEnds.forEach((ends, i) => Object.assign(this.closures[i], Assembly.measureClosure(ends)));
  }

  private addClosure({ part, connector, to, toConnector }: AssemblyClosureDefinition): void {
    const label = `${part}.${connector} → ${to}.${toConnector}`;
    const moving = this.parts.find((placed) => placed.name === part);
    const fixed = this.parts.find((placed) => placed.name === to);
    const movingConnector = moving?.model.connectors.find((c) => c.id === connector);
    const fixedConnector = fixed?.model.connectors.find((c) => c.id === toConnector);
    if (!moving || !fixed || !movingConnector || !fixedConnector) {
      this.errors.push(`замыкание ${label}: нет детали или разъёма`);
      return;
    }
    const ends = { moving, fixed, movingConnector, fixedConnector };
    this.closureEnds.push(ends);
    this.closures.push({ label, check: ConnectorMating.check(fixedConnector, movingConnector), ...Assembly.measureClosure(ends) });
  }

  /** Зазор и перекос по текущим матрицам: торец moving должен стоять на месте посадки, как его поставил бы place. */
  private static measureClosure({ moving, fixed, movingConnector, fixedConnector }: ClosureEnds): Pick<AssemblyClosure, 'gap' | 'misalignment' | 'closed'> {
    const fixedDirection = new Vector3().copy(fixedConnector.direction).transformDirection(fixed.matrix);
    const movingDirection = new Vector3().copy(movingConnector.direction).transformDirection(moving.matrix);
    const seat = new Vector3().copy(fixedConnector.position).applyMatrix4(fixed.matrix)
      .addScaledVector(fixedDirection, -ConnectorMating.engagement(fixedConnector, movingConnector));
    const gap = new Vector3().copy(movingConnector.position).applyMatrix4(moving.matrix).distanceTo(seat);
    const misalignment = movingDirection.angleTo(fixedDirection.negate());
    const compatible = ConnectorMating.check(fixedConnector, movingConnector).compatible;
    return { gap, misalignment, closed: compatible && gap <= CLOSURE_TOLERANCE.gap && misalignment <= CLOSURE_TOLERANCE.angle };
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
