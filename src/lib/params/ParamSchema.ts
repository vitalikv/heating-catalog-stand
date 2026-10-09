import type { ParamSpec, ValidationError } from '../core/contracts';

const toMm = (meters: number) => Math.round(meters * 10000) / 10;

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

  private static check(spec: ParamSpec, value: unknown): ValidationError | null {
    const param = spec.key;

    if (spec.kind === 'choice') {
      if ((typeof value === 'string' || typeof value === 'number') && spec.options.includes(value)) return null;
      return { code: 'unknown_option', param, message: `${spec.label}: недопустимое значение '${String(value)}'` };
    }

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
