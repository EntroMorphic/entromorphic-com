import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { NOISE, PALETTE } from "../glsl.js";

// Iridescent palette shifts (deep-space). Index 3 is the site's look.
const SHIFTS = [
  { name: "Indigo / Teal", value: 0.0 },
  { name: "Violet bloom", value: 0.33 },
  { name: "Aurora", value: 0.66 },
  { name: "Magenta ice", value: 0.5 },
];

// Emissive point-field surrounding a noise-displaced morphing blob core,
// bled through an UnrealBloom pass and a vignette.
export function createBlobCore() {
  let renderer, scene, camera, composer, bloom, vignettePass, pts, ptsMat, blob, blobMat, blobGeo;
  let rot = 0;

  const params = {
    amplitude: { label: "Displacement", min: 0, max: 0.9, step: 0.01, value: 0.42, def: 0.42 },
    frequency: { label: "Noise scale", min: 0.4, max: 3.5, step: 0.01, value: 1.5, def: 1.5 },
    speed:     { label: "Flow speed", min: 0, max: 1.5, step: 0.01, value: 0.45, def: 0.45 },
    rim:       { label: "Rim glow", min: 0, max: 2.0, step: 0.01, value: 0.42, def: 0.42 },
    strength:  { label: "Bloom strength", min: 0, max: 2, step: 0.01, value: 0.3, def: 0.3 },
    radius:    { label: "Bloom radius", min: 0, max: 1.5, step: 0.01, value: 0.7, def: 0.7 },
    threshold: { label: "Threshold", min: 0, max: 1, step: 0.01, value: 1.0, def: 1.0 },
    vignette:  { label: "Vignette", min: 0, max: 1.5, step: 0.01, value: 0.73, def: 0.73 },
    spin:      { label: "Spin", min: 0, max: 1, step: 0.01, value: 0.0, def: 0.0 },
    shift:     { label: "Iridescence", type: "color", options: SHIFTS, value: 3 },
  };

  function init(ctx) {
    renderer = ctx.renderer;
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(50, ctx.width / ctx.height, 0.1, 100);
    camera.position.set(0, 0, 4.4);

    // fibonacci sphere of points (particle field)
    const N = Math.floor(9000 * ctx.quality);
    const pos = new Float32Array(N * 3);
    const seed = new Float32Array(N);
    const ga = Math.PI * (3 - Math.sqrt(5));
    for (let i = 0; i < N; i++) {
      const y = 1 - (i / (N - 1)) * 2;
      const r = Math.sqrt(1 - y * y);
      const th = ga * i;
      pos[i * 3] = Math.cos(th) * r * 1.5;
      pos[i * 3 + 1] = y * 1.5;
      pos[i * 3 + 2] = Math.sin(th) * r * 1.5;
      seed[i] = Math.random();
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    geo.setAttribute("aSeed", new THREE.BufferAttribute(seed, 1));
    ptsMat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { uTime: { value: 0 }, uShift: { value: SHIFTS[3].value } },
      vertexShader: /* glsl */`
        attribute float aSeed; varying float vS; uniform float uTime;
        void main(){
          vS = aSeed;
          vec3 p = position * (1.0 + 0.06 * sin(uTime * 1.5 + aSeed * 6.28));
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_PointSize = (1.0 + 2.0 * aSeed) * (9.0 / -mv.z);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: PALETTE + /* glsl */`
        precision highp float;
        varying float vS; uniform float uTime, uShift;
        void main(){
          vec2 uv = gl_PointCoord * 2.0 - 1.0;
          float r = dot(uv, uv); if (r > 1.0) discard;
          float a = smoothstep(1.0, 0.0, r);
          vec3 col = iridescent(vS * 0.7 + uTime * 0.04, uShift) * 1.1;
          gl_FragColor = vec4(col, a * 0.85);
        }`,
    });
    pts = new THREE.Points(geo, ptsMat);
    scene.add(pts);

    // morphing blob core (replaces the geometric wireframe)
    const detail = Math.max(12, Math.floor(64 * ctx.quality));
    blobGeo = new THREE.IcosahedronGeometry(0.9, detail);
    blobMat = new THREE.ShaderMaterial({
      extensions: { derivatives: true },
      uniforms: {
        uTime: { value: 0 },
        uAmp: { value: params.amplitude.value },
        uFreq: { value: params.frequency.value },
        uSpeed: { value: params.speed.value },
        uRim: { value: params.rim.value },
        uShift: { value: SHIFTS[3].value },
      },
      vertexShader: NOISE + /* glsl */`
        uniform float uTime, uAmp, uFreq, uSpeed;
        varying vec3 vPos; varying float vDisp;
        void main(){
          float n = fbm(normal * uFreq + uTime * uSpeed);
          float disp = n * uAmp;
          vec3 p = position + normal * disp;
          vDisp = n;
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          vPos = mv.xyz;
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: NOISE + PALETTE + /* glsl */`
        precision highp float;
        uniform float uTime, uRim, uShift;
        varying vec3 vPos; varying float vDisp;
        void main(){
          vec3 n = normalize(cross(dFdx(vPos), dFdy(vPos)));
          vec3 v = normalize(-vPos);
          float fres = pow(1.0 - max(dot(n, v), 0.0), 2.4);
          float t = vDisp * 0.55 + 0.5 + uTime * 0.02;
          vec3 base = iridescent(t, uShift);
          base = mix(base * 0.18, base, smoothstep(0.0, 0.55, fres + 0.22));
          base += iridescent(fres + uTime * 0.05, uShift) * uRim * fres;
          gl_FragColor = vec4(base, 1.0);
        }`,
    });
    blob = new THREE.Mesh(blobGeo, blobMat);
    scene.add(blob);

    composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    bloom = new UnrealBloomPass(new THREE.Vector2(ctx.width, ctx.height), 0.7, 0.7, 0.15);
    composer.addPass(bloom);

    vignettePass = new ShaderPass({
      uniforms: { tDiffuse: { value: null }, uAmt: { value: 0.8 } },
      vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy,0.0,1.0); }`,
      fragmentShader: /* glsl */`
        precision highp float; varying vec2 vUv; uniform sampler2D tDiffuse; uniform float uAmt;
        void main(){
          vec4 c = texture2D(tDiffuse, vUv);
          float d = length(vUv - 0.5) * 1.4;
          c.rgb *= smoothstep(1.1, 0.25, d * uAmt + (1.0 - uAmt) * 0.0);
          gl_FragColor = c;
        }`,
    });
    composer.addPass(vignettePass);
  }

  function resize(w, h) {
    camera.aspect = w / h; camera.updateProjectionMatrix();
    composer.setSize(w, h);
    bloom.setSize(w, h);
  }

  function update(t, dt, p) {
    ptsMat.uniforms.uTime.value = t;
    ptsMat.uniforms.uShift.value = SHIFTS[params.shift.value].value;

    blobMat.uniforms.uTime.value = t;
    blobMat.uniforms.uAmp.value = params.amplitude.value;
    blobMat.uniforms.uFreq.value = params.frequency.value;
    blobMat.uniforms.uSpeed.value = params.speed.value;
    blobMat.uniforms.uRim.value = params.rim.value;
    blobMat.uniforms.uShift.value = SHIFTS[params.shift.value].value;

    bloom.strength = params.strength.value;
    bloom.radius = params.radius.value;
    bloom.threshold = params.threshold.value;
    vignettePass.uniforms.uAmt.value = params.vignette.value;

    rot += dt * params.spin.value + p.vx * 0.4;
    pts.rotation.y = rot; pts.rotation.x = -p.ny * 0.4;
    blob.rotation.y = -rot * 0.7 + p.nx * 0.3; blob.rotation.x = p.ny * 0.4;
    const pulse = 1 + (p.down ? 0.06 : 0);
    blob.scale.setScalar(pulse + Math.sin(t * 0.6) * 0.015);
  }

  function render() {
    renderer.setRenderTarget(null);
    composer.render();
  }

  function dispose() {
    pts && pts.geometry.dispose(); ptsMat && ptsMat.dispose();
    blobGeo && blobGeo.dispose(); blobMat && blobMat.dispose();
    composer && composer.dispose();
  }

  return {
    id: "blobcore", label: "Blob Core", tag: "particle field · morphing blob · bloom",
    dpr: 1.0,
    desc: "A noise-displaced morphing blob at the heart of an emissive particle field, bled through UnrealBloom and a vignette. Drag to spin.",
    params, init, resize, update, render, dispose,
  };
}
