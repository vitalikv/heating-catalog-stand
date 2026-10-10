import type { Connector, ConnectorJoint } from '../core/contracts';

/** Итог проверки пары разъёмов. */
export type MatingCheck =
  | { compatible: true; engagement: number }
  | { compatible: false; reason: 'joint' | 'nominal' | 'gender'; message: string };

/**
 * Посадка системы соединения. 'insert' — вставное соединение (резьба, раструб, обжим):
 * ответная деталь входит внутрь на min(depth₁, depth₂), у каждого разъёма depth > 0.
 * Торцевые соединения (стыковая сварка, фланцы) — отдельная посадка, вводится вместе с ними.
 */
export type Seating = 'insert';

interface JointSystem {
  seating: Seating;
}

const SYSTEMS: Readonly<Record<ConnectorJoint, JointSystem>> = {
  thread: { seating: 'insert' },
  'radiator-thread': { seating: 'insert' },
  'pp-socket': { seating: 'insert' },
  'mp-press': { seating: 'insert' },
  'mp-compression': { seating: 'insert' },
  eurocone: { seating: 'insert' },
  'hose-barb': { seating: 'insert' },
};

/**
 * Пары разных систем, которые стыкуются: наружный разъём системы external входит
 * во внутренний разъём системы internal. Номиналы сравнимы (одна шкала).
 * Наружный 'mp-press' — конец трубы МП: его принимают и пресс-, и обжимные фитинги.
 * Обратного нет: пресс-фитинг не стыкуется с обжимным.
 */
const CROSS_SYSTEM: readonly { external: ConnectorJoint; internal: ConnectorJoint }[] = [
  { external: 'mp-press', internal: 'mp-compression' },
];

/**
 * Совместимость и посадка разъёмов по системам соединения. Одно правило для
 * ConnectorMating.check и ConnectorMating.place: посадка проверки и установки совпадает.
 */
export class ConnectionRules {
  static seating(joint: ConnectorJoint): Seating {
    return SYSTEMS[joint].seating;
  }

  static check(a: Connector, b: Connector): MatingCheck {
    if (!ConnectionRules.systemsMatch(a, b)) {
      return { compatible: false, reason: 'joint', message: `разные способы соединения: ${a.joint} и ${b.joint}` };
    }
    if (a.nominal !== b.nominal) {
      return { compatible: false, reason: 'nominal', message: `разные номиналы: ${a.nominal} и ${b.nominal}` };
    }
    if (a.gender === b.gender) {
      const kind = a.gender === 'internal' ? 'внутренние' : 'наружные';
      return { compatible: false, reason: 'gender', message: `оба разъёма ${kind}` };
    }
    return { compatible: true, engagement: ConnectionRules.engagement(a, b) };
  }

  /** Глубина посадки, м: на сколько торец подвижной детали заходит за торец неподвижной. */
  static engagement(a: Connector, b: Connector): number {
    return Math.min(a.depth, b.depth);
  }

  /**
   * Одна система — совместимы (пол проверяется отдельно). Разные — только пара из CROSS_SYSTEM
   * с правильной стороной: наружный разъём своей системы, внутренний — своей.
   */
  private static systemsMatch(a: Connector, b: Connector): boolean {
    if (a.joint === b.joint) return true;
    const [external, internal] = a.gender === 'external' ? [a, b] : [b, a];
    if (external.gender !== 'external' || internal.gender !== 'internal') return false;
    return CROSS_SYSTEM.some((pair) => pair.external === external.joint && pair.internal === internal.joint);
  }
}
