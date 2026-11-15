import { BufferAttribute, BufferGeometry, Points, ShaderMaterial } from "three";
import { disposeObject } from "../dispose";
import { snowSeeds } from "../treeModel";
import type { EffectFactory } from "../types";

// Positions are expressed in screen space. Velocity and diameter stay in CSS
// pixels on the orthographic camera, including the taller 30-story layout.
export function snowfall(canvas: HTMLCanvasElement): EffectFactory {
  return ({ scene }) => {
    const flakes = snowSeeds();
    const geometry = new BufferGeometry();
    const coords = new Float32Array(flakes.length * 3);
    const positions = new BufferAttribute(coords, 3);
    geometry.setAttribute("position", positions);
    geometry.setAttribute(
      "flake",
      new BufferAttribute(new Float32Array(flakes.flatMap((f) => [f.size, f.opacity, f.kind, f.phase])), 4),
    );
    const material = new ShaderMaterial({
      transparent: true,
      depthWrite: false,
      depthTest: false,
      uniforms: { dpr: { value: Math.min(devicePixelRatio, 1.5) } },
      vertexShader: `
        attribute vec4 flake;
        uniform float dpr;
        varying vec4 shape;
        void main(){
          gl_Position=vec4(position.xy,0.,1.);
          gl_PointSize=flake.x*dpr;
          shape=vec4(flake.y*position.z,flake.zw,0.);
        }`,
      fragmentShader: `
        varying vec4 shape;
        float segment(vec2 p, vec2 a, vec2 b){
          vec2 v=b-a; return length(p-a-v*clamp(dot(p-a,v)/dot(v,v),0.,1.));
        }
        void main(){
          vec2 p=gl_PointCoord*2.-1.;
          float r=length(p);
          float a=1.-smoothstep(shape.y==2.?0.04:0.28,1.,r);
          if(shape.y>2.5){
            float ang=mod(atan(p.y,p.x)+shape.z+0.523599,1.047198)-0.523599;
            vec2 arm=vec2(cos(ang),abs(sin(ang)))*r;
            float d=min(segment(arm,vec2(0.),vec2(.95,0.)),segment(arm,vec2(.46,0.),vec2(.66,.22)));
            a=1.-smoothstep(.045,.15,d);
          }
          gl_FragColor=vec4(.97,.96,.90,a*shape.x);
        }`,
    });
    const points = new Points(geometry, material);
    points.frustumCulled = false;
    points.renderOrder = 2;
    scene.add(points);
    return {
      update(time) {
        const width = Math.max(1, canvas.clientWidth),
          height = Math.max(1, canvas.clientHeight);
        const bottom = height * 0.94,
          span = bottom + 18;
        const count = width < 480 ? 96 : 120;
        geometry.setDrawRange(0, count);
        for (let i = 0; i < count; i++) {
          const f = flakes[i];
          if (!f) continue;
          const y = ((f.y * span + time * f.speed) % span) - 12;
          const x = f.x * width + (Math.sin(f.phase + time * 0.37) * f.drift + 3 * Math.sin(time * 0.22));
          positions.setXYZ(
            i,
            (2 * x) / width - 1,
            1 - (2 * y) / height,
            Math.min(1, Math.max(0, (bottom - y) / 24)),
          );
        }
        positions.needsUpdate = true;
      },
      dispose() {
        disposeObject(points);
      },
    };
  };
}
