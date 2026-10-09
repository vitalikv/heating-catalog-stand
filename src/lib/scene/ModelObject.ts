import { Group, Mesh } from 'three';
import type { GeneratedModel } from '../contracts';
import type { MaterialLibrary } from '../materials/MaterialLibrary';

/**
 * Объект сцены для модели — единственное место, где модель встречается с материалами:
 * корень с названием модели и один меш с её геометрией. Геометрия остаётся во владении
 * модели (model.dispose()), материалы — библиотеки.
 */
export function createModelObject(model: GeneratedModel, library: MaterialLibrary): Group {
  const root = new Group();
  root.name = model.title;
  root.add(new Mesh(model.geometry, model.materials.map((key) => library.get(key))));
  return root;
}
