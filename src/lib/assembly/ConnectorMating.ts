import { Matrix4, Quaternion, Vector3 } from 'three';
import type { Connector } from '../core/contracts';
import { ConnectionRules } from './ConnectionRules';
import type { MatingCheck } from './ConnectionRules';

export type { MatingCheck } from './ConnectionRules';

/**
 * Стыковка разъёмов по данным, без разбора названий.
 * Совместимость и посадку задаёт ConnectionRules: совместимые системы соединения (одна
 * или пара вроде конца трубы МП и обжима), один номинал, внутренний и наружный разъёмы.
 * Положение: направления противоположны, up совпадают (с доворотом на угол стыка),
 * ответная деталь входит внутрь на e = ConnectionRules.engagement — торец подвижной встаёт в P − D × e неподвижной.
 */
export class ConnectorMating {
  static check(a: Connector, b: Connector): MatingCheck {
    return ConnectionRules.check(a, b);
  }

  /** Глубина посадки пары, м — та же, что использует place. */
  static engagement(a: Connector, b: Connector): number {
    return ConnectionRules.engagement(a, b);
  }

  /**
   * Мировая матрица для корня подвижной детали, чтобы её разъём moving
   * состыковался с разъёмом fixed детали, стоящей в fixedMatrix.
   * angle — доворот подвижной детали вокруг direction разъёма fixed, рад
   * (против часовой стрелки, если смотреть навстречу direction); 0 — up совпадают.
   * Совместимость не проверяет — это делает check().
   */
  static place(fixed: Connector, fixedMatrix: Matrix4, moving: Connector, angle = 0): Matrix4 {
    const fixedPosition = new Vector3().copy(fixed.position).applyMatrix4(fixedMatrix);
    const fixedDirection = new Vector3().copy(fixed.direction).transformDirection(fixedMatrix);
    const fixedUp = new Vector3().copy(fixed.up).transformDirection(fixedMatrix);

    // Сначала направления навстречу, потом доворот вокруг оси стыка до совпадения up.
    const axis = fixedDirection.clone().negate();
    const align = new Quaternion().setFromUnitVectors(new Vector3().copy(moving.direction).normalize(), axis);
    const movingUp = new Vector3().copy(moving.up).applyQuaternion(align);
    const twist = Math.atan2(axis.dot(movingUp.clone().cross(fixedUp)), movingUp.dot(fixedUp));
    const rotation = new Quaternion().setFromAxisAngle(fixedDirection, angle - twist).multiply(align);

    const engagement = ConnectionRules.engagement(fixed, moving);
    const target = fixedPosition.addScaledVector(fixedDirection, -engagement);
    const translation = target.sub(new Vector3().copy(moving.position).applyQuaternion(rotation));

    return new Matrix4().compose(translation, rotation, new Vector3(1, 1, 1));
  }
}
