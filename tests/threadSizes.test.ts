import { describe, expect, it } from 'vitest';
import { ThreadSizes } from '../src/lib/index';

// Значения посчитаны вручную по таблице sizeRezba (мм → м, округление до 0,1 мм).
describe('ThreadSizes', () => {
  it('внутренняя резьба: n = d, v = d − t', () => {
    expect(ThreadSizes.diameters('1/2', 'internal')).toEqual({ n: 0.0213, v: 0.0186 });
    expect(ThreadSizes.diameters('1 1/4', 'internal')).toEqual({ n: 0.0423, v: 0.0391 });
    expect(ThreadSizes.diameters('2', 'internal')).toEqual({ n: 0.06, v: 0.0565 });
  });

  it('наружная резьба: n = d − t, v = d − 2t', () => {
    expect(ThreadSizes.diameters('1/2', 'external')).toEqual({ n: 0.0186, v: 0.0159 });
    expect(ThreadSizes.diameters('3/4', 'external')).toEqual({ n: 0.024, v: 0.0212 });
  });

  it('неизвестный номинал', () => {
    expect(ThreadSizes.has('7/8')).toBe(false);
    expect(ThreadSizes.has('toString')).toBe(false);
    expect(ThreadSizes.diameters('7/8', 'internal')).toBeNull();
  });

  it('14 номиналов из источника', () => {
    expect(ThreadSizes.nominals).toHaveLength(14);
  });
});
