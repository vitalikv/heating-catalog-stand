import { Matrix4, Quaternion, Vector3 } from 'three';
import type { Connector } from '../contracts';

/** Итог проверки пары разъёмов. */
export type MatingCheck =
  | { compatible: true; engagement: number }
  | { compatible: false; reason: 'joint' | 'nominal' | 'gender'; message: string };

/**
 * Стыковка разъёмов по данным, без разбора названий.
 * Совместимы: один способ соединения, один номинал, разные типы (внутренний и наружный).
 * Положение: направления противоположны, ответная деталь входит внутрь
 * на e = min(depth₁, depth₂) — торец подвижной встаёт в P − D × e неподвижной.
 * Поворот вокруг оси разъёма — минимальный; задавать его отдельно — следующий шаг.
 */
export class ConnectorMating {
  static check(a: Connector, b: Connector): MatingCheck {
    if (a.joint !== b.joint) {
      return { compatible: false, reason: 'joint', message: `разные способы соединения: ${a.joint} и ${b.joint}` };
    }
    if (a.nominal !== b.nominal) {
      return { compatible: false, reason: 'nominal', message: `разные номиналы: ${a.nominal} и ${b.nominal}` };
    }
    if (a.gender === b.gender) {
      const kind = a.gender === 'internal' ? 'внутренние' : 'наружные';
      return { compatible: false, reason: 'gender', message: `оба разъёма ${kind}` };
    }
    return { compatible: true, engagement: Math.min(a.depth, b.depth) };
  }

  /**
   * Мировая матрица для корня подвижной детали, чтобы её разъём moving
   * состыковался с разъёмом fixed детали, стоящей в fixedMatrix.
   * Совместимость не проверяет — это делает check().
   */
  static place(fixed: Connector, fixedMatrix: Matrix4, moving: Connector): Matrix4 {
    const fixedPosition = new Vector3().copy(fixed.position).applyMatrix4(fixedMatrix);
    const fixedDirection = new Vector3().copy(fixed.direction).transformDirection(fixedMatrix);

    const rotation = new Quaternion().setFromUnitVectors(
      new Vector3().copy(moving.direction).normalize(),
      fixedDirection.clone().negate(),
    );

    const engagement = Math.min(fixed.depth, moving.depth);
    const target = fixedPosition.addScaledVector(fixedDirection, -engagement);
    const translation = target.sub(new Vector3().copy(moving.position).applyQuaternion(rotation));

    return new Matrix4().compose(translation, rotation, new Vector3(1, 1, 1));
  }
}
