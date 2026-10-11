/* Three.js glass mascot: a local recreation of the Spline "AI assistant" orb.

   Two parts, matching the Spline scene:
     core   a glossy sphere with slow cyan / violet light flowing inside,
            a white lip at the rim, a blue caustic along the bottom edge
     shell  a thin, slightly larger film that wobbles organically, drawn
            back faces first so its edges show as layered iridescent rings

   Both use small custom shaders (no textures, no post-processing). The
   panel's state machine drives a handful of uniforms; voice level comes
   from the Mascot controller in mascot.js. Hover bends the shell toward
   the pointer and a click sends a ripple, like the original. */

import * as THREE from '../vendor/three.module.min.js';

const rgb = (hex) => new THREE.Vector3(
  ((hex >> 16) & 255) / 255, ((hex >> 8) & 255) / 255, (hex & 255) / 255);

const PALETTE = {
  sky: rgb(0x8fc3f1),       // body, lower right
  ice: rgb(0xd3ebfb),       // body, upper left
  lavender: rgb(0xc3c6f7),  // shell film
  violet: rgb(0xadb6f2),    // periwinkle pool
  deep: rgb(0x7fa9ec),      // rim outline, inner depth
  cyan: rgb(0xb2e6fb),      // shell film
};

// What each panel state does to the orb. Values ease toward these.
const TARGETS = {
  idle:      { wobble: 0.035, flow: 0.55, sat: 1.0,  glow: 0.0,  spin: 0.10, bob: 1.0 },
  listening: { wobble: 0.050, flow: 1.30, sat: 1.06, glow: 0.30, spin: 0.22, bob: 0.6 },
  thinking:  { wobble: 0.040, flow: 2.20, sat: 1.0,  glow: 0.15, spin: 0.40, bob: 0.8 },
  working:   { wobble: 0.055, flow: 1.60, sat: 1.0,  glow: 0.20, spin: 0.28, bob: 1.2 },
  confirm:   { wobble: 0.020, flow: 0.35, sat: 1.0,  glow: 0.10, spin: 0.05, bob: 0.5 },
  done:      { wobble: 0.030, flow: 0.50, sat: 1.06, glow: 0.35, spin: 0.10, bob: 0.8 },
  ask:       { wobble: 0.030, flow: 0.60, sat: 1.0,  glow: 0.10, spin: 0.10, bob: 0.8 },
  error:     { wobble: 0.020, flow: 0.30, sat: 0.55, glow: 0.0,  spin: 0.05, bob: 0.4 },
};

// Ashima / Stefan Gustavson 3D simplex noise (MIT).
const NOISE = /* glsl */`
vec3 mod289(vec3 x){return x-floor(x*(1./289.))*289.;}
vec4 mod289(vec4 x){return x-floor(x*(1./289.))*289.;}
vec4 permute(vec4 x){return mod289(((x*34.)+1.)*x);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-.85373472095314*r;}
float snoise(vec3 v){
  const vec2 C=vec2(1./6.,1./3.);const vec4 D=vec4(0.,.5,1.,2.);
  vec3 i=floor(v+dot(v,C.yyy));vec3 x0=v-i+dot(i,C.xxx);
  vec3 g=step(x0.yzx,x0.xyz);vec3 l=1.-g;vec3 i1=min(g.xyz,l.zxy);vec3 i2=max(g.xyz,l.zxy);
  vec3 x1=x0-i1+C.xxx;vec3 x2=x0-i2+C.yyy;vec3 x3=x0-D.yyy;
  i=mod289(i);
  vec4 p=permute(permute(permute(i.z+vec4(0.,i1.z,i2.z,1.))+i.y+vec4(0.,i1.y,i2.y,1.))+i.x+vec4(0.,i1.x,i2.x,1.));
  float n_=.142857142857;vec3 ns=n_*D.wyz-D.xzx;
  vec4 j=p-49.*floor(p*ns.z*ns.z);vec4 x_=floor(j*ns.z);vec4 y_=floor(j-7.*x_);
  vec4 x=x_*ns.x+ns.yyyy;vec4 y=y_*ns.x+ns.yyyy;vec4 h=1.-abs(x)-abs(y);
  vec4 b0=vec4(x.xy,y.xy);vec4 b1=vec4(x.zw,y.zw);
  vec4 s0=floor(b0)*2.+1.;vec4 s1=floor(b1)*2.+1.;vec4 sh=-step(h,vec4(0.));
  vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy;vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
  vec3 p0=vec3(a0.xy,h.x);vec3 p1=vec3(a0.zw,h.y);vec3 p2=vec3(a1.xy,h.z);vec3 p3=vec3(a1.zw,h.w);
  vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
  p0*=norm.x;p1*=norm.y;p2*=norm.z;p3*=norm.w;
  vec4 m=max(.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.);m=m*m;
  return 42.*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
}`;

const CORE_VERT = /* glsl */`
varying vec3 vNormal; varying vec3 vViewPos; varying vec3 vObj;
void main(){
  vObj = normalize(position);
  vNormal = normalize(normalMatrix * normal);
  vec4 mv = modelViewMatrix * vec4(position, 1.);
  vViewPos = mv.xyz;
  gl_Position = projectionMatrix * mv;
}`;

const CORE_FRAG = /* glsl */`
uniform vec3 uSky, uIce, uLav, uViolet, uDeep;
uniform float uFlowTime, uSat, uGlow;
varying vec3 vNormal; varying vec3 vViewPos; varying vec3 vObj;
${NOISE}
void main(){
  vec3 n = normalize(vNormal);
  vec3 v = normalize(-vViewPos);
  float fres = 1. - max(dot(n, v), 0.);
  float t = uFlowTime;
  vec3 p = vObj;

  // slow, low-frequency drift so colors melt into each other
  float a = snoise(p * .6 + vec3(0., -t * .22, t * .12));
  float b = snoise(p * .75 + vec3(t * .16, t * .06, 0.) + 7.3);

  // pastel base: pale ice toward the upper left, soft sky toward the lower right
  float lightSide = dot(n, normalize(vec3(-.5, .75, .35)));
  vec3 col = mix(uSky, uIce, smoothstep(-.6, 1.1, lightSide + .25 * a));
  // periwinkle pooling in the lower right, cyan wandering through the middle
  float lowRight = dot(n, normalize(vec3(.45, -.65, .35)));
  col = mix(col, uViolet, smoothstep(-.1, .9, lowRight + .35 * b) * .6);
  col = mix(col, uDeep, smoothstep(.35, 1., a) * .25);

  // soft "window" reflections: faint planes with gentle edges, like the Spline glass
  vec3 r = reflect(-v, n);
  float w1 = smoothstep(-.04, .04, r.y - .18 + .25 * r.x) * smoothstep(.04, -.04, r.x - .25);
  float w2 = smoothstep(-.05, .05, r.x + .35 * r.y - .45);
  float w3 = smoothstep(-.05, .05, -r.y - .35 + .2 * r.x);
  col += vec3(1.) * w1 * .055 + vec3(.9, .96, 1.) * w2 * .04 - vec3(.04, .03, 0.) * w3 * .6;
  col += pow(max(dot(r, normalize(vec3(-.35, .55, .75))), 0.), 6.) * .08;

  // rim: lighter glass lip, then a thin blue outline right at the edge
  col = mix(col, vec3(.9, .95, 1.), smoothstep(.72, .93, fres) * .3);
  col = mix(col, uDeep, smoothstep(.955, 1., fres) * .5);

  float l = dot(col, vec3(.299, .587, .114));
  col = mix(vec3(l), col, uSat * .9);
  col += uGlow * .12 * vec3(.8, .92, 1.);
  gl_FragColor = vec4(col, 1.);
}`;

const SHELL_VERT = /* glsl */`
uniform float uTime, uWobble, uHover, uClick, uRadius, uSeed;
uniform vec3 uPointer;
varying vec3 vNormal; varying vec3 vViewPos; varying vec3 vObj;
${NOISE}
float disp(vec3 p){
  float n = snoise(p * 1.25 + vec3(uSeed, uTime * .22, uTime * .17)) * .65
          + snoise(p * 2.5 - vec3(uTime * .3, uSeed, 0.)) * .25;
  float d = distance(p, uPointer);
  float hover = uHover * exp(-d * d * 2.5) * (.55 + .45 * sin(d * 10. - uTime * 5.));
  float click = uClick * sin(d * 8. - (1. - uClick) * 14.) * exp(-d * 1.2);
  return n * uWobble + hover * .085 + click * .07;
}
void main(){
  vec3 p = normalize(position);
  vec3 tg = normalize(cross(p, abs(p.y) < .99 ? vec3(0., 1., 0.) : vec3(1., 0., 0.)));
  vec3 bt = cross(p, tg);
  float e = .015;
  vec3 p0 = p * (uRadius + disp(p));
  vec3 q1 = normalize(p + tg * e); vec3 p1 = q1 * (uRadius + disp(q1));
  vec3 q2 = normalize(p + bt * e); vec3 p2 = q2 * (uRadius + disp(q2));
  vec3 nrm = normalize(cross(p1 - p0, p2 - p0));
  if (dot(nrm, p) < 0.) nrm = -nrm;
  vObj = p;
  vNormal = normalize(normalMatrix * nrm);
  vec4 mv = modelViewMatrix * vec4(p0, 1.);
  vViewPos = mv.xyz;
  gl_Position = projectionMatrix * mv;
}`;

const SHELL_FRAG = /* glsl */`
uniform vec3 uIce, uLav, uCyan;
uniform float uTime, uAlpha, uSat;
varying vec3 vNormal; varying vec3 vViewPos; varying vec3 vObj;
void main(){
  vec3 n = normalize(vNormal);
  if (!gl_FrontFacing) n = -n;
  vec3 v = normalize(-vViewPos);
  float fres = pow(1. - abs(dot(n, v)), 2.1);

  // thin-film tint: hue walks between ice, lavender and cyan along the edge
  float ph = fres * 1.6 + vObj.y * .35 + uTime * .04;
  vec3 film = mix(uIce, uLav, .5 + .5 * cos(6.2832 * ph));
  film = mix(film, uCyan, (.5 + .5 * cos(6.2832 * (ph + .33))) * .5);
  film = mix(film, vec3(1.), .12);

  vec3 r = reflect(-v, n);
  float spec = pow(max(dot(r, normalize(vec3(-.4, .6, .7))), 0.), 40.);
  float edge = smoothstep(.5, 1., fres);
  float alpha = .03 + edge * .45 + pow(fres, 6.) * .3 + spec * .2;
  alpha *= gl_FrontFacing ? 1. : .55;

  vec3 col = film + spec * .6;
  float l = dot(col, vec3(.299, .587, .114));
  col = mix(vec3(l), col, uSat);
  gl_FragColor = vec4(col, alpha * uAlpha);
}`;

/**
 * Mount the orb into `host` (the .mascot element), driven by `controller`
 * (the Mascot instance from mascot.js). Returns { dispose, stats } or
 * throws if WebGL is unavailable.
 */
export function createGlassMascot(host, controller) {
  const t0 = performance.now();
  const canvas = document.createElement('canvas');
  canvas.className = 'mascot__gl';
  canvas.setAttribute('aria-hidden', 'true');

  const renderer = new THREE.WebGLRenderer({
    canvas, alpha: true, antialias: true, powerPreference: 'low-power',
    preserveDrawingBuffer: false,
  });
  renderer.setClearColor(0x000000, 0);
  host.prepend(canvas);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
  camera.position.set(0, 0, 6.3);

  const orb = new THREE.Group();
  scene.add(orb);

  const shared = {
    uSky: { value: PALETTE.sky }, uIce: { value: PALETTE.ice }, uLav: { value: PALETTE.lavender },
    uViolet: { value: PALETTE.violet }, uDeep: { value: PALETTE.deep }, uCyan: { value: PALETTE.cyan },
    uTime: { value: 0 }, uFlowTime: { value: 0 }, uSat: { value: 1 }, uGlow: { value: 0 },
    uWobble: { value: 0.035 }, uHover: { value: 0 }, uClick: { value: 0 },
    uPointer: { value: new THREE.Vector3(0, 0, 1) },
  };

  const core = new THREE.Mesh(
    new THREE.SphereGeometry(1, 64, 48),
    new THREE.ShaderMaterial({ uniforms: shared, vertexShader: CORE_VERT, fragmentShader: CORE_FRAG }),
  );
  core.renderOrder = 0;
  orb.add(core);

  const shellGeo = new THREE.IcosahedronGeometry(1, 28);
  const makeShell = (side, order, radius, seed, alpha) => {
    const m = new THREE.Mesh(shellGeo, new THREE.ShaderMaterial({
      uniforms: { ...shared, uRadius: { value: radius }, uSeed: { value: seed }, uAlpha: { value: alpha } },
      vertexShader: SHELL_VERT, fragmentShader: SHELL_FRAG,
      transparent: true, depthWrite: false, side,
    }));
    m.renderOrder = order;
    orb.add(m);
    return m;
  };
  // Back faces first, then front: the two edges read as layered film.
  makeShell(THREE.BackSide, 1, 1.19, 0.0, 1.0);
  makeShell(THREE.FrontSide, 2, 1.19, 0.0, 1.0);
  makeShell(THREE.FrontSide, 3, 1.23, 3.7, 0.45);

  /* ---------- sizing ---------- */
  let dpr = Math.min(window.devicePixelRatio || 1, 2);
  function resize() {
    const w = host.clientWidth, h = host.clientHeight;
    if (!w || !h) return;
    renderer.setPixelRatio(dpr);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    // keep the orb a constant share of the box height
    camera.updateProjectionMatrix();
    if (!running) renderOnce();
  }
  const ro = new ResizeObserver(resize);
  ro.observe(host);

  /* ---------- pointer: hover bend + click ripple ---------- */
  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const hitSphere = new THREE.Sphere(new THREE.Vector3(), 1.2);
  const hit = new THREE.Vector3();
  const inv = new THREE.Matrix4();
  let hoverTarget = 0;
  function onMove(e) {
    const r = canvas.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    hitSphere.center.setFromMatrixPosition(orb.matrixWorld);
    if (ray.ray.intersectSphere(hitSphere, hit)) {
      inv.copy(orb.matrixWorld).invert();
      shared.uPointer.value.copy(hit.applyMatrix4(inv).normalize());
      hoverTarget = 1;
    } else {
      hoverTarget = 0;
    }
  }
  const onLeave = () => { hoverTarget = 0; };
  const onDown = () => { if (hoverTarget) shared.uClick.value = 1; };
  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerleave', onLeave);
  canvas.addEventListener('pointerdown', onDown);

  /* ---------- animation ---------- */
  const cur = { ...TARGETS.idle };
  let running = false;
  let raf = 0;
  let last = performance.now();
  let clock = 0;
  let donePulse = 0;
  let visible = true;
  const frameTimes = [];
  const stats = { renderer: 'three', loadMs: 0, fps: 0, dpr, drawCalls: 0, triangles: 0 };

  function step(dt) {
    const target = TARGETS[controller.state] || TARGETS.idle;
    const k = 1 - Math.exp(-dt * 3); // ~0.3s ease
    for (const key in cur) cur[key] += (target[key] - cur[key]) * k;

    const lvl = controller.reduced ? 0 : controller.level;
    clock += dt;
    shared.uTime.value += dt * (0.8 + lvl * 1.5);
    // Voice: the film ripples harder, inner light flows faster and brightens.
    shared.uFlowTime.value += dt * (cur.flow + lvl * 1.8);
    shared.uWobble.value = cur.wobble + lvl * 0.07;
    shared.uSat.value = cur.sat;
    donePulse = Math.max(0, donePulse - dt * 0.8);
    shared.uGlow.value = cur.glow + donePulse * 0.6 + lvl * 0.45;
    shared.uHover.value += (hoverTarget - shared.uHover.value) * (1 - Math.exp(-dt * 6));
    shared.uClick.value = Math.max(0, shared.uClick.value - dt * 0.9);

    orb.position.y = Math.sin(clock * 0.9) * 0.05 * cur.bob;
    orb.rotation.y += dt * cur.spin;
    orb.rotation.z = Math.sin(clock * 0.45) * 0.05;
    orb.scale.setScalar(1 + lvl * 0.06 + donePulse * 0.03);
  }

  function renderOnce() {
    renderer.render(scene, camera);
    stats.drawCalls = renderer.info.render.calls;
    stats.triangles = renderer.info.render.triangles;
  }

  function loop(now) {
    raf = requestAnimationFrame(loop);
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    step(dt);
    renderOnce();

    // Rolling FPS, and one step down in resolution if frames run slow.
    frameTimes.push(dt);
    if (frameTimes.length > 90) {
      const avg = frameTimes.reduce((s, x) => s + x, 0) / frameTimes.length;
      stats.fps = Math.round(1 / avg);
      frameTimes.length = 0;
      if (avg > 1 / 40 && dpr > 1) { dpr = 1; stats.dpr = dpr; resize(); }
    }
  }

  function start() {
    if (running || paused() || !visible) return;
    running = true;
    last = performance.now();
    raf = requestAnimationFrame(loop);
  }
  function stop() {
    running = false;
    cancelAnimationFrame(raf);
  }

  // Reduced motion: no loop. Jump to the state's look and draw one frame.
  function settle() {
    const target = TARGETS[controller.state] || TARGETS.idle;
    Object.assign(cur, target);
    step(0);
    renderOnce();
  }

  let lastState = controller.state;
  const unsub = controller.subscribe(() => {
    if (controller.state === 'done' && lastState !== 'done') donePulse = 1;
    lastState = controller.state;
    if (paused()) { stop(); settle(); } else start();
  });
  // Still frame when motion is reduced or the agent is switched off.
  function paused() { return controller.reduced || document.body.dataset.power === 'off'; }

  // Pause when the panel is hidden or the orb is scrolled away.
  const io = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    if (visible) start(); else stop();
  });
  io.observe(host);
  const onVis = () => (document.hidden ? stop() : start());
  document.addEventListener('visibilitychange', onVis);

  resize();
  if (paused()) settle(); else { step(0); renderOnce(); start(); }
  stats.loadMs = Math.round(performance.now() - t0);

  return {
    stats,
    dispose() {
      stop();
      unsub();
      ro.disconnect();
      io.disconnect();
      document.removeEventListener('visibilitychange', onVis);
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerleave', onLeave);
      canvas.removeEventListener('pointerdown', onDown);
      scene.traverse((o) => { o.geometry?.dispose?.(); o.material?.dispose?.(); });
      renderer.dispose();
      renderer.forceContextLoss();
      canvas.remove();
    },
  };
}
