import { BoxGeometry, Group, Mesh, MeshBasicMaterial } from "three";
import { expect, it, vi } from "vitest";
import { disposeObject } from "../../src/graphics/dispose";

it("releases a shared GPU resource once when an effect has multiple mesh instances", () => {
  const geometry = new BoxGeometry();
  const material = new MeshBasicMaterial();
  const releaseGeometry = vi.spyOn(geometry, "dispose");
  const releaseMaterial = vi.spyOn(material, "dispose");
  const effect = new Group();
  effect.add(new Mesh(geometry, material), new Mesh(geometry, material));
  disposeObject(effect);
  expect(releaseGeometry).toHaveBeenCalledTimes(1);
  expect(releaseMaterial).toHaveBeenCalledTimes(1);
});
