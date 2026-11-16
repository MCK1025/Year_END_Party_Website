import { Mesh, PlaneGeometry, ShaderMaterial, Vector2 } from "three";
import { type StoryScene, unitPoint } from "../components/waiting/story";
import { createGraphicsSession } from "./service";

export type StorySample = { scene: StoryScene; fraction: number };
export function createStoryGraphics(canvas: HTMLCanvasElement, sample: () => StorySample, fail: () => void) {
  let redraw = () => {};
  const session = createGraphicsSession(
    canvas,
    [
      ({ scene }) => {
        const geometry = new PlaneGeometry(2, 2);
        const uniforms = {
          center: { value: new Vector2() },
          radius: { value: new Vector2() },
          time: { value: 0 },
          kind: { value: 0 },
        };
        const material = new ShaderMaterial({
          transparent: true,
          depthTest: false,
          depthWrite: false,
          uniforms,
          vertexShader: `
        uniform vec2 center, radius;
        varying vec2 p;
        void main() {
          p=position.xy;
          vec2 uvTop=center+radius*vec2(p.x,-p.y);
          gl_Position=vec4(uvTop.x*2.-1.,1.-uvTop.y*2.,0.,1.);
        }`,
          fragmentShader: `
        varying vec2 p;
        uniform float time, kind;
        void main() {
          float d=length(p);
          float mask=1.-smoothstep(.72,1.,d);
          float pulse=sin(3.14159*time);
          float alpha;
          if(kind<.5){
            float wave=fract(time*2.);
            alpha=(1.-smoothstep(.045,.18,abs(d-wave)))*sin(wave*3.14159)*.54;
          } else if(kind<1.5){
            mask=1.-smoothstep(.76,1.,max(abs(p.x),abs(p.y)));
            alpha=.36*pulse;
          } else {
            alpha=.27*exp(-6.*pow(p.x-(time*1.6-.8),2.))*pulse;
          }
          gl_FragColor=vec4(1.,.86,.56,alpha*mask);
        }`,
        });
        const plane = new Mesh(geometry, material);
        plane.frustumCulled = false;
        scene.add(plane);
        redraw = () => {
          const { scene: art, fraction } = sample();
          const area = art.surface;
          plane.visible = !!area;
          if (!area) return;
          uniforms.center.value.set(...unitPoint(area.center, art.size));
          uniforms.radius.value.set(...unitPoint(area.radii, art.size));
          uniforms.time.value = fraction;
          uniforms.kind.value = area.kind === "ripple" ? 0 : area.kind === "calendar" ? 1 : 2;
        };
        return {
          update: redraw,
          dispose() {
            scene.remove(plane);
            geometry.dispose();
            material.dispose();
          },
        };
      },
    ],
    fail,
    2,
    { initiallyPaused: true, ephemeralCanvas: true },
  );
  return {
    ...session,
    refresh(paused: boolean) {
      redraw();
      session.setPaused(paused);
    },
  };
}
