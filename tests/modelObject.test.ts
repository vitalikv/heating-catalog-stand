import { Mesh } from 'three';
import { describe, expect, it } from 'vitest';
import { createModelObject, GeneratorRegistry, MaterialLibrary } from '../src/lib/index';

describe('createModelObject', () => {
  const library = new MaterialLibrary();
  const model = new GeneratorRegistry().get('steel.coupling').build({ nominalLeft: '1', nominalRight: '1/2', length: 0.034 });

  it('корень с названием модели и один меш с её геометрией и материалами по ключам', () => {
    const root = createModelObject(model, library);
    expect(root.name).toBe(model.title);
    expect(root.children).toHaveLength(1);
    const mesh = root.children[0] as Mesh;
    expect(mesh).toBeInstanceOf(Mesh);
    expect(mesh.geometry).toBe(model.geometry);
    expect(mesh.material).toEqual(model.materials.map((key) => library.get(key)));
  });

  it('dispose модели не трогает общие материалы', () => {
    createModelObject(model, library);
    let materialDisposed = false;
    library.get('metal').addEventListener('dispose', () => (materialDisposed = true));
    model.dispose();
    expect(materialDisposed).toBe(false);
  });
});
