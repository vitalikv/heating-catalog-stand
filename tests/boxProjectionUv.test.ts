import { BufferAttribute, BufferGeometry, PlaneGeometry } from 'three';
import { describe, expect, it } from 'vitest';
import { BoxProjectionUv } from '../src/lib/geometry/BoxProjectionUv';

function triangle(points: number[]): BufferGeometry {
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(new Float32Array(points), 3));
  return geometry;
}

describe('BoxProjectionUv', () => {
  it('нормаль по Z — проекция на XY', () => {
    const geometry = BoxProjectionUv.apply(triangle([1, 2, 5, 3, 2, 5, 1, 4, 5]));
    expect(Array.from(geometry.getAttribute('uv').array)).toEqual([1, 2, 3, 2, 1, 4]);
  });

  it('нормаль по Y — проекция на XZ', () => {
    const geometry = BoxProjectionUv.apply(triangle([1, 7, 2, 1, 7, 4, 3, 7, 2]));
    expect(Array.from(geometry.getAttribute('uv').array)).toEqual([1, 2, 1, 4, 3, 2]);
  });

  it('нормаль по X — проекция на YZ', () => {
    const geometry = BoxProjectionUv.apply(triangle([9, 1, 2, 9, 3, 2, 9, 1, 4]));
    expect(Array.from(geometry.getAttribute('uv').array)).toEqual([1, 2, 3, 2, 1, 4]);
  });

  it('индексированная геометрия становится неиндексированной', () => {
    const geometry = BoxProjectionUv.apply(new PlaneGeometry(1, 1, 2, 2));
    expect(geometry.index).toBeNull();
    expect(geometry.getAttribute('uv').count).toBe(geometry.getAttribute('position').count);
    expect(geometry.getAttribute('position').count).toBe(2 * 2 * 2 * 3);
  });
});
