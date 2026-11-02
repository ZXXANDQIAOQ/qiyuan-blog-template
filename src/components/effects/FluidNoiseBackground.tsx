/**
 * WebGL 流体噪声背景 —— 参考 dshdesktop.cn 的 Hero 背景效果
 *
 * WebGL2 双 pass 渲染：
 *   Pass 1（flowmap）：低分辨率 ping-pong FBO，记录鼠标轨迹与速度场。
 *   Pass 2（display）：全分辨率，用 simplex noise + 流场扭曲生成有机流动图案。
 *
 * 调色板适配「编辑部极简版」双主题：
 *   - 浅色模式：暖灰底（#f3f4f1 系）噪声，铁锈红发光拖尾
 *   - 深色模式：深炭底（#171815 系）噪声，橙红发光拖尾
 *
 * 技术要点：
 *   - WebGL2 不可用时回退纯色背景
 *   - prefers-reduced-motion 时不响应鼠标
 *   - IntersectionObserver 控制不可见时暂停
 *   - 30fps 限帧，低分辨率 flowmap（/4）
 */
import { useEffect, useRef } from 'react';

// ─── GLSL 着色器 ───────────────────────────────────────────────

const VERT_SRC = `#version 300 es
in vec4 a_position;
out vec2 vUv;
void main() {
  vUv = a_position.xy * 0.5 + 0.5;
  gl_Position = a_position;
}`;

const FRAG_FLOWMAP = `#version 300 es
precision mediump float;
in vec2 vUv;
uniform sampler2D u_prev;
uniform vec2 u_mouse;
uniform vec2 u_velocity;
uniform float u_brushRadius;
uniform float u_brushStrength;
uniform float u_decay;
out vec4 fragColor;

void main() {
  vec4 prev = texture(u_prev, vUv);
  prev.r *= u_decay;
  prev.gb = mix(vec2(0.5), prev.gb, u_decay);

  float dist = distance(vUv, u_mouse);
  float influence = exp(-dist * dist / (u_brushRadius * u_brushRadius * 0.5));
  influence = max(0.0, influence - 0.01);

  float speed = length(u_velocity);
  float presenceStrength = u_brushStrength * 0.3;
  float velBonus = min(speed * 3.0, 0.7) * u_brushStrength;
  float totalStrength = presenceStrength + velBonus;

  prev.r = max(prev.r, influence * totalStrength);
  float blendAmt = influence * min(totalStrength, 0.4) * 0.3;
  prev.g = mix(prev.g, clamp(u_velocity.x * 2.0 + 0.5, 0.0, 1.0), blendAmt);
  prev.b = mix(prev.b, clamp(u_velocity.y * 2.0 + 0.5, 0.0, 1.0), blendAmt);

  fragColor = prev;
}`;

const FRAG_MAIN = `#version 300 es
precision mediump float;
in vec2 vUv;
uniform float u_time;
uniform vec2 u_resolution;
uniform vec3 u_c1, u_c2, u_c3, u_c4, u_c5;
uniform float u_scale;
uniform vec2 u_offset;
uniform float u_grain;
uniform sampler2D u_flowmap;
uniform float u_distortBoost;
uniform float u_swirlBoost;
uniform float u_glowIntensity;
uniform vec3 u_glowColor1;
uniform vec3 u_glowColor2;
uniform vec3 u_glowColor3;
uniform vec2 u_lightPos;
uniform float u_lightCore;
uniform float u_lightHalo;
uniform float u_vignette;
uniform float u_bloomThreshold;
uniform float u_bloomRange;
uniform float u_bloomStrength;
out vec4 fragColor;

vec3 mod289v3(vec3 x){return x-floor(x*(1./289.))*289.;}
vec4 mod289v4(vec4 x){return x-floor(x*(1./289.))*289.;}
vec4 permute(vec4 x){return mod289v4(((x*34.)+1.)*x);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-.85373472095314*r;}

float snoise(vec3 v){
  const vec2 C=vec2(1./6.,1./3.);
  const vec4 D=vec4(0.,.5,1.,2.);
  vec3 i=floor(v+dot(v,C.yyy));
  vec3 x0=v-i+dot(i,C.xxx);
  vec3 g=step(x0.yzx,x0.xyz);
  vec3 l=1.-g;
  vec3 i1=min(g.xyz,l.zxy);
  vec3 i2=max(g.xyz,l.zxy);
  vec3 x1=x0-i1+C.xxx;
  vec3 x2=x0-i2+C.yyy;
  vec3 x3=x0-D.yyy;
  i=mod289v3(i);
  vec4 p=permute(permute(permute(i.z+vec4(0.,i1.z,i2.z,1.))+i.y+vec4(0.,i1.y,i2.y,1.))+i.x+vec4(0.,i1.x,i2.x,1.));
  float n_=.142857142857;
  vec3 ns=n_*D.wyz-D.xzx;
  vec4 j=p-49.*floor(p*ns.z*ns.z);
  vec4 x_=floor(j*ns.z);
  vec4 y_=floor(j-7.*x_);
  vec4 x=x_*ns.x+ns.yyyy;
  vec4 y=y_*ns.x+ns.yyyy;
  vec4 h=1.-abs(x)-abs(y);
  vec4 b0=vec4(x.xy,y.xy);
  vec4 b1=vec4(x.zw,y.zw);
  vec4 s0=floor(b0)*2.+1.;
  vec4 s1=floor(b1)*2.+1.;
  vec4 sh=-step(h,vec4(0.));
  vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy;
  vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
  vec3 p0=vec3(a0.xy,h.x);vec3 p1=vec3(a0.zw,h.y);
  vec3 p2=vec3(a1.xy,h.z);vec3 p3=vec3(a1.zw,h.w);
  vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
  p0*=norm.x;p1*=norm.y;p2*=norm.z;p3*=norm.w;
  vec4 m=max(.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.);
  m=m*m;
  return 42.*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
}

float hash(vec2 p){
  vec3 p3=fract(vec3(p.xyx)*.1031);
  p3+=dot(p3,p3.yzx+33.33);
  return fract((p3.x+p3.y)*p3.z);
}

float fbm(vec3 p){
  float v=0.,amp=.6;vec3 shift=vec3(100.);
  for(int i=0;i<1;i++){v+=amp*snoise(p);p=p*2.+shift;amp*=.4;}
  return v;
}

float fluidNoise(vec2 uv,float t){
  float n1=fbm(vec3(uv*.6,t*.06));
  float n2=fbm(vec3(uv*.6+5.2,t*.06+1.3));
  vec2 w1=vec2(n1,n2)*.6;
  float n3=fbm(vec3((uv+w1)*.7+1.7,t*.05+3.1));
  float n4=fbm(vec3((uv+w1)*.7+9.2,t*.05+5.7));
  vec2 w2=vec2(n3,n4)*.5;
  return fbm(vec3((uv+w1+w2)*.5,t*.04));
}

vec2 curlish(vec2 uv,float t){
  float eps=.02;
  float n=snoise(vec3(uv*.8,t));
  float nx=snoise(vec3((uv+vec2(eps,0.))*.8,t));
  float ny=snoise(vec3((uv+vec2(0.,eps))*.8,t));
  return vec2(-(ny-n)/eps,(nx-n)/eps)*.003;
}

void main(){
  float aspect=u_resolution.x/u_resolution.y;
  vec2 uv=gl_FragCoord.xy/u_resolution;
  vec2 suv=vec2(uv.x*aspect, uv.y) * u_scale + u_offset;
  float t=u_time;

  vec4 flow = texture(u_flowmap, uv);
  float influence = flow.r;
  vec2 flowDir = (flow.gb - 0.5) * 2.0;

  suv += flowDir * influence * u_distortBoost * 0.8;
  float swirlAngle = influence * u_swirlBoost * 2.5;
  float cs = cos(swirlAngle), sn = sin(swirlAngle);
  vec2 delta = suv - vec2(uv.x * aspect, uv.y) * u_scale;
  suv += (mat2(cs, sn, -sn, cs) * delta - delta) * influence;

  vec2 curl=curlish(suv,t*.04);
  vec2 uvD=suv+curl*12.;
  float f=fluidNoise(uvD,t);
  float swirl=snoise(vec3(uvD*.8+f*1.5,t*.035))*.5+.5;
  float n=f*.5+.5;
  vec3 col=mix(u_c1,u_c2,smoothstep(.2,.5,n));
  col=mix(col,u_c3,smoothstep(.35,.65,n+swirl*.25));
  col=mix(col,u_c4,smoothstep(.6,.85,swirl)*.55);
  col=mix(col,u_c5,smoothstep(.5,.8,n*swirl)*.35);

  float glow = smoothstep(0.0, 0.8, influence);
  float glowNoise = snoise(vec3(uvD * 1.5, t * 0.08)) * 0.5 + 0.5;
  float glowDist = smoothstep(0.0, 1.0, influence);
  vec3 glowMix = mix(u_glowColor3, u_glowColor2, glowDist);
  glowMix = mix(glowMix, u_glowColor1, glowDist * glowNoise);
  col = mix(col, glowMix, glow * u_glowIntensity);

  if(u_grain>0.0){
    vec2 flowOffset = (uvD - suv) * u_resolution.y;
    vec2 gp = floor((gl_FragCoord.xy + flowOffset) / 5.0);
    float gr=hash(gp)*2.-1.;
    col+=gr*u_grain;
  }

  float luma=dot(col,vec3(.299,.587,.114));
  float bloom=smoothstep(u_bloomThreshold-u_bloomRange,u_bloomThreshold+u_bloomRange,luma);
  col+=(col*.85+vec3(.15,.145,.13))*bloom*u_bloomStrength;

  float ld=length((uv-u_lightPos)*vec2(aspect,1.));
  float core=exp(-ld*ld*4.5);
  float halo=exp(-ld*1.8);
  col+=vec3(1.,.97,.9)*core*u_lightCore+vec3(.86,.86,.86)*halo*u_lightHalo;

  float vig=1.-smoothstep(.35,.75,length(uv-.5));
  col=mix(col*(1.-u_vignette),col,vig);
  fragColor=vec4(col,1.);
}`;

// ─── 工具函数 ─────────────────────────────────────────────────

function hexToRGB(hex: string): [number, number, number] {
  const t = hex.replace('#', '');
  return [
    Number.parseInt(t.slice(0, 2), 16) / 255,
    Number.parseInt(t.slice(2, 4), 16) / 255,
    Number.parseInt(t.slice(4, 6), 16) / 255,
  ];
}

function compileShader(gl: WebGL2RenderingContext, type: number, src: string): WebGLShader | null {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, src);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.error('Shader compile error:', gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

function createProgram(gl: WebGL2RenderingContext, fragSrc: string): WebGLProgram | null {
  const vs = compileShader(gl, gl.VERTEX_SHADER, VERT_SRC);
  const fs = compileShader(gl, gl.FRAGMENT_SHADER, fragSrc);
  if (!vs || !fs) return null;
  const prog = gl.createProgram();
  if (!prog) return null;
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    console.error('Program link error:', gl.getProgramInfoLog(prog));
    gl.deleteProgram(prog);
    return null;
  }
  return prog;
}

function bindQuad(gl: WebGL2RenderingContext, prog: WebGLProgram, buffer: WebGLBuffer) {
  const loc = gl.getAttribLocation(prog, 'a_position');
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
}

function createFBO(
  gl: WebGL2RenderingContext,
  w: number,
  h: number,
  data?: Uint8Array,
): { framebuffer: WebGLFramebuffer; texture: WebGLTexture } | null {
  const texture = gl.createTexture();
  const framebuffer = gl.createFramebuffer();
  if (!texture || !framebuffer) return null;
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, data ?? null);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  return { framebuffer, texture };
}

// ─── 调色板（编辑部极简版双主题） ────────────────────────────

/** 浅色模式：暖灰纯色底 + 铁锈红强调（#f3f4f1 / #b93b28） */
const PALETTE_LIGHT = ['#f3f4f1', '#e9eae6', '#dedfd9', '#d9dad5', '#cfd0ca'] as const;
const GLOW_LIGHT = ['#b93b28', '#d4694f', '#f3d8d0'] as const;

/** 深色模式：深炭底 + 橙红强调（#171815 / #f06449） */
const PALETTE_DARK = ['#171815', '#1d1e1b', '#222420', '#2a2c27', '#30322d'] as const;
const GLOW_DARK = ['#f06449', '#ff7a60', '#4b2922'] as const;

function isDark(): boolean {
  return document.documentElement.classList.contains('dark');
}

// ─── 组件 ─────────────────────────────────────────────────────

export default function FluidNoiseBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvasRaw = canvasRef.current;
    if (!canvasRaw) return;
    const canvas: HTMLCanvasElement = canvasRaw;

    const glRaw = canvas.getContext('webgl2', {
      alpha: true,
      premultipliedAlpha: false,
      powerPreference: 'low-power',
    });
    if (!glRaw) return;
    const gl: WebGL2RenderingContext = glRaw;

    const flowProgRaw = createProgram(gl, FRAG_FLOWMAP);
    const mainProgRaw = createProgram(gl, FRAG_MAIN);
    if (!flowProgRaw || !mainProgRaw) return;
    const flowProg: WebGLProgram = flowProgRaw;
    const mainProg: WebGLProgram = mainProgRaw;

    const quad = gl.createBuffer();
    if (!quad) return;
    gl.bindBuffer(gl.ARRAY_BUFFER, quad);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);

    const uFlow = {
      prev: gl.getUniformLocation(flowProg, 'u_prev'),
      mouse: gl.getUniformLocation(flowProg, 'u_mouse'),
      velocity: gl.getUniformLocation(flowProg, 'u_velocity'),
      brushRadius: gl.getUniformLocation(flowProg, 'u_brushRadius'),
      brushStrength: gl.getUniformLocation(flowProg, 'u_brushStrength'),
      decay: gl.getUniformLocation(flowProg, 'u_decay'),
    };
    const uMain = {
      time: gl.getUniformLocation(mainProg, 'u_time'),
      resolution: gl.getUniformLocation(mainProg, 'u_resolution'),
      scale: gl.getUniformLocation(mainProg, 'u_scale'),
      offset: gl.getUniformLocation(mainProg, 'u_offset'),
      grain: gl.getUniformLocation(mainProg, 'u_grain'),
      flowmap: gl.getUniformLocation(mainProg, 'u_flowmap'),
      distortBoost: gl.getUniformLocation(mainProg, 'u_distortBoost'),
      swirlBoost: gl.getUniformLocation(mainProg, 'u_swirlBoost'),
      glowIntensity: gl.getUniformLocation(mainProg, 'u_glowIntensity'),
      glowColor1: gl.getUniformLocation(mainProg, 'u_glowColor1'),
      glowColor2: gl.getUniformLocation(mainProg, 'u_glowColor2'),
      glowColor3: gl.getUniformLocation(mainProg, 'u_glowColor3'),
      c1: gl.getUniformLocation(mainProg, 'u_c1'),
      c2: gl.getUniformLocation(mainProg, 'u_c2'),
      c3: gl.getUniformLocation(mainProg, 'u_c3'),
      c4: gl.getUniformLocation(mainProg, 'u_c4'),
      c5: gl.getUniformLocation(mainProg, 'u_c5'),
      lightPos: gl.getUniformLocation(mainProg, 'u_lightPos'),
      lightCore: gl.getUniformLocation(mainProg, 'u_lightCore'),
      lightHalo: gl.getUniformLocation(mainProg, 'u_lightHalo'),
      vignette: gl.getUniformLocation(mainProg, 'u_vignette'),
      bloomThreshold: gl.getUniformLocation(mainProg, 'u_bloomThreshold'),
      bloomRange: gl.getUniformLocation(mainProg, 'u_bloomRange'),
      bloomStrength: gl.getUniformLocation(mainProg, 'u_bloomStrength'),
    };

    const params = {
      scale: 0.89,
      offsetX: 0.46,
      offsetY: 0.1,
      grain: 0.04,
      distortBoost: 0.5,
      swirlBoost: 0.63,
      glowIntensity: 0.55,
      lightX: 0.5,
      lightY: 0.46,
      lightCore: 0.08,
      lightHalo: 0.04,
      vignette: 0.35,
      bloomThreshold: 0.55,
      bloomRange: 0.18,
      bloomStrength: 0.35,
      brushRadius: 0.89,
      brushStrength: 0.46,
      decay: 0.94,
    };

    let rafId = 0;
    let visible = true;
    const startTime = performance.now();
    const mouse = { x: 0, y: 0, smoothX: 0, smoothY: 0, svx: 0, svy: 0 };
    const isReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const enableMouse = !isReduced;

    let fboA: ReturnType<typeof createFBO> = null;
    let fboB: ReturnType<typeof createFBO> = null;
    let fboW = 0;
    let fboH = 0;
    let fullW = 0;
    let fullH = 0;
    let flip = false;

    function initFBOs() {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      fullW = Math.round(canvas.clientWidth * dpr);
      fullH = Math.round(canvas.clientHeight * dpr);
      canvas.width = fullW;
      canvas.height = fullH;
      fboW = Math.max(1, Math.round(fullW / 4));
      fboH = Math.max(1, Math.round(fullH / 4));
      const initial = new Uint8Array(fboW * fboH * 4);
      for (let i = 0; i < fboW * fboH; i++) {
        initial[4 * i] = 0;
        initial[4 * i + 1] = 128;
        initial[4 * i + 2] = 128;
        initial[4 * i + 3] = 255;
      }
      fboA = createFBO(gl, fboW, fboH, initial);
      fboB = createFBO(gl, fboW, fboH, initial);
    }

    function onMouseMove(e: MouseEvent) {
      const rect = canvas.getBoundingClientRect();
      mouse.x = (e.clientX - rect.left) / rect.width;
      mouse.y = 1 - (e.clientY - rect.top) / rect.height;
    }

    initFBOs();
    if (enableMouse) window.addEventListener('mousemove', onMouseMove);

    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
    });
    observer.observe(canvas);

    const frameInterval = 1000 / 30;
    let lastFrame = 0;

    function render(timestamp: number) {
      rafId = requestAnimationFrame(render);
      if (!visible || timestamp - lastFrame < frameInterval || !fboA || !fboB) return;
      lastFrame = timestamp - ((timestamp - lastFrame) % frameInterval);

      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      const pw = Math.round(canvas.clientWidth * dpr);
      const ph = Math.round(canvas.clientHeight * dpr);
      if (pw !== fullW || ph !== fullH) initFBOs();

      mouse.smoothX += (mouse.x - mouse.smoothX) * 0.63;
      mouse.smoothY += (mouse.y - mouse.smoothY) * 0.63;
      mouse.svx += ((mouse.x - mouse.smoothX) * 0.5 - mouse.svx) * 0.1;
      mouse.svy += ((mouse.y - mouse.smoothY) * 0.5 - mouse.svy) * 0.1;

      const src = flip ? fboA : fboB;
      const dst = flip ? fboB : fboA;
      flip = !flip;

      // Pass 1：flowmap
      gl.bindFramebuffer(gl.FRAMEBUFFER, dst.framebuffer);
      gl.viewport(0, 0, fboW, fboH);
      gl.useProgram(flowProg);
      bindQuad(gl, flowProg, quad);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, src.texture);
      gl.uniform1i(uFlow.prev, 0);
      gl.uniform2f(uFlow.mouse, mouse.smoothX, mouse.smoothY);
      gl.uniform2f(uFlow.velocity, mouse.svx, mouse.svy);
      gl.uniform1f(uFlow.brushRadius, params.brushRadius);
      gl.uniform1f(uFlow.brushStrength, enableMouse ? params.brushStrength : 0);
      gl.uniform1f(uFlow.decay, params.decay);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

      // Pass 2：display
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, fullW, fullH);
      gl.useProgram(mainProg);
      bindQuad(gl, mainProg, quad);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, dst.texture);
      gl.uniform1i(uMain.flowmap, 0);
      gl.uniform1f(uMain.time, ((performance.now() - startTime) * 0.001 * 0.035) / 100);
      gl.uniform2f(uMain.resolution, fullW, fullH);
      gl.uniform1f(uMain.scale, params.scale);
      gl.uniform2f(uMain.offset, params.offsetX / 100, params.offsetY / 100);
      gl.uniform1f(uMain.grain, params.grain);
      gl.uniform1f(uMain.distortBoost, params.distortBoost);
      gl.uniform1f(uMain.swirlBoost, params.swirlBoost);
      gl.uniform1f(uMain.glowIntensity, params.glowIntensity);

      const lightX = params.lightX + (mouse.smoothX - params.lightX) * 0.63;
      gl.uniform2f(uMain.lightPos, enableMouse ? lightX : params.lightX, params.lightY);
      gl.uniform1f(uMain.lightCore, params.lightCore);
      gl.uniform1f(uMain.lightHalo, params.lightHalo);
      gl.uniform1f(uMain.vignette, params.vignette);
      gl.uniform1f(uMain.bloomThreshold, params.bloomThreshold);
      gl.uniform1f(uMain.bloomRange, params.bloomRange);
      gl.uniform1f(uMain.bloomStrength, params.bloomStrength);

      // 主题调色板
      const palette = isDark() ? PALETTE_DARK : PALETTE_LIGHT;
      const glowColors = isDark() ? GLOW_DARK : GLOW_LIGHT;

      const cLocs = [uMain.c1, uMain.c2, uMain.c3, uMain.c4, uMain.c5];
      cLocs.forEach((loc, i) => {
        const [r, g, b] = hexToRGB(palette[i] ?? '#000000');
        gl.uniform3f(loc, r, g, b);
      });
      const gLocs = [uMain.glowColor1, uMain.glowColor2, uMain.glowColor3];
      gLocs.forEach((loc, i) => {
        const [r, g, b] = hexToRGB(glowColors[i] ?? '#ffffff');
        gl.uniform3f(loc, r, g, b);
      });

      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }

    rafId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(rafId);
      if (enableMouse) window.removeEventListener('mousemove', onMouseMove);
      observer.disconnect();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="absolute inset-0 h-full w-full"
    />
  );
}
