import { BufferAttribute, BufferGeometry, Triangle, Vector3 } from 'three';

type Axis = 'x' | 'y' | 'z';

const AXES: readonly Axis[] = ['x', 'y', 'z'];

/**
 * UV проекцией по главной оси нормали каждого треугольника (перенос upUvs_5).
 * Треугольник проецируется на плоскость двух осей с наименьшими компонентами
 * его нормали; координаты берутся в метрах как есть. От этих UV зависит,
 * как ляжет текстура резьбы с repeat.x = 900.
 */
export class BoxProjectionUv {
  /**
   * Возвращает неиндексированную геометрию с атрибутом uv. Индексированная
   * геометрия заменяется копией через toNonIndexed() и освобождается.
   */
  static apply(geometry: BufferGeometry): BufferGeometry {
    let target = geometry;
    if (geometry.index !== null) {
      target = geometry.toNonIndexed();
      geometry.dispose();
    }

    const position = target.getAttribute('position');
    const uv = new Float32Array(position.count * 2);
    const triangle = new Triangle();
    const normal = new Vector3();
    const vertex = new Vector3();

    for (let first = 0; first + 2 < position.count; first += 3) {
      triangle.setFromAttributeAndIndices(position, first, first + 1, first + 2);
      triangle.getNormal(normal);

      // Устойчивая сортировка: при равных компонентах порядок x, y, z, как в gl2.
      const [u, v] = [...AXES].sort((a, b) => Math.abs(normal[a]) - Math.abs(normal[b]));

      for (let i = first; i < first + 3; i++) {
        vertex.fromBufferAttribute(position, i);
        uv[i * 2] = vertex[u];
        uv[i * 2 + 1] = vertex[v];
      }
    }

    target.setAttribute('uv', new BufferAttribute(uv, 2));
    return target;
  }
}
