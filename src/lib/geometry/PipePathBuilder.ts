import { BufferAttribute, BufferGeometry, Quaternion, Vector3 } from 'three';
import type { Vector3Data } from '../core/contracts';

/** Граней по окружности — как у прямой трубы (StraightPipe). */
const RADIAL_SEGMENTS = 12;
/** Шаг дуги изгиба: не больше 15°; число шагов зависит только от угла — одинаковый вход даёт одинаковую сетку. */
const ARC_STEP = Math.PI / 12;
const EPS = 1e-6;

/** Ошибка траектории: code — вид, segment — номер отрезка (с 1) или вершины, message — для интерфейса. */
export interface PipePathIssue {
  code: 'zero_segment' | 'reversal' | 'segment_too_short' | 'self_intersection';
  message: string;
}

/** Конец трубы: центр торца, направление наружу и опорное направление сечения (для Connector.up). */
export interface PipePathEnd {
  position: Vector3Data;
  direction: Vector3Data;
  up: Vector3Data;
  /** Прямой участок у конца, м: на него садится фитинг. */
  straight: number;
}

export interface PipePathResult {
  geometry: BufferGeometry;
  start: PipePathEnd;
  end: PipePathEnd;
  /** Длина осевой линии с дугами, м. */
  length: number;
}

interface Sample {
  position: Vector3;
  tangent: Vector3;
}

/** Без −0: у осевых направлений нулевые компоненты сравниваются как обычный ноль. */
const toData = (v: Vector3): Vector3Data => ({ x: v.x + 0, y: v.y + 0, z: v.z + 0 });
const mm = (meters: number) => (meters * 1000).toFixed(1);

/**
 * Труба по пространственной траектории: ломаная points, изгибы скруглены дугами радиуса bendRadius
 * по осевой. Сечение — окружность diameter, ориентация переносится вдоль пути параллельно
 * (без скачков и закрутки). Труба открытая, как прямая труба; UV — в метрах: u — длина по оси,
 * v — длина по окружности.
 *
 * Проверки (analyze): нулевые отрезки, разворот на 180°, отрезок короче суммы касательных его
 * скруглений, сближение несмежных отрезков ломаной ближе diameter. Самопересечение проверяется
 * по прямым отрезкам ломаной, дуги изгибов — внутри своих углов и отдельно не проверяются.
 */
export class PipePathBuilder {
  static analyze(points: readonly Vector3Data[], bendRadius: number, diameter: number): PipePathIssue[] {
    const issues: PipePathIssue[] = [];
    const p = points.map((point) => new Vector3(point.x, point.y, point.z));
    const lengths = p.slice(1).map((point, i) => point.distanceTo(p[i]));
    lengths.forEach((length, i) => {
      if (length < EPS) issues.push({ code: 'zero_segment', message: `Отрезок ${i + 1}: точки ${i + 1} и ${i + 2} совпадают` });
    });
    if (issues.length > 0) return issues;

    const tangents = PipePathBuilder.tangentLengths(p, bendRadius);
    tangents.forEach((tangent, i) => {
      if (tangent === Infinity) issues.push({ code: 'reversal', message: `Точка ${i + 1}: разворот на 180° — нужна промежуточная точка` });
    });
    if (issues.length > 0) return issues;
    lengths.forEach((length, i) => {
      const need = tangents[i] + tangents[i + 1];
      if (need > length + EPS) {
        issues.push({ code: 'segment_too_short', message: `Отрезок ${i + 1}: ${mm(length)} мм, на скругления радиусом ${mm(bendRadius)} мм нужно ${mm(need)} мм` });
      }
    });
    for (let i = 0; i < lengths.length; i++) {
      for (let j = i + 2; j < lengths.length; j++) {
        const distance = segmentDistance(p[i], p[i + 1], p[j], p[j + 1]);
        if (distance < diameter) {
          issues.push({ code: 'self_intersection', message: `Отрезки ${i + 1} и ${j + 1} сходятся на ${mm(distance)} мм — меньше диаметра трубы` });
        }
      }
    }
    return issues;
  }

  /** Строит трубу; траектория должна пройти analyze без ошибок. */
  static build(points: readonly Vector3Data[], bendRadius: number, diameter: number): PipePathResult {
    const issues = PipePathBuilder.analyze(points, bendRadius, diameter);
    if (issues.length > 0) throw new Error(`PipePathBuilder: ${issues.map((issue) => issue.message).join('; ')}`);
    const p = points.map((point) => new Vector3(point.x, point.y, point.z));
    const samples = PipePathBuilder.centerline(p, bendRadius);
    const normals = PipePathBuilder.transportFrames(samples);
    const tangents = PipePathBuilder.tangentLengths(p, bendRadius);
    const last = p.length - 1;

    const geometry = PipePathBuilder.tube(samples, normals, diameter / 2);
    const length = samples.slice(1).reduce((sum, sample, i) => sum + sample.position.distanceTo(samples[i].position), 0);
    const first = samples[0];
    const final = samples[samples.length - 1];
    return {
      geometry,
      length,
      start: { position: toData(first.position), direction: toData(first.tangent.clone().negate()), up: toData(normals[0]),
        straight: p[1].distanceTo(p[0]) - tangents[1] },
      end: { position: toData(final.position), direction: toData(final.tangent.clone()), up: toData(normals[normals.length - 1]),
        straight: p[last].distanceTo(p[last - 1]) - tangents[last - 1] },
    };
  }

  /** Касательные скруглений по вершинам, м: R·tg(θ/2); у концов 0, при развороте — Infinity. */
  private static tangentLengths(p: Vector3[], radius: number): number[] {
    return p.map((point, i) => {
      if (i === 0 || i === p.length - 1) return 0;
      const before = point.clone().sub(p[i - 1]).normalize();
      const after = p[i + 1].clone().sub(point).normalize();
      const angle = Math.acos(Math.min(1, Math.max(-1, before.dot(after))));
      if (angle > Math.PI - 1e-6) return Infinity;
      return angle < 1e-9 ? 0 : radius * Math.tan(angle / 2);
    });
  }

  /** Точки осевой с касательными: прямые участки и дуги изгибов; совпадающие соседние точки не повторяются. */
  private static centerline(p: Vector3[], radius: number): Sample[] {
    const samples: Sample[] = [];
    const push = (position: Vector3, tangent: Vector3) => {
      const previous = samples[samples.length - 1];
      if (previous && previous.position.distanceTo(position) < EPS) {
        previous.tangent.copy(tangent);
        return;
      }
      samples.push({ position, tangent: tangent.clone() });
    };
    push(p[0].clone(), p[1].clone().sub(p[0]).normalize());
    for (let i = 1; i < p.length - 1; i++) {
      const before = p[i].clone().sub(p[i - 1]).normalize();
      const after = p[i + 1].clone().sub(p[i]).normalize();
      const angle = Math.acos(Math.min(1, Math.max(-1, before.dot(after))));
      if (angle < 1e-9) continue;
      const tangent = radius * Math.tan(angle / 2);
      const arcStart = p[i].clone().addScaledVector(before, -tangent);
      // Направление к центру дуги — составляющая «после», перпендикулярная «до».
      const inward = after.clone().addScaledVector(before, -after.dot(before)).normalize();
      const center = arcStart.clone().addScaledVector(inward, radius);
      const steps = Math.max(2, Math.ceil(angle / ARC_STEP));
      for (let k = 0; k <= steps; k++) {
        const phi = (angle * k) / steps;
        const position = center.clone().addScaledVector(inward, -radius * Math.cos(phi)).addScaledVector(before, radius * Math.sin(phi));
        push(position, before.clone().multiplyScalar(Math.cos(phi)).addScaledVector(inward, Math.sin(phi)).normalize());
      }
    }
    const last = p.length - 1;
    push(p[last].clone(), p[last].clone().sub(p[last - 1]).normalize());
    return samples;
  }

  /**
   * Опорные векторы сечения: начальный — проекция +Y на плоскость сечения (у вертикального начала —
   * проекция +X), дальше — параллельный перенос поворотом от касательной к касательной.
   */
  private static transportFrames(samples: Sample[]): Vector3[] {
    const t0 = samples[0].tangent;
    const reference = Math.abs(t0.y) < 0.99 ? new Vector3(0, 1, 0) : new Vector3(1, 0, 0);
    let normal = reference.addScaledVector(t0, -reference.dot(t0)).normalize();
    const normals = [normal.clone()];
    const turn = new Quaternion();
    for (let k = 1; k < samples.length; k++) {
      turn.setFromUnitVectors(samples[k - 1].tangent, samples[k].tangent);
      normal = normal.clone().applyQuaternion(turn);
      const t = samples[k].tangent;
      normal.addScaledVector(t, -normal.dot(t)).normalize();
      normals.push(normal);
    }
    return normals;
  }

  /** Неиндексированная боковая поверхность: кольца сечения по точкам осевой, нормали наружу. */
  private static tube(samples: Sample[], normals: Vector3[], radius: number): BufferGeometry {
    const rings = samples.map((sample, k) => {
      const n = normals[k];
      const b = sample.tangent.clone().cross(n);
      return Array.from({ length: RADIAL_SEGMENTS + 1 }, (_, j) => {
        const angle = (2 * Math.PI * j) / RADIAL_SEGMENTS;
        const out = n.clone().multiplyScalar(Math.cos(angle)).addScaledVector(b, Math.sin(angle));
        return { position: sample.position.clone().addScaledVector(out, radius), normal: out, v: angle * radius };
      });
    });
    const along = [0];
    for (let k = 1; k < samples.length; k++) along.push(along[k - 1] + samples[k].position.distanceTo(samples[k - 1].position));

    const quads = (samples.length - 1) * RADIAL_SEGMENTS;
    const position = new Float32Array(quads * 18);
    const normal = new Float32Array(quads * 18);
    const uv = new Float32Array(quads * 12);
    let vertex = 0;
    const put = (k: number, j: number) => {
      const point = rings[k][j];
      position.set([point.position.x, point.position.y, point.position.z], vertex * 3);
      normal.set([point.normal.x, point.normal.y, point.normal.z], vertex * 3);
      uv.set([along[k], point.v], vertex * 2);
      vertex++;
    };
    for (let k = 0; k < samples.length - 1; k++) {
      for (let j = 0; j < RADIAL_SEGMENTS; j++) {
        put(k, j); put(k, j + 1); put(k + 1, j);
        put(k, j + 1); put(k + 1, j + 1); put(k + 1, j);
      }
    }
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new BufferAttribute(position, 3));
    geometry.setAttribute('normal', new BufferAttribute(normal, 3));
    geometry.setAttribute('uv', new BufferAttribute(uv, 2));
    return geometry;
  }
}

/** Наименьшее расстояние между отрезками ab и cd. */
function segmentDistance(a: Vector3, b: Vector3, c: Vector3, d: Vector3): number {
  const u = b.clone().sub(a);
  const v = d.clone().sub(c);
  const w = a.clone().sub(c);
  const uu = u.dot(u), uv = u.dot(v), vv = v.dot(v), uw = u.dot(w), vw = v.dot(w);
  const denominator = uu * vv - uv * uv;
  let s = denominator < EPS * EPS ? 0 : Math.min(1, Math.max(0, (uv * vw - vv * uw) / denominator));
  let t = (uv * s + vw) / vv;
  if (t < 0 || t > 1) {
    t = Math.min(1, Math.max(0, t));
    s = Math.min(1, Math.max(0, (uv * t - uw) / uu));
  }
  return a.clone().addScaledVector(u, s).distanceTo(c.clone().addScaledVector(v, t));
}
