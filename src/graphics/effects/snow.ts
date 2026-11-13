import { BufferAttribute, BufferGeometry, Points, PointsMaterial } from "three";
import { disposeObject } from "../dispose";
import { graphicsPalette } from "../palette";
import type { EffectFactory } from "../types";

export const snowEffect: EffectFactory = ({ scene, camera }) => {
  const count = 90;
  const positions = new Float32Array(count * 3);
  const geometry = new BufferGeometry();
  const attribute = new BufferAttribute(positions, 3);
  geometry.setAttribute("position", attribute);
  const points = new Points(
    geometry,
    new PointsMaterial({
      color: graphicsPalette.ivory,
      size: 0.022,
      transparent: true,
      opacity: 0.45,
      depthWrite: false,
    }),
  );
  scene.add(points);
  return {
    update(time) {
      for (let i = 0; i < count; i++) {
        positions[i * 3] = Math.sin(i * 137.5) * (camera.right + 0.35) + Math.sin(time * 0.24 + i) * 0.08;
        positions[i * 3 + 1] =
          camera.top +
          0.3 -
          ((i * 0.618 + time * (0.07 + (i % 4) * 0.014)) % (camera.top - camera.bottom + 0.6));
        positions[i * 3 + 2] = (i % 5) - 2;
      }
      attribute.needsUpdate = true;
    },
    dispose() {
      disposeObject(points);
    },
  };
};
