import { useEffect, useRef, useState, useCallback } from 'react';

export default function App() {
  const [entered, setEntered] = useState(false);
  const [muted, setMuted] = useState(false);
  const [windPower, setWindPower] = useState(0.45);
  const [windRead, setWindRead] = useState('breeze');
  const [needleAngle, setNeedleAngle] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const simRef = useRef<any>(null);

  const doGust = useCallback(() => {
    if (simRef.current) {
      simRef.current.gustEnv = 1;
      simRef.current.Sound.whoosh(1);
      const W = simRef.current.W;
      const H = simRef.current.H;
      for (let i = 0; i < 40; i++) {
        simRef.current.streaks.push({
          x: Math.random() * -60,
          y: Math.random() * H * 0.95,
          px: -60, py: 0,
          life: 1 + Math.random() * 2,
          sp: 0
        });
      }
    }
  }, []);

  const shedPetals = useCallback(() => {
    if (!simRef.current) return;
    const { flowers, spawnPetal, Sound, rand } = simRef.current;
    const rs = flowers.filter((f: any) => f.type === 'rose');
    for (const f of rs) {
      const n = Math.min(f === rs[0] ? 3 : 2, 3);
      for (let i = 0; i < n; i++) {
        spawnPetal(f.headX, f.headY, { hue: f.hue, vx: rand(-50, 50), vy: rand(-90, -20) });
      }
    }
    [0, 1, 2].forEach(i => setTimeout(() => Sound.chime(), i * 130));
  }, []);

  const releaseSeedsBtn = useCallback(() => {
    if (!simRef.current) return;
    const { flowers, releaseSeeds, Sound } = simRef.current;
    const ds = flowers.filter((f: any) => f.type === 'dand');
    for (const f of ds) releaseSeeds(f, 6 + (Math.random() * 5 | 0));
    Sound.chime();
  }, []);

  const toggleMute = useCallback(() => {
    if (!simRef.current) return;
    const m = simRef.current.Sound.toggleMute();
    setMuted(m);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;

    // ============ SIMULATION STATE ============
    const TAU = Math.PI * 2;
    const clamp = (v: number, a: number, b: number) => v < a ? a : v > b ? b : v;
    const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
    const rand = (a = 1, b?: number) => b === undefined ? Math.random() * a : a + Math.random() * (b - a);

    function mulberry32(a: number) {
      return function () {
        a |= 0; a = a + 0x6D2B79F5 | 0;
        let t = Math.imul(a ^ a >>> 15, 1 | a);
        t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
      };
    }

    // Simplex noise
    const GRAD3 = [[1,1,0],[-1,1,0],[1,-1,0],[-1,-1,0],[1,0,1],[-1,0,1],[1,0,-1],[-1,0,-1],[0,1,1],[0,-1,1],[0,1,-1],[0,-1,-1]];
    class Simplex {
      p: Uint8Array; perm: Uint8Array; pm12: Uint8Array;
      constructor(seed: number) {
        const r = mulberry32(seed >>> 0);
        this.p = new Uint8Array(256);
        for (let i = 0; i < 256; i++) this.p[i] = i;
        for (let i = 255; i > 0; i--) { const j = (r() * (i + 1)) | 0; const t = this.p[i]; this.p[i] = this.p[j]; this.p[j] = t; }
        this.perm = new Uint8Array(512); this.pm12 = new Uint8Array(512);
        for (let i = 0; i < 512; i++) { this.perm[i] = this.p[i & 255]; this.pm12[i] = this.perm[i] % 12; }
      }
      n3(xin: number, yin: number, zin: number) {
        const F3 = 1/3, G3 = 1/6, p = this.perm, pm = this.pm12;
        const s = (xin + yin + zin) * F3;
        const i = Math.floor(xin + s), j = Math.floor(yin + s), k = Math.floor(zin + s);
        const t = (i + j + k) * G3;
        const x0 = xin - i + t, y0 = yin - j + t, z0 = zin - k + t;
        let i1: number, j1: number, k1: number, i2: number, j2: number, k2: number;
        if (x0 >= y0) {
          if (y0 >= z0) { i1=1;j1=0;k1=0;i2=1;j2=1;k2=0; }
          else if (x0 >= z0) { i1=1;j1=0;k1=0;i2=1;j2=0;k2=1; }
          else { i1=0;j1=0;k1=1;i2=1;j2=0;k2=1; }
        } else {
          if (y0 < z0) { i1=0;j1=0;k1=1;i2=0;j2=1;k2=1; }
          else if (x0 < z0) { i1=0;j1=1;k1=0;i2=0;j2=1;k2=1; }
          else { i1=0;j1=1;k1=0;i2=1;j2=1;k2=0; }
        }
        const x1=x0-i1+G3,y1=y0-j1+G3,z1=z0-k1+G3;
        const x2=x0-i2+2*G3,y2=y0-j2+2*G3,z2=z0-k2+2*G3;
        const x3=x0-1+3*G3,y3=y0-1+3*G3,z3=z0-1+3*G3;
        const ii=i&255,jj=j&255,kk=k&255;
        let n=0;
        let t0=.6-x0*x0-y0*y0-z0*z0;
        if(t0>0){const g=GRAD3[pm[ii+p[jj+p[kk]]]];n+=t0*t0*t0*t0*(g[0]*x0+g[1]*y0+g[2]*z0);}
        let t1=.6-x1*x1-y1*y1-z1*z1;
        if(t1>0){const g=GRAD3[pm[ii+i1+p[jj+j1+p[kk+k1]]]];n+=t1*t1*t1*t1*(g[0]*x1+g[1]*y1+g[2]*z1);}
        let t2=.6-x2*x2-y2*y2-z2*z2;
        if(t2>0){const g=GRAD3[pm[ii+i2+p[jj+j2+p[kk+k2]]]];n+=t2*t2*t2*t2*(g[0]*x2+g[1]*y2+g[2]*z2);}
        let t3=.6-x3*x3-y3*y3-z3*z3;
        if(t3>0){const g=GRAD3[pm[ii+1+p[jj+1+p[kk+1]]]];n+=t3*t3*t3*t3*(g[0]*x3+g[1]*y3+g[2]*z3);}
        return 32*n;
      }
    }
    const noise = new Simplex(20261101);

    // World state
    let W = innerWidth, H = innerHeight;
    let simTime = 0, gustEnv = 0, avgWind = 40;
    let currentWindPower = 0.45;
    const petals: any[] = [], seeds: any[] = [], pollen: any[] = [], streaks: any[] = [];
    const fireflies: any[] = [], ripples: any[] = [], gusts: any[] = [], clouds: any[] = [], stars: any[] = [];
    let flowers: any[] = [], grass: any[] = [], gndPts: any[] = [], hill1: any[] = [], hill2: any[] = [];
    let colWX: Float32Array, colWY: Float32Array, COLS = 0;
    let skyGrad: CanvasGradient, groundGrad: CanvasGradient, vign: CanvasGradient;

    function groundY(x: number) {
      return H * 0.80 + noise.n3(x * 0.0021, 7.7, 0) * H * 0.035 + noise.n3(x * 0.009, 3.1, 0) * H * 0.012;
    }

    function makeFlower(x: number, type: string) {
      const y = groundY(x), h = type === 'dand' ? rand(50, 90) : rand(60, 120);
      return {
        x, y, h, type, phase: rand(TAU), sway: 0, swayV: 0,
        hue: type === 'rose' ? rand(325, 355) : (type === 'bell' ? rand(258, 300) : 0),
        lit: rand(70, 82), seedsN: 36, regrow: 0, cd: 0, glow: 0,
        headX: x, headY: y - h
      };
    }

    function newStreak() {
      const x = rand(W), y = rand(H * 0.95);
      return { x, y, px: x, py: y, life: rand(1.5, 4.5), sp: 0 };
    }

    function buildWorld() {
      grass = []; flowers = []; stars.length = 0; clouds.length = 0; fireflies.length = 0;
      for (let x = -10; x < W + 10; x += rand(5, 9))
        grass.push({ x, y: groundY(x), h: rand(14, 44), w: rand(1, 2.4), ph: rand(TAU), hue: rand(95, 150), lite: rand(18, 34), head: Math.random() < 0.18 });
      const n = Math.max(6, Math.round(W / 150));
      const seq = ['rose', 'dand', 'bell'];
      while (seq.length < n) { const r = Math.random(); seq.push(r < 0.38 ? 'rose' : r < 0.7 ? 'dand' : 'bell'); }
      seq.sort(() => Math.random() - 0.5);
      for (let i = 0; i < n; i++) {
        const x = (i + rand(0.2, 0.8)) * (W / n);
        flowers.push(makeFlower(x, seq[i]));
      }
      for (let i = 0; i < 90; i++) stars.push({ x: rand(W), y: rand(H * 0.5), r: rand(0.4, 1.4), ph: rand(TAU), sp: rand(0.3, 1.2) });
      for (let i = 0; i < 4; i++) clouds.push({ x: rand(W), y: rand(H * 0.08, H * 0.35), s: rand(90, 220), v: rand(2, 6), a: rand(0.05, 0.11) });
      for (let i = 0; i < 10; i++) fireflies.push({ x: rand(W), y: 0, ph: rand(TAU), sp: rand(0.4, 1) });
      for (const f of fireflies) f.y = groundY(f.x) - rand(20, 120);
      gndPts = []; for (let x = -30; x <= W + 30; x += 22) gndPts.push({ x, y: groundY(x) });
      hill1 = []; for (let x = -30; x <= W + 30; x += 30) hill1.push({ x, y: H * 0.62 + noise.n3(x * 0.0011 + 3, 0.5, 0) * H * 0.055 });
      hill2 = []; for (let x = -30; x <= W + 30; x += 30) hill2.push({ x, y: H * 0.70 + noise.n3(x * 0.0014 + 11, 2.5, 0) * H * 0.05 });
      COLS = Math.ceil(W / 26) + 3;
      colWX = new Float32Array(COLS); colWY = new Float32Array(COLS);
      skyGrad = ctx.createLinearGradient(0, 0, 0, H);
      skyGrad.addColorStop(0, '#171038'); skyGrad.addColorStop(0.42, '#45285f');
      skyGrad.addColorStop(0.66, '#a34e68'); skyGrad.addColorStop(0.8, '#e8915e'); skyGrad.addColorStop(1, '#f7b877');
      groundGrad = ctx.createLinearGradient(0, H * 0.72, 0, H);
      groundGrad.addColorStop(0, '#1a2a20'); groundGrad.addColorStop(1, '#050807');
      vign = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.75);
      vign.addColorStop(0, 'rgba(0,0,0,0)'); vign.addColorStop(1, 'rgba(6,3,12,0.55)');
      if (streaks.length === 0) for (let i = 0; i < 130; i++) streaks.push(newStreak());
    }

    function resize() {
      W = innerWidth; H = innerHeight;
      const dpr = Math.min(devicePixelRatio || 1, 2);
      if (!canvas) return;
      canvas.width = W * dpr; canvas.height = H * dpr;
      canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      buildWorld();
    }

    // Wind field
    const _w = { x: 0, y: 0 };
    function windAt(x: number, y: number, out: { x: number; y: number }) {
      const s = 0.0015, tt = simTime * 0.14, amp = 34 + 46 * currentWindPower;
      let wx = noise.n3(x * s, y * s * 1.3, tt) * amp;
      let wy = noise.n3(x * s + 41.3, y * s * 1.3 + 17.9, tt + 9.2) * amp * 0.45;
      const dirAmp = (22 + 120 * currentWindPower) * (1 + gustEnv * 1.5);
      const ang = 0.16 * Math.sin(simTime * 0.05) + 0.10 * Math.sin(simTime * 0.021 + 2);
      wx += Math.cos(ang) * dirAmp; wy += Math.sin(ang) * dirAmp * 0.22;
      wx += gustEnv * noise.n3(x * 0.004, y * 0.004, simTime * 0.5) * 70;
      wy -= Math.max(0, Math.sin(x * 0.004 + simTime * 0.1)) * (8 + 26 * currentWindPower);
      out.x = wx; out.y = wy; return out;
    }
    function fillCols() { for (let i = 0; i < COLS; i++) { windAt(i * 26 - 13, H * 0.8, _w); colWX[i] = _w.x; colWY[i] = _w.y; } }

    // Spawning
    function spawnPetal(x: number, y: number, o: any = {}) {
      if (petals.length > 110) petals.shift();
      petals.push({
        x, y, vx: o.vx !== undefined ? o.vx : rand(-20, 20), vy: o.vy !== undefined ? o.vy : rand(-10, 30),
        a: rand(TAU), w: rand(-3, 3), fl: rand(TAU), size: rand(7, 12),
        hue: (o.hue !== undefined ? o.hue : rand(322, 355)) + rand(-8, 8), sat: rand(55, 80), lit: rand(72, 86),
        age: 0, life: rand(22, 34), cn: rand(0.035, 0.055), chir: rand(-1.1, 1.1), landed: false, landT: 0
      });
    }
    function spawnSeed(x: number, y: number) {
      if (seeds.length > 90) seeds.shift();
      seeds.push({ x: x + rand(-5, 5), y: y + rand(-5, 5), vx: rand(-18, 18), vy: rand(-30, -6), a: rand(TAU), w: rand(-0.6, 0.6), age: 0, life: rand(18, 30), s: rand(0.8, 1.25), rest: false, restT: 0 });
    }
    function spawnPollen(x: number, y: number, n: number, spd = 30) {
      for (let i = 0; i < n; i++) {
        if (pollen.length > 300) pollen.shift();
        pollen.push({ x: x + rand(-4, 4), y: y + rand(-4, 4), vx: rand(-spd, spd) * 0.4, vy: rand(-spd, spd) * 0.4 - 10, age: 0, life: rand(4, 9), r: rand(0.8, 1.9), tw: rand(TAU) });
      }
    }
    function releaseSeeds(f: any, n: number) {
      for (let i = 0; i < n && f.seedsN > 0; i++) { spawnSeed(f.headX, f.headY); f.seedsN--; }
      f.swayV += rand(1, 2.5);
    }
    function burstFlower(f: any) {
      f.swayV += rand(3, 5) * (Math.random() < 0.5 ? -1 : 1); f.glow = 1;
      if (f.type === 'rose') { const n = 4 + (Math.random() * 3 | 0); for (let i = 0; i < n; i++) spawnPetal(f.headX + rand(-6, 6), f.headY + rand(-6, 6), { hue: f.hue, vx: rand(-70, 70), vy: rand(-100, -20) }); }
      else if (f.type === 'dand') { releaseSeeds(f, 10 + (Math.random() * 7 | 0)); }
      else { spawnPollen(f.headX, f.headY, 26, 46); }
    }

    // Pointer
    const pointer = { x: -9999, y: -9999, vx: 0, vy: 0, down: false, inside: false, lt: 0 };
    function onPointerMove(e: PointerEvent) {
      const nt = performance.now(), dtm = Math.max(8, nt - pointer.lt);
      if (pointer.inside) {
        pointer.vx = lerp(pointer.vx, clamp((e.clientX - pointer.x) / dtm * 1000, -1500, 1500), 0.35);
        pointer.vy = lerp(pointer.vy, clamp((e.clientY - pointer.y) / dtm * 1000, -1500, 1500), 0.35);
      }
      pointer.x = e.clientX; pointer.y = e.clientY; pointer.lt = nt; pointer.inside = true;
    }
    function onPointerUp() { pointer.down = false; }
    function onPointerLeave() { pointer.inside = false; pointer.down = false; }
    function onPointerDown(e: PointerEvent) {
      pointer.x = e.clientX; pointer.y = e.clientY; pointer.down = true; pointer.inside = true;
      let hit = null;
      for (const f of flowers) {
        const dx = e.clientX - f.headX, dy = e.clientY - f.headY;
        if (dx * dx + dy * dy < 34 * 34) { hit = f; break; }
      }
      if (hit) { burstFlower(hit); Sound.chime(); Sound.rustle(); }
      else { gusts.push({ x: e.clientX, y: e.clientY, t: 0 }); ripples.push({ x: e.clientX, y: e.clientY, r: 6, a: 0.5 }); Sound.pluckSoft(); }
    }

    function pointerForce(p: any, dt: number) {
      if (!pointer.inside) return;
      const dx = p.x - pointer.x, dy = p.y - pointer.y, d2 = dx * dx + dy * dy, R = 170;
      if (d2 > R * R) return;
      const d = Math.sqrt(d2) || 1, f = 1 - d / R;
      p.vx += pointer.vx * f * Math.min(1, dt * 7);
      p.vy += pointer.vy * f * Math.min(1, dt * 7);
      if (pointer.down) {
        const A = 170, B = 260;
        p.vx += ((-dy / d) * B - (dx / d) * A) * f * dt;
        p.vy += ((dx / d) * B - (dy / d) * A) * f * dt;
      }
    }
    function gustForce(p: any, dt: number) {
      for (const g of gusts) {
        const dx = p.x - g.x, dy = p.y - g.y, d = Math.hypot(dx, dy);
        if (d < 170 && d > 0.5) { const f = (1 - d / 170) * (1 - g.t / 0.45) * 640 * dt; p.vx += dx / d * f; p.vy += dy / d * f; }
      }
    }

    // Updates
    function updateFlowers(dt: number) {
      for (const f of flowers) {
        windAt(f.headX || f.x, f.y - f.h, _w);
        let target = clamp(_w.x * 0.0045, -0.9, 0.9);
        if (pointer.inside) {
          const dx = f.headX - pointer.x, dy = f.headY - pointer.y, d2 = dx * dx + dy * dy;
          if (d2 < 140 * 140) target += clamp(pointer.vx * 0.0012, -0.5, 0.5) * (1 - Math.sqrt(d2) / 140);
        }
        f.swayV += ((target - f.sway) * 20 - f.swayV * 5) * dt;
        f.sway += f.swayV * dt;
        f.glow *= Math.max(0, 1 - 2.4 * dt);
        f.cd -= dt;
        const bend = f.sway * f.h * 0.9 + Math.sin(simTime * 1.3 + f.phase) * 2 * (0.3 + currentWindPower);
        f.headX = f.x + bend;
        f.headY = f.y - f.h + Math.abs(f.sway) * f.h * 0.08;
        const sp = Math.hypot(_w.x, _w.y);
        if (f.type === 'rose' && sp > 120 && f.cd <= 0 && Math.random() < dt * 0.15 * (sp / 150)) {
          spawnPetal(f.headX, f.headY, { hue: f.hue, vx: rand(-30, 30), vy: rand(-40, 0) });
          f.cd = rand(2, 5); Sound.pluckSoft();
        } else if (f.type === 'dand') {
          if (sp > 170 && f.seedsN > 0 && Math.random() < dt * 0.05) releaseSeeds(f, 1);
          if (f.seedsN < 36) { f.regrow += dt; if (f.regrow > 1.2) { f.seedsN++; f.regrow = 0; } }
        } else if (f.type === 'bell' && sp > 60 && Math.random() < dt * (0.5 + currentWindPower * 1.5)) {
          spawnPollen(f.headX, f.headY, 1, 12);
        }
      }
    }
    function updatePetals(dt: number) {
      for (let i = petals.length - 1; i >= 0; i--) {
        const p = petals[i]; p.age += dt;
        if (p.age > p.life || p.x < -80 || p.x > W + 80 || p.y < -220) { petals.splice(i, 1); continue; }
        if (p.landed) {
          p.landT += dt;
          if (p.landT > 5) { petals.splice(i, 1); continue; }
          windAt(p.x, p.y, _w);
          if (Math.hypot(_w.x, _w.y) > 170 && Math.random() < dt * 1.2) { p.landed = false; p.vy = -40 - Math.random() * 30; p.vx = _w.x * 0.4; p.w = rand(-4, 4); }
          continue;
        }
        windAt(p.x, p.y, _w);
        const relx = _w.x - p.vx, rely = _w.y - p.vy;
        const nx = Math.sin(p.a), ny = -Math.cos(p.a), tx = Math.cos(p.a), ty = Math.sin(p.a);
        const vn = relx * nx + rely * ny, vt = relx * tx + rely * ty;
        const ax = p.cn * vn * Math.abs(vn) * nx + 0.006 * vt * Math.abs(vt) * tx;
        const ay = 150 + p.cn * vn * Math.abs(vn) * ny + 0.006 * vt * Math.abs(vt) * ty;
        p.w += (0.0022 * vn * vt - p.w * 1.5 + p.chir) * dt + (Math.random() - 0.5) * 3 * dt;
        p.w = clamp(p.w, -10, 10);
        p.vx += ax * dt; p.vy += ay * dt;
        pointerForce(p, dt); gustForce(p, dt);
        const sp = Math.hypot(p.vx, p.vy);
        if (sp > 460) { p.vx *= 460 / sp; p.vy *= 460 / sp; }
        p.x += p.vx * dt; p.y += p.vy * dt; p.a += p.w * dt; p.fl += p.w * 1.6 * dt;
        const gy = groundY(p.x);
        if (p.y > gy - 3) { p.y = gy - 3; p.landed = true; p.landT = 0; p.vx = 0; p.vy = 0; p.w = 0; }
      }
    }
    function updateSeeds(dt: number) {
      for (let i = seeds.length - 1; i >= 0; i--) {
        const s = seeds[i]; s.age += dt;
        if (s.age > s.life || s.x < -80 || s.x > W + 80 || s.y < -120) { seeds.splice(i, 1); continue; }
        if (s.rest) { s.restT += dt; if (s.restT > 4) seeds.splice(i, 1); continue; }
        windAt(s.x, s.y, _w);
        s.vx += (_w.x - s.vx) * 2.2 * dt + (Math.random() - 0.5) * 30 * dt;
        s.vy += (_w.y - s.vy) * 2.2 * dt + 24 * dt;
        pointerForce(s, dt); gustForce(s, dt);
        s.x += s.vx * dt; s.y += s.vy * dt; s.a += s.w * dt + s.vx * 0.001 * dt;
        if (s.y > groundY(s.x) - 2) { s.rest = true; s.restT = 0; }
      }
    }
    function updatePollen(dt: number) {
      for (let i = pollen.length - 1; i >= 0; i--) {
        const m = pollen[i]; m.age += dt;
        if (m.age > m.life || m.x < -40 || m.x > W + 40 || m.y < -40) { pollen.splice(i, 1); continue; }
        windAt(m.x, m.y, _w);
        m.vx += (_w.x * 0.95 - m.vx) * 3 * dt + (Math.random() - 0.5) * 46 * dt;
        m.vy += (_w.y * 0.95 - m.vy) * 3 * dt - 6 * dt + (Math.random() - 0.5) * 46 * dt;
        pointerForce(m, dt); gustForce(m, dt);
        m.x += m.vx * dt; m.y += m.vy * dt;
      }
    }
    function updateStreaks(dt: number) {
      for (const s of streaks) {
        windAt(s.x, s.y, _w);
        s.px = s.x; s.py = s.y;
        s.x += _w.x * dt * 1.15; s.y += _w.y * dt * 1.15;
        s.sp = Math.hypot(_w.x, _w.y); s.life -= dt;
        if (s.life <= 0 || s.x < -40 || s.x > W + 40 || s.y < -40 || s.y > H + 20) Object.assign(s, newStreak());
      }
    }
    let ambPetal = 2, ambSeed = 6;
    function ambient(dt: number) {
      ambPetal -= dt;
      if (ambPetal <= 0) {
        ambPetal = rand(3, 7);
        if (petals.length < 80) {
          const rs = flowers.filter(f => f.type === 'rose');
          if (rs.length) { const f = rs[(Math.random() * rs.length) | 0]; spawnPetal(f.headX, f.headY, { hue: f.hue, vx: rand(-20, 20), vy: rand(-40, 0) }); Sound.pluckSoft(); }
        }
      }
      ambSeed -= dt;
      if (ambSeed <= 0) {
        ambSeed = rand(6, 14);
        if (seeds.length < 70) { const ds = flowers.filter(f => f.type === 'dand' && f.seedsN > 0); if (ds.length) releaseSeeds(ds[(Math.random() * ds.length) | 0], 1 + (Math.random() * 2 | 0)); }
      }
    }

    // Rendering
    function drawHill(pts: any[], fill: string) {
      ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y);
      for (const p of pts) ctx.lineTo(p.x, p.y);
      ctx.lineTo(W + 30, H); ctx.lineTo(-30, H); ctx.closePath();
      ctx.fillStyle = fill; ctx.fill();
    }
    function drawPetal(p: any) {
      let al = 1; const rem = p.life - p.age;
      if (rem < 3) al = rem / 3;
      if (p.age < 0.5) al *= p.age * 2;
      if (p.landed) al *= p.landT < 2 ? 1 : Math.max(0, 1 - (p.landT - 2) / 3);
      if (al <= 0) return;
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.a);
      ctx.scale(0.25 + 0.75 * Math.abs(Math.cos(p.fl)), 1);
      const L = p.size, Wd = p.size * 0.55;
      ctx.beginPath();
      ctx.moveTo(-L * 0.55, 0);
      ctx.bezierCurveTo(-L * 0.2, -Wd, L * 0.35, -Wd * 0.9, L * 0.75, 0);
      ctx.bezierCurveTo(L * 0.35, Wd * 0.9, -L * 0.2, Wd, -L * 0.55, 0);
      ctx.fillStyle = `hsla(${p.hue},${p.sat}%,${p.lit}%,${0.92 * al})`;
      ctx.fill();
      ctx.strokeStyle = `hsla(${p.hue + 10},70%,${Math.min(95, p.lit + 14)}%,${0.4 * al})`;
      ctx.lineWidth = 0.8; ctx.stroke();
      ctx.restore();
    }
    function drawSeed(s: any) {
      let al = 1; const rem = s.life - s.age;
      if (rem < 2.5) al = rem / 2.5;
      if (s.rest) al *= Math.max(0, 1 - s.restT / 4);
      if (al <= 0) return;
      ctx.save(); ctx.translate(s.x, s.y); ctx.rotate(s.a * 0.25); ctx.scale(s.s, s.s);
      ctx.strokeStyle = `rgba(235,228,210,${0.7 * al})`; ctx.lineWidth = 0.7;
      ctx.beginPath();
      for (let i = 0; i < 10; i++) { const a = i / 10 * TAU; ctx.moveTo(Math.cos(a) * 1.5, Math.sin(a) * 1.5); ctx.lineTo(Math.cos(a) * 8, Math.sin(a) * 8); }
      ctx.stroke();
      ctx.fillStyle = `rgba(140,105,70,${0.9 * al})`;
      ctx.beginPath(); ctx.arc(0, 6.5, 1.5, 0, TAU); ctx.fill();
      ctx.restore();
    }
    function drawFlower(f: any) {
      const cpX = f.x + (f.headX - f.x) * 0.3, cpY = f.y - f.h * 0.55;
      ctx.strokeStyle = 'hsl(130,30%,26%)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(f.x, f.y); ctx.quadraticCurveTo(cpX, cpY, f.headX, f.headY); ctx.stroke();
      const lx = lerp(f.x, cpX, 0.7), ly = lerp(f.y, cpY, 0.7);
      ctx.save(); ctx.translate(lx, ly); ctx.rotate((f.phase > Math.PI ? 0.9 : -0.9) + f.sway * 0.3);
      ctx.fillStyle = 'hsl(125,32%,24%)';
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(8, -6, 17, -3); ctx.quadraticCurveTo(8, 3, 0, 0); ctx.fill();
      ctx.restore();
      ctx.save(); ctx.translate(f.headX, f.headY);
      if (f.glow > 0) {
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = `rgba(255,220,240,${f.glow * 0.25})`;
        ctx.beginPath(); ctx.arc(0, 0, 24, 0, TAU); ctx.fill();
        ctx.globalCompositeOperation = 'source-over';
      }
      const pulse = 1 + 0.04 * Math.sin(simTime * 1.1 + f.phase);
      if (f.type === 'rose') {
        ctx.rotate(f.sway * 0.4);
        for (let ring = 0; ring < 2; ring++) {
          const nP = ring === 0 ? 6 : 5, sc = ring === 0 ? 1 : 0.62, litB = ring === 0 ? f.lit : f.lit + 8;
          for (let i = 0; i < nP; i++) {
            ctx.save(); ctx.rotate(i / nP * TAU + f.phase + ring * 0.5); ctx.scale(pulse, pulse);
            ctx.beginPath(); ctx.ellipse(8 * sc, 0, 8 * sc, 4 * sc, 0, 0, TAU);
            ctx.fillStyle = `hsla(${f.hue},68%,${litB}%,0.95)`; ctx.fill();
            ctx.restore();
          }
        }
        ctx.beginPath(); ctx.arc(0, 0, 3.6, 0, TAU); ctx.fillStyle = 'hsl(45,90%,58%)'; ctx.fill();
      } else if (f.type === 'dand') {
        if (f.seedsN > 0) {
          ctx.strokeStyle = 'rgba(240,245,255,0.75)'; ctx.lineWidth = 0.7;
          ctx.beginPath();
          for (let i = 0; i < f.seedsN; i++) { const a = i / 36 * TAU + f.phase; ctx.moveTo(Math.cos(a) * 2.5, Math.sin(a) * 2.5); ctx.lineTo(Math.cos(a) * 11 * pulse, Math.sin(a) * 11 * pulse); }
          ctx.stroke();
          ctx.fillStyle = 'rgba(255,255,255,0.6)';
          ctx.beginPath(); ctx.arc(0, 0, 2.5, 0, TAU); ctx.fill();
        } else {
          ctx.fillStyle = '#5d7a4e'; ctx.beginPath(); ctx.arc(0, 0, 3, 0, TAU); ctx.fill();
        }
      } else {
        ctx.rotate(f.sway * 0.5);
        for (const da of [-0.6, 0, 0.6]) {
          ctx.save(); ctx.rotate(da); ctx.scale(pulse, pulse);
          ctx.beginPath(); ctx.moveTo(0, 0);
          ctx.bezierCurveTo(-5, 6, -4, 14, 0, 17); ctx.bezierCurveTo(4, 14, 5, 6, 0, 0);
          ctx.fillStyle = `hsla(${f.hue},55%,80%,0.95)`; ctx.fill(); ctx.restore();
        }
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = 'rgba(255,230,150,0.9)'; ctx.beginPath(); ctx.arc(0, 10, 2, 0, TAU); ctx.fill();
        ctx.globalCompositeOperation = 'source-over';
      }
      ctx.restore();
    }
    function render() {
      ctx.fillStyle = skyGrad; ctx.fillRect(0, 0, W, H);
      for (const s of stars) {
        const a = (0.25 + 0.55 * (0.5 + 0.5 * Math.sin(simTime * s.sp + s.ph))) * (1 - s.y / (H * 0.5));
        ctx.fillStyle = `rgba(255,244,230,${a})`; ctx.fillRect(s.x, s.y, s.r, s.r);
      }
      const sx = W * 0.74, sy = H * 0.60, pu = 0.9 + 0.1 * Math.sin(simTime * 0.4);
      let g = ctx.createRadialGradient(sx, sy, 0, sx, sy, 240);
      g.addColorStop(0, `rgba(255,185,120,${0.36 * pu})`); g.addColorStop(1, 'rgba(255,185,120,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(sx, sy, 240, 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(255,222,170,0.95)'; ctx.beginPath(); ctx.arc(sx, sy, 26, 0, TAU); ctx.fill();
      for (const c of clouds) {
        ctx.save(); ctx.translate(c.x, c.y); ctx.scale(1, 0.42);
        const cg = ctx.createRadialGradient(0, 0, 0, 0, 0, c.s);
        cg.addColorStop(0, `rgba(255,214,190,${c.a})`); cg.addColorStop(1, 'rgba(255,214,190,0)');
        ctx.fillStyle = cg; ctx.beginPath(); ctx.arc(0, 0, c.s, 0, TAU); ctx.fill(); ctx.restore();
      }
      drawHill(hill1, 'rgba(58,38,74,0.55)');
      drawHill(hill2, 'rgba(38,30,52,0.72)');
      ctx.globalCompositeOperation = 'lighter';
      for (const s of streaks) {
        const a = Math.min(0.28, s.sp * 0.0016) * Math.min(1, s.life);
        if (a <= 0.004) continue;
        ctx.strokeStyle = `rgba(255,238,214,${a})`; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(s.px, s.py); ctx.lineTo(s.x, s.y); ctx.stroke();
      }
      ctx.globalCompositeOperation = 'source-over';
      ctx.beginPath(); ctx.moveTo(gndPts[0].x, gndPts[0].y);
      for (const p of gndPts) ctx.lineTo(p.x, p.y);
      ctx.lineTo(W + 30, H); ctx.lineTo(-30, H); ctx.closePath();
      ctx.fillStyle = groundGrad; ctx.fill();
      ctx.strokeStyle = 'rgba(255,190,130,0.14)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(gndPts[0].x, gndPts[0].y);
      for (const p of gndPts) ctx.lineTo(p.x, p.y); ctx.stroke();
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 3; i++) {
        const mx = ((i * 0.42 * W + simTime * (6 + i * 4)) % (W + 600)) - 300, my = groundY(mx) - 18;
        const mg = ctx.createRadialGradient(mx, my, 0, mx, my, 150);
        mg.addColorStop(0, 'rgba(200,180,220,0.05)'); mg.addColorStop(1, 'rgba(200,180,220,0)');
        ctx.fillStyle = mg; ctx.save(); ctx.translate(mx, my); ctx.scale(1.9, 0.4); ctx.beginPath(); ctx.arc(0, 0, 150, 0, TAU); ctx.fill(); ctx.restore();
      }
      ctx.globalCompositeOperation = 'source-over';
      const shake = 1 + currentWindPower * 2 + gustEnv * 2;
      for (const gb of grass) {
        const ci = clamp(Math.round(gb.x / 26), 0, COLS - 1);
        const bend = colWX[ci] * 0.16 * gb.h / 30 + Math.sin(simTime * 2 + gb.ph) * shake * 1.2;
        ctx.strokeStyle = `hsla(${gb.hue},35%,${gb.lite}%,0.9)`; ctx.lineWidth = gb.w;
        ctx.beginPath(); ctx.moveTo(gb.x, gb.y);
        ctx.quadraticCurveTo(gb.x + bend * 0.3, gb.y - gb.h * 0.5, gb.x + bend, gb.y - gb.h); ctx.stroke();
        if (gb.head) {
          ctx.fillStyle = `hsla(${gb.hue},30%,${gb.lite + 8}%,0.9)`;
          ctx.beginPath(); ctx.ellipse(gb.x + bend, gb.y - gb.h, 1.6, 4, bend * 0.02, 0, TAU); ctx.fill();
        }
      }
      for (const f of flowers) drawFlower(f);
      for (const s of seeds) drawSeed(s);
      for (const p of petals) drawPetal(p);
      ctx.globalCompositeOperation = 'lighter';
      for (const m of pollen) {
        let al = (0.35 + 0.3 * Math.sin(m.age * 6 + m.tw));
        const rem = m.life - m.age; if (rem < 1.5) al *= rem / 1.5;
        ctx.fillStyle = `hsla(48,100%,70%,${al * 0.25})`;
        ctx.beginPath(); ctx.arc(m.x, m.y, m.r * 3, 0, TAU); ctx.fill();
        ctx.fillStyle = `hsla(52,100%,78%,${al})`;
        ctx.beginPath(); ctx.arc(m.x, m.y, m.r, 0, TAU); ctx.fill();
      }
      for (const fl of fireflies) {
        const a = (0.2 + 0.6 * (0.5 + 0.5 * Math.sin(fl.ph * 3))) * 0.8;
        ctx.fillStyle = `hsla(55,100%,70%,${a * 0.3})`;
        ctx.beginPath(); ctx.arc(fl.x, fl.y, 5, 0, TAU); ctx.fill();
        ctx.fillStyle = `hsla(58,100%,80%,${a})`;
        ctx.beginPath(); ctx.arc(fl.x, fl.y, 1.4, 0, TAU); ctx.fill();
      }
      ctx.globalCompositeOperation = 'source-over';
      for (const r of ripples) {
        ctx.strokeStyle = `rgba(255,235,210,${r.a})`; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(r.x, r.y, r.r, 0, TAU); ctx.stroke();
      }
      ctx.fillStyle = vign; ctx.fillRect(0, 0, W, H);
    }

    // Sound engine
    const Sound = (() => {
      let actx: AudioContext | null = null, started = false, muted = false;
      let master: GainNode, verb: ConvolverNode, padBus: GainNode, padFilter: BiquadFilterNode;
      let windGain: GainNode, windFilter: BiquadFilterNode, hissGain: GainNode, noiseBuf: AudioBuffer;
      let chordIdx = 0, nextChord = 0, nextPluck = 0, nextBird = 0, walk = 4;
      const chords = [[50, 54, 57, 61], [47, 50, 54, 57], [43, 47, 50, 54], [45, 49, 52, 59]];
      const scale = [62, 64, 66, 69, 71, 74, 76, 78, 81, 83];
      const midiF = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

      function makeImpulse(dur: number, decay: number) {
        const sr = actx!.sampleRate, len = sr * dur, buf = actx!.createBuffer(2, len, sr);
        for (let c = 0; c < 2; c++) { const d = buf.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay); }
        return buf;
      }
      function start() {
        if (started) return; started = true;
        const AC = window.AudioContext || (window as any).webkitAudioContext; if (!AC) return;
        actx = new AC(); if (actx.state === 'suspended') actx.resume();
        master = actx.createGain(); master.gain.value = 0.85; master.connect(actx.destination);
        verb = actx.createConvolver(); verb.buffer = makeImpulse(3.2, 2.6);
        const vOut = actx.createGain(); vOut.gain.value = 0.55; verb.connect(vOut); vOut.connect(master);
        noiseBuf = actx.createBuffer(1, actx.sampleRate * 2, actx.sampleRate);
        const nd = noiseBuf.getChannelData(0); for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
        const ws = actx.createBufferSource(); ws.buffer = noiseBuf; ws.loop = true;
        windFilter = actx.createBiquadFilter(); windFilter.type = 'bandpass'; windFilter.frequency.value = 300; windFilter.Q.value = 0.8;
        windGain = actx.createGain(); windGain.gain.value = 0;
        ws.connect(windFilter); windFilter.connect(windGain); windGain.connect(master); ws.start();
        const hs = actx.createBufferSource(); hs.buffer = noiseBuf; hs.loop = true; hs.playbackRate.value = 1.6;
        const hf = actx.createBiquadFilter(); hf.type = 'highpass'; hf.frequency.value = 2800;
        hissGain = actx.createGain(); hissGain.gain.value = 0;
        hs.connect(hf); hf.connect(hissGain); hissGain.connect(master); hs.start();
        padFilter = actx.createBiquadFilter(); padFilter.type = 'lowpass'; padFilter.frequency.value = 760; padFilter.Q.value = 0.4;
        padBus = actx.createGain(); padBus.gain.value = 1;
        padBus.connect(padFilter); padFilter.connect(master);
        const pSend = actx.createGain(); pSend.gain.value = 0.5; padFilter.connect(pSend); pSend.connect(verb);
        const lfo = actx.createOscillator(); lfo.frequency.value = 0.05;
        const lfoG = actx.createGain(); lfoG.gain.value = 240;
        lfo.connect(lfoG); lfoG.connect(padFilter.frequency); lfo.start();
        const d1 = actx.createOscillator(); d1.type = 'sine'; d1.frequency.value = midiF(38);
        const d2 = actx.createOscillator(); d2.type = 'sine'; d2.frequency.value = midiF(38) * 1.004;
        const dg = actx.createGain(); dg.gain.value = 0.05;
        d1.connect(dg); d2.connect(dg); dg.connect(padFilter); d1.start(); d2.start();
        nextChord = actx.currentTime + 0.2; nextPluck = actx.currentTime + 2.5; nextBird = actx.currentTime + 7;
        setInterval(tick, 300);
      }
      function padVoice(f: number, when: number, dur: number) {
        [-3, 4].forEach(det => {
          const o = actx!.createOscillator(); o.type = 'triangle'; o.frequency.value = f; o.detune.value = det;
          const gn = actx!.createGain();
          gn.gain.setValueAtTime(0.0001, when);
          gn.gain.linearRampToValueAtTime(0.045, when + dur * 0.35);
          gn.gain.setValueAtTime(0.045, when + dur * 0.6);
          gn.gain.linearRampToValueAtTime(0.0001, when + dur);
          o.connect(gn); gn.connect(padBus); o.start(when); o.stop(when + dur + 0.2);
        });
      }
      function tick() {
        if (!actx || muted) return;
        const t = actx.currentTime;
        if (t > nextChord - 1) {
          const when = Math.max(t + 0.05, nextChord);
          chords[chordIdx].forEach(m => padVoice(midiF(m), when, 16));
          chordIdx = (chordIdx + 1) % chords.length; nextChord = when + 11;
        }
        if (t > nextPluck) {
          nextPluck = t + (1.6 + Math.random() * 4.4) * (1.25 - Math.min(currentWindPower, 1) * 0.55);
          if (Math.random() < 0.85) {
            walk = clamp(walk + ((Math.random() * 3) | 0) - 1, 0, scale.length - 1);
            pluckNote(midiF(scale[walk]), 0.13, t, false);
          }
        }
        if (t > nextBird) { nextBird = t + 9 + Math.random() * 16; bird(); }
      }
      function out(panVal: number) {
        const p = actx!.createStereoPanner(); p.pan.value = panVal; return p;
      }
      function pluckNote(f: number, vol: number, when: number, bell: boolean) {
        if (!actx) return;
        const dec = bell ? 3.2 : 2.1;
        const o = actx.createOscillator(); o.type = 'sine'; o.frequency.value = f;
        const o2 = actx.createOscillator(); o2.type = 'sine'; o2.frequency.value = f * 2.006;
        const gn = actx.createGain(), g2 = actx.createGain();
        gn.gain.setValueAtTime(0.0001, when); gn.gain.linearRampToValueAtTime(vol, when + 0.008); gn.gain.exponentialRampToValueAtTime(0.0004, when + dec);
        g2.gain.setValueAtTime(0.0001, when); g2.gain.linearRampToValueAtTime(vol * 0.22, when + 0.006); g2.gain.exponentialRampToValueAtTime(0.0003, when + dec * 0.4);
        const bus = out(Math.random() * 1.2 - 0.6);
        o.connect(gn); o2.connect(g2); gn.connect(bus); g2.connect(bus); bus.connect(master);
        const snd = actx.createGain(); snd.gain.value = bell ? 0.9 : 0.55; bus.connect(snd); snd.connect(verb);
        if (bell) {
          const o3 = actx.createOscillator(); o3.type = 'sine'; o3.frequency.value = f * 2.756;
          const g3 = actx.createGain();
          g3.gain.setValueAtTime(0.0001, when); g3.gain.linearRampToValueAtTime(vol * 0.1, when + 0.005);
          g3.gain.exponentialRampToValueAtTime(0.0002, when + dec * 0.5);
          o3.connect(g3); g3.connect(bus); o3.start(when); o3.stop(when + dec);
        }
        o.start(when); o2.start(when); o.stop(when + dec + 0.1); o2.stop(when + dec * 0.5);
      }
      function noiseBurst(dur: number, f0: number, f1: number, vol: number, q: number) {
        if (!actx) return; const t = actx.currentTime;
        const s = actx.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
        const fl = actx.createBiquadFilter(); fl.type = 'bandpass'; fl.Q.value = q || 1;
        fl.frequency.setValueAtTime(Math.max(60, f0), t);
        fl.frequency.exponentialRampToValueAtTime(Math.max(80, f1), t + dur);
        const gn = actx.createGain();
        gn.gain.setValueAtTime(0.0001, t); gn.gain.linearRampToValueAtTime(vol, t + dur * 0.22);
        gn.gain.exponentialRampToValueAtTime(0.0006, t + dur);
        s.connect(fl); fl.connect(gn); gn.connect(master);
        const vs = actx.createGain(); vs.gain.value = 0.4; gn.connect(vs); vs.connect(verb);
        s.start(t, Math.random() * 1.5); s.stop(t + dur + 0.1);
      }
      function bird() {
        const t = actx!.currentTime + rand(0, 0.5), n = 2 + (Math.random() * 2 | 0); let f0 = rand(2200, 3000);
        for (let i = 0; i < n; i++) {
          const o = actx!.createOscillator(); o.type = 'sine'; const gn = actx!.createGain(); const st = t + i * 0.16;
          o.frequency.setValueAtTime(f0, st);
          o.frequency.exponentialRampToValueAtTime(Math.max(600, f0 * rand(0.8, 1.15)), st + 0.09);
          gn.gain.setValueAtTime(0.0001, st); gn.gain.linearRampToValueAtTime(0.035, st + 0.015);
          gn.gain.exponentialRampToValueAtTime(0.0003, st + 0.12);
          o.connect(gn); gn.connect(master); o.start(st); o.stop(st + 0.15); f0 *= rand(0.9, 1.08);
        }
      }
      function frame(speed: number) {
        if (!actx) return;
        if (actx.state === 'suspended') actx.resume();
        const t = actx.currentTime, sp = Math.min(1.2, speed / 220);
        windGain.gain.setTargetAtTime(0.012 + 0.13 * sp + gustEnv * 0.2, t, 0.35);
        windFilter.frequency.setTargetAtTime(210 + 520 * sp + gustEnv * 480, t, 0.3);
        hissGain.gain.setTargetAtTime(0.003 + 0.045 * sp + gustEnv * 0.07, t, 0.35);
      }
      function toggleMute() {
        if (!actx) return muted;
        muted = !muted;
        master.gain.setTargetAtTime(muted ? 0 : 0.85, actx.currentTime, 0.15);
        return muted;
      }
      return {
        start, frame, toggleMute,
        pluckSoft() { if (actx) pluckNote(midiF(scale[(4 + Math.random() * 5) | 0]), 0.07, actx.currentTime, false); },
        chime() { if (actx) pluckNote(midiF(scale[(5 + Math.random() * 4) | 0]), 0.17, actx.currentTime, true); },
        rustle() { noiseBurst(0.2, 1700, 900, 0.09, 1.3); },
        whoosh(p: number) { noiseBurst(1.4, 240, 320 + 880 * p, 0.3 * p, 0.7); }
      };
    })();

    // Store sim reference for callbacks
    simRef.current = { W, H, gustEnv, flowers, streaks, spawnPetal, releaseSeeds, Sound, rand, setWindPower: (v: number) => { currentWindPower = v; } };

    // Initialize
    resize();
    addEventListener('resize', resize);
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerup', onPointerUp);
    canvas.addEventListener('pointerleave', onPointerLeave);
    canvas.addEventListener('pointerdown', onPointerDown);

    // Main loop
    let last = performance.now();
    let animId: number;
    function loop(now: number) {
      const dt = Math.min(0.033, (now - last) / 1000); last = now;
      simTime += dt;
      gustEnv *= Math.exp(-dt * 0.7); if (gustEnv < 0.002) gustEnv = 0;
      pointer.vx *= Math.max(0, 1 - dt * 6); pointer.vy *= Math.max(0, 1 - dt * 6);
      fillCols();
      for (const c of clouds) { c.x += (c.v + currentWindPower * 8) * dt; if (c.x > W + 300) c.x = -300; }
      for (const fl of fireflies) {
        fl.ph += dt * fl.sp * 2;
        fl.x += noise.n3(fl.x * 0.002, fl.y * 0.002, simTime * 0.3) * 30 * dt + colWX[clamp(Math.round(fl.x / 26), 0, COLS - 1)] * 0.05 * dt;
        fl.y += noise.n3(fl.x * 0.002 + 7, fl.y * 0.002, simTime * 0.3) * 20 * dt;
        const gy = groundY(fl.x); fl.y = clamp(fl.y, gy - 160, gy - 14);
        if (fl.x < -20) fl.x = W + 10; if (fl.x > W + 20) fl.x = -10;
      }
      updateFlowers(dt); updatePetals(dt); updateSeeds(dt); updatePollen(dt); updateStreaks(dt);
      for (let i = ripples.length - 1; i >= 0; i--) { const r = ripples[i]; r.r += 110 * dt; r.a -= dt * 1.2; if (r.a <= 0) ripples.splice(i, 1); }
      for (let i = gusts.length - 1; i >= 0; i--) { gusts[i].t += dt; if (gusts[i].t > 0.45) gusts.splice(i, 1); }
      ambient(dt);
      windAt(W * 0.45, H * 0.55, _w); avgWind = Math.hypot(_w.x, _w.y);
      setNeedleAngle(Math.atan2(_w.y, _w.x));
      const ms = (avgWind * 0.045).toFixed(1);
      const word = avgWind < 50 ? 'still air' : avgWind < 110 ? 'breeze' : avgWind < 190 ? 'gusty' : 'gale';
      setWindRead(`${word} · ${ms} m/s`);
      Sound.frame(avgWind);
      render();
      // Update sim ref
      if (simRef.current) {
        simRef.current.W = W;
        simRef.current.H = H;
        simRef.current.gustEnv = gustEnv;
        simRef.current.flowers = flowers;
        simRef.current.streaks = streaks;
      }
      animId = requestAnimationFrame(loop);
    }
    animId = requestAnimationFrame(loop);

    // Keyboard
    function onKeyDown(e: KeyboardEvent) {
      if (e.code === 'Space') { e.preventDefault(); doGust(); }
      else if (e.key === 'p' || e.key === 'P') shedPetals();
      else if (e.key === 's' || e.key === 'S') releaseSeedsBtn();
    }
    addEventListener('keydown', onKeyDown);

    return () => {
      cancelAnimationFrame(animId);
      removeEventListener('resize', resize);
      removeEventListener('keydown', onKeyDown);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerup', onPointerUp);
      canvas.removeEventListener('pointerleave', onPointerLeave);
      canvas.removeEventListener('pointerdown', onPointerDown);
    };
  }, [doGust, shedPetals, releaseSeedsBtn]);

  // Sync wind power to simulation
  useEffect(() => {
    if (simRef.current && simRef.current.setWindPower) {
      simRef.current.setWindPower(windPower);
    }
  }, [windPower]);

  const handleEnter = useCallback(() => {
    if (simRef.current) {
      simRef.current.Sound.start();
    }
    setEntered(true);
  }, []);

  const handleMute = useCallback(() => {
    toggleMute();
  }, [toggleMute]);

  return (
    <>
      <canvas id="scene" ref={canvasRef} />

      <div id="overlay" className={entered ? 'gone' : ''}>
        <div className="ov-card">
          <div className="kicker">an interactive audio·physics reverie</div>
          <h1>Petalwind</h1>
          <p>A dusk meadow of living air. Petals tumble on turbulent currents, dandelion seeds ride thermals, pollen glows — and a generative soundtrack breathes with the wind. Stir it with your hands.</p>
          <button id="enterBtn" onClick={handleEnter}>❀ &nbsp;enter the meadow</button>
          <p className="ov-hint">headphones recommended · all sound is synthesized live</p>
        </div>
      </div>

      <div id="panel" className={entered ? '' : 'hidden'}>
        <div className="p-top">
          <span className="p-title">PETALWIND</span>
          <span id="windRead">{windRead}</span>
        </div>
        <label className="windRow">
          <span>calm</span>
          <input
            id="windSlider"
            type="range"
            min="0"
            max="1.6"
            step="0.01"
            value={windPower}
            onChange={e => setWindPower(parseFloat(e.target.value))}
          />
          <span>gale</span>
        </label>
        <div className="btns">
          <button onClick={doGust} title="Space">🌬 gust</button>
          <button onClick={shedPetals} title="P">🌸 shed petals</button>
          <button onClick={releaseSeedsBtn} title="S">🌾 release seeds</button>
          <button onClick={handleMute} title="M">{muted ? '🔇 muted' : '🔊 sound'}</button>
        </div>
        <div className="hints">drag to stir · hold to swirl · click a bloom · <b>space</b> gust</div>
      </div>

      <div id="meter" className={entered ? '' : 'hidden'}>
        <div id="needle" style={{ transform: `rotate(${needleAngle}rad)` }}>➤</div>
      </div>
    </>
  );
}
