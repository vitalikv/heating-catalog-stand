import { BoxGeometry, Mesh, MeshStandardMaterial } from 'three';
import { describe, expect, it } from 'vitest';

// Генераторы будут проверяться в node без DOM; здесь проверяется сама среда.
describe('окружение тестов', () => {
  it('Three.js строит геометрию без DOM', () => {
    const geometry = new BoxGeometry(0.1, 0.2, 0.3);
    const mesh = new Mesh(geometry, new MeshStandardMaterial());
    geometry.computeBoundingBox();

    expect(typeof document).toBe('undefined');
    expect(mesh.geometry.boundingBox?.max.y).toBeCloseTo(0.1);
  });
});
