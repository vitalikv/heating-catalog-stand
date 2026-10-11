import type { ParamSpec, ValidationError } from '../core/contracts';

const toMm = (meters: number) => Math.round(meters * 10000) / 10;

/** Копия параметров — простых данных (строки, числа, вложенные объекты); structuredClone в библиотеке без DOM недоступен. */
const clonePlain = <T>(value: T): T => (value === undefined ? value : (JSON.parse(JSON.stringify(value)) as T));

/** Доступ к параметрам по пути ParamSpec.key и проверка по схеме. */
export class ParamSchema {
  /** Значение по пути вида 'size.y'; undefined, если пути нет. */
  static get(params: unknown, key: string): unknown {
    return key.split('.').reduce<unknown>(
      (node, part) => (typeof node === 'object' && node !== null ? (node as Record<string, unknown>)[part] : undefined),
      params,
    );
  }

  /** Записывает значение по пути, создавая промежуточные объекты. */
  static set(params: Record<string, unknown>, key: string, value: unknown): void {
    const parts = key.split('.');
    const last = parts.pop()!;
    let node = params;
    for (const part of parts) {
      if (typeof node[part] !== 'object' || node[part] === null) node[part] = {};
      node = node[part] as Record<string, unknown>;
    }
    node[last] = value;
  }

  /**
   * Дополняет параметры значениями из defaults для отсутствующих ключей с addedIn
   * (параметры, сохранённые до версии, где ключ появился). Исходный объект не меняется;
   * если дополнять нечего, он и возвращается.
   */
  static withAddedDefaults<P>(specs: readonly ParamSpec[], params: P, defaults: P): P {
    const missing = specs.filter((spec) => spec.addedIn !== undefined && ParamSchema.get(params, spec.key) === undefined);
    if (missing.length === 0 || typeof params !== 'object' || params === null) return params;
    const completed = clonePlain(params) as Record<string, unknown>;
    for (const spec of missing) ParamSchema.set(completed, spec.key, clonePlain(ParamSchema.get(defaults, spec.key)));
    return completed as P;
  }

  /** Проверка каждого параметра по его описанию; связи между параметрами проверяет генератор. */
  static validate(specs: readonly ParamSpec[], params: unknown): ValidationError[] {
    const errors: ValidationError[] = [];
    for (const spec of specs) {
      if (!ParamSchema.isActive(spec, params)) continue;
      const error = ParamSchema.check(spec, ParamSchema.get(params, spec.key));
      if (error) errors.push(error);
    }
    return errors;
  }

  /** Ошибка связи параметров: длина param должна быть больше minimum, м. */
  static tooShort(param: string, minimum: number): ValidationError {
    return { code: 'too_short', param, message: `${param}: нужно больше ${(minimum * 1000).toFixed(1)} мм` };
  }

  /** Нужен ли параметр при текущих значениях (условие ParamSpec.when). */
  static isActive(spec: ParamSpec, params: unknown): boolean {
    if (!spec.when) return true;
    return spec.when.values.includes(String(ParamSchema.get(params, spec.when.key)));
  }

  /** Путь: массив точек {x, y, z} с конечными координатами; число точек и координаты — в границах схемы. */
  private static checkPath(spec: Extract<ParamSpec, { kind: 'path' }>, value: unknown): ValidationError | null {
    const param = spec.key;
    const isPoint = (point: unknown) => typeof point === 'object' && point !== null
      && (['x', 'y', 'z'] as const).every((axis) => Number.isFinite((point as Record<string, unknown>)[axis]));
    if (!Array.isArray(value) || !value.every(isPoint)) {
      return { code: 'not_a_path', param, message: `${spec.label}: нужен массив точек {x, y, z}` };
    }
    if (value.length < spec.minPoints || value.length > spec.maxPoints) {
      return { code: 'path_points', param, message: `${spec.label}: точек ${value.length} — нужно ${spec.minPoints}…${spec.maxPoints}` };
    }
    const index = value.findIndex((point: Record<string, number>) => Math.max(Math.abs(point.x), Math.abs(point.y), Math.abs(point.z)) > spec.extent);
    if (index >= 0) {
      return { code: 'out_of_range', param, message: `${spec.label}: точка ${index + 1} дальше ${toMm(spec.extent)} мм от начала координат` };
    }
    return null;
  }

  private static check(spec: ParamSpec, value: unknown): ValidationError | null {
    const param = spec.key;

    if (spec.kind === 'choice') {
      if ((typeof value === 'string' || typeof value === 'number') && spec.options.includes(value)) return null;
      return { code: 'unknown_option', param, message: `${spec.label}: недопустимое значение '${String(value)}'` };
    }

    if (spec.kind === 'path') return ParamSchema.checkPath(spec, value);

    if (typeof value !== 'number' || !Number.isFinite(value)) {
      return { code: 'not_a_number', param, message: `${spec.label}: нужно число, получено '${String(value)}'` };
    }

    if (spec.kind === 'integer') {
      if (!Number.isInteger(value)) {
        return { code: 'not_integer', param, message: `${spec.label}: нужно целое число, получено ${value}` };
      }
      if (value < spec.min || value > spec.max) {
        return { code: 'out_of_range', param, message: `${spec.label}: ${value} — вне диапазона ${spec.min}…${spec.max}` };
      }
      return null;
    }

    if (value < spec.min || value > spec.max) {
      return { code: 'out_of_range', param, message: `${spec.label}: ${toMm(value)} мм — вне диапазона ${toMm(spec.min)}…${toMm(spec.max)} мм` };
    }
    return null;
  }
}
