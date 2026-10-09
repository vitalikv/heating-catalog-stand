import type { ValidationError } from './contracts';

/** Бросается из build(), если параметры не прошли validate(). */
export class GeneratorParamsError extends Error {
  constructor(
    readonly generatorId: string,
    readonly errors: readonly ValidationError[],
  ) {
    super(`${generatorId}: ${errors.map((error) => error.message).join('; ')}`);
    this.name = 'GeneratorParamsError';
  }
}
