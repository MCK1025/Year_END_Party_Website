import { type BufferGeometry, type Material, Mesh, type Object3D, Points } from "three";

export function disposeObject(root: Object3D) {
  root.removeFromParent();
  const geometries = new Set<BufferGeometry>();
  const resources = new Set<Material>();
  root.traverse((object) => {
    if (object instanceof Mesh || object instanceof Points) {
      geometries.add(object.geometry);
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      for (const material of materials) resources.add(material);
    }
  });
  for (const geometry of geometries) geometry.dispose();
  for (const material of resources) material.dispose();
}
