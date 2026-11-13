import {
  AmbientLight,
  ConeGeometry,
  CylinderGeometry,
  DirectionalLight,
  ExtrudeGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  Shape,
  SphereGeometry,
} from "three";
import { disposeObject } from "../dispose";
import { graphicsPalette as color } from "../palette";
import type { EffectFactory } from "../types";

export const treeEffect: EffectFactory = ({ scene }) => {
  const root = new Group();
  const ambient = new AmbientLight(color.ivory, 2);
  const key = new DirectionalLight(color.warm, 3.5);
  key.position.set(-3, 5, 6);
  root.add(ambient, key);
  const tierGeometry = new ConeGeometry(1, 1, 11);
  const branchGeometry = new ConeGeometry(1, 1, 5);
  const leaf = new MeshStandardMaterial({ color: color.leaf, roughness: 0.8, flatShading: true });
  const deep = new MeshStandardMaterial({ color: color.deep, roughness: 0.8, flatShading: true });
  const branchLeaf = new MeshStandardMaterial({ color: color.leaf, roughness: 1, flatShading: true });
  const branchLight = new MeshStandardMaterial({ color: color.light, roughness: 1, flatShading: true });
  for (let i = 0; i < 6; i++) {
    const tier = new Mesh(tierGeometry, i % 2 ? leaf : deep);
    tier.scale.set(0.43 + i * 0.215, 1.15 + i * 0.03, 0.43 + i * 0.215);
    tier.position.y = 1.36 - i * 0.54;
    tier.rotation.y = i * 0.42;
    root.add(tier);
    for (let branch = 0; branch < 9; branch++) {
      const angle = (branch / 9) * Math.PI * 2;
      const radius = 0.25 + i * 0.16;
      const tip = new Mesh(branchGeometry, branch % 3 ? branchLeaf : branchLight);
      tip.scale.set(0.21 + i * 0.035, 0.55, 0.21 + i * 0.035);
      tip.position.set(Math.cos(angle) * radius, 1.05 - i * 0.54, Math.sin(angle) * radius);
      tip.rotation.z = -Math.cos(angle) * 0.5;
      root.add(tip);
    }
  }
  const trunk = new Mesh(
    new CylinderGeometry(0.13, 0.19, 0.65, 9),
    new MeshStandardMaterial({ color: color.trunk, roughness: 1 }),
  );
  trunk.position.y = -2.05;
  root.add(trunk);
  const star = new Shape();
  for (let i = 0; i < 10; i++) {
    const angle = Math.PI / 2 + (i * Math.PI) / 5;
    const radius = i % 2 ? 0.11 : 0.25;
    const x = Math.cos(angle) * radius,
      y = Math.sin(angle) * radius;
    if (i === 0) star.moveTo(x, y);
    else star.lineTo(x, y);
  }
  star.closePath();
  const crown = new Mesh(
    new ExtrudeGeometry(star, {
      depth: 0.045,
      bevelEnabled: true,
      bevelSize: 0.015,
      bevelThickness: 0.015,
      bevelSegments: 1,
      steps: 1,
    }),
    new MeshStandardMaterial({
      color: color.warm,
      emissive: color.warm,
      emissiveIntensity: 0.25,
      metalness: 0.5,
      roughness: 0.4,
    }),
  );
  crown.position.set(0, 2.12, 0.15);
  root.add(crown);
  const bulbGeometry = new SphereGeometry(0.031, 6, 4);
  const lamps = Array.from(
    { length: 4 },
    () => new MeshStandardMaterial({ color: color.warm, emissive: color.warm, emissiveIntensity: 1.4 }),
  );
  for (let i = 0; i < 38; i++) {
    const y = 1.7 - (i / 37) * 3.55;
    const angle = (i / 37) * Math.PI * 9;
    const radius = 0.18 + (1.8 - y) * 0.35;
    const bulb = new Mesh(bulbGeometry, lamps[i % lamps.length]);
    bulb.position.set(Math.cos(angle) * radius, y, Math.sin(angle) * radius + 0.1);
    root.add(bulb);
  }
  scene.add(root);
  return {
    update(time) {
      lamps.forEach((lamp, i) => {
        lamp.emissiveIntensity = 1.3 + Math.sin(time * 0.7 + i) * 0.3;
      });
    },
    dispose() {
      disposeObject(root);
    },
  };
};
