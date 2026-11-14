import {
  AmbientLight,
  BoxGeometry,
  BufferGeometry,
  DirectionalLight,
  DoubleSide,
  Group,
  Line,
  LineBasicMaterial,
  Mesh,
  MeshStandardMaterial,
  Shape,
  ShapeGeometry,
  Vector3,
} from "three";
import { arrivalPhase, type InvitationPhase, invitationMotion, progress } from "../../lib/invitation";
import { disposeObject } from "../dispose";
import type { InvitationAnchor } from "../invitation-layout";
import { graphicsPalette } from "../palette";
import type { EffectFactory } from "../types";

export type EnvelopeController = { readonly start: () => void; readonly depart: () => void };
export type EnvelopeEvents = {
  readonly phase: (phase: InvitationPhase) => void;
  readonly complete: () => void;
};
export function envelopeEffect(anchor: () => InvitationAnchor, events: EnvelopeEvents) {
  let active = false;
  let departing = false;
  let origin: number | null = null;
  let last = 0;
  let departureOrigin = 0;
  let phase: InvitationPhase = "preparing";
  const controller: EnvelopeController = {
    start() {
      active = true;
    },
    depart() {
      if (!departing) {
        departing = true;
        departureOrigin = last;
      }
    },
  };
  const factory: EffectFactory = ({ scene }) => {
    const root = new Group();
    const envelope = new Group();
    const flap = new Group();
    const wind = new Line(
      new BufferGeometry().setFromPoints(
        Array.from({ length: 25 }, (_, i) => {
          const u = i / 24;
          return new Vector3(-1.1 + 0.59 * u, -0.2 + 0.31 * u + Math.sin(u * 2 * Math.PI) * 0.045, -0.05);
        }),
      ),
      new LineBasicMaterial({ color: graphicsPalette.brass, transparent: true, depthWrite: false }),
    );
    envelope.add(wind);
    const navy = new MeshStandardMaterial({ color: graphicsPalette.navy, roughness: 1, side: DoubleSide });
    const fold = new MeshStandardMaterial({
      color: graphicsPalette.navySoft,
      roughness: 1,
      side: DoubleSide,
    });
    const ivory = new MeshStandardMaterial({ color: graphicsPalette.ivory, roughness: 1 });
    const back = new Mesh(new BoxGeometry(1, 0.62, 0.012), navy);
    const paper = new Mesh(new BoxGeometry(1, 1, 0.006), ivory);
    const triangle = (points: readonly (readonly [number, number])[], material: MeshStandardMaterial) => {
      const shape = new Shape();
      for (const [index, point] of points.entries()) {
        if (index === 0) shape.moveTo(...point);
        else shape.lineTo(...point);
      }
      shape.closePath();
      return new Mesh(new ShapeGeometry(shape), material);
    };
    const left = triangle(
      [
        [-0.5, -0.31],
        [-0.5, 0.31],
        [0.12, -0.08],
      ],
      fold,
    );
    const right = triangle(
      [
        [0.5, -0.31],
        [0.5, 0.31],
        [-0.12, -0.08],
      ],
      fold,
    );
    const front = triangle(
      [
        [-0.5, -0.31],
        [0.5, -0.31],
        [0.5, -0.2],
        [0, 0.13],
        [-0.5, -0.2],
      ],
      navy,
    );
    const lid = triangle(
      [
        [-0.5, 0],
        [0.5, 0],
        [0, -0.38],
      ],
      fold,
    );
    back.position.z = -0.025;
    left.position.z = 0.02;
    right.position.z = 0.022;
    front.position.z = 0.03;
    flap.position.set(0, 0.31, 0.035);
    flap.add(lid);
    envelope.add(back, left, right, front, flap);
    root.add(paper, envelope);
    const ambient = new AmbientLight(0xffffff, 2.1);
    const light = new DirectionalLight(0xffffff, 1.3);
    light.position.set(-3, 5, 7);
    scene.add(root, ambient, light);
    return {
      update(elapsed) {
        if (!active) {
          // Keep materials visible to compileAsync, but outside the camera before ready.
          root.position.x = 1000;
          return;
        }
        root.visible = true;
        origin ??= elapsed;
        last = elapsed;
        const t = elapsed - origin;
        const exit = departing ? elapsed - departureOrigin : 0;
        const arrive = progress(t, 0, invitationMotion.arrive);
        wind.visible = t < invitationMotion.arrive;
        wind.material.opacity = Math.sin(Math.PI * arrive) * 0.75;
        const unfold = departing
          ? 1 - progress(exit, 0, 0.4)
          : progress(t, invitationMotion.open, invitationMotion.read);
        const open = departing
          ? 1 - progress(exit, 0.35, 0.65)
          : progress(t, invitationMotion.settle, invitationMotion.open);
        const fly = departing ? progress(exit, 0.6, invitationMotion.departure) : 0;
        const a = anchor();
        const width = a.width * 0.8;
        const bodyY = a.y - unfold * (a.height / 2 + width * 0.16);
        root.position.set(
          -(1 - arrive) * a.viewportWidth + fly * a.viewportWidth,
          -(1 - arrive) * 2 + fly * 4,
          0,
        );
        root.rotation.z =
          (1 - arrive) * -0.14 +
          (t > 1.2 && t < 1.5 ? Math.sin(((t - 1.2) / 0.3) * Math.PI * 2) * 0.018 : 0) +
          fly * 0.12;
        root.scale.setScalar(0.82 + arrive * 0.18 - fly * 0.15);
        envelope.scale.setScalar(width);
        envelope.position.set(a.x, bodyY, 0);
        flap.rotation.x = -open * Math.PI;
        paper.position.set(a.x, bodyY + unfold * (a.y - bodyY), 0);
        paper.scale.set(
          width * 0.92 + unfold * (a.width - width * 0.92),
          width * 0.5 + unfold * (a.height - width * 0.5),
          1,
        );
        paper.visible = unfold > 0 && (departing || t < invitationMotion.read);
        const next = departing ? "departing" : arrivalPhase(t);
        if (next !== phase) {
          phase = next;
          events.phase(next);
        }
        if (departing && exit >= invitationMotion.departure) {
          active = false;
          events.complete();
        }
      },
      dispose() {
        wind.geometry.dispose();
        wind.material.dispose();
        scene.remove(root, ambient, light);
        disposeObject(root);
      },
    };
  };
  return { factory, controller };
}
