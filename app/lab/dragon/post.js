import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";

// Vinyet, gren ve kenarlarda cok hafif renk sapmasi. OutputPass'ten sonra,
// yani sRGB alaninda calisiyor; gren dogal olarak orada durur.
const GradeShader = {
  uniforms: {
    tDiffuse: { value: null },
    uTime: { value: 0 },
    uVignette: { value: 0.55 },
    uGrain: { value: 0.035 },
    uAberration: { value: 0.0008 },
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    precision highp float;
    uniform sampler2D tDiffuse;
    uniform float uTime;
    uniform float uVignette;
    uniform float uGrain;
    uniform float uAberration;
    varying vec2 vUv;

    void main() {
      vec2 c = vUv - 0.5;
      float r2 = dot(c, c);
      vec2 off = c * r2 * uAberration * 8.0;

      vec3 col;
      col.r = texture2D(tDiffuse, vUv + off).r;
      col.g = texture2D(tDiffuse, vUv).g;
      col.b = texture2D(tDiffuse, vUv - off).b;

      float vig = smoothstep(0.75, 0.18, r2);
      col *= mix(1.0, vig, uVignette);

      float n = fract(sin(dot(vUv + fract(uTime * 0.37), vec2(12.9898, 78.233))) * 43758.5453);
      col += (n - 0.5) * uGrain;

      gl_FragColor = vec4(col, 1.0);
    }
  `,
};

export function createPost(renderer, scene, camera) {
  const size = new THREE.Vector2();
  renderer.getSize(size);

  const composer = new EffectComposer(
    renderer,
    new THREE.WebGLRenderTarget(size.x, size.y, {
      type: THREE.HalfFloatType,
      samples: 4,
    }),
  );
  // renderTarget2 yukaridaki hedefin kopyasi, MSAA onda kaliyor. Sahne her
  // karede oraya ciziliyor: RenderPass ve bloom takas yapmiyor, OutputPass
  // ve grade birer kez yapiyor, kare basina iki takas. renderTarget1'e
  // yalniz OutputPass'in tam ekran ciktisi yaziliyor, MSAA orada bos yere
  // GPU bellegi yiyordu. Bir gecis eklenir ya da kapatilirsa takas sayisi
  // tek olur ve sahne MSAA'siz hedefe duser; o zaman burasi da degismeli.
  composer.renderTarget1.samples = 0;

  composer.addPass(new RenderPass(scene, camera));

  const bloom = new UnrealBloomPass(new THREE.Vector2(size.x, size.y), 0.6, 0.5, 0.6);
  composer.addPass(bloom);

  const outputPass = new OutputPass();
  composer.addPass(outputPass);

  const grade = new ShaderPass(GradeShader);
  composer.addPass(grade);

  function applyStyle(style) {
    bloom.strength = style.bloom.strength;
    bloom.radius = style.bloom.radius;
    bloom.threshold = style.bloom.threshold;
  }

  function setSize(w, h, pixelRatio) {
    composer.setPixelRatio(pixelRatio);
    composer.setSize(w, h);
  }

  function render(now) {
    grade.uniforms.uTime.value = now * 0.001;
    composer.render();
  }

  // Program anahtari geometrinin hangi attribute'lari tasidigina da bakiyor.
  // Gecislerin tam ekran ucgeninde konum var, normal yok; on derleme
  // geometrisi de oyle olmali, yoksa ilk karede yeniden derleniyor.
  const compileGeo = new THREE.BufferGeometry();
  compileGeo.setAttribute("position", new THREE.Float32BufferAttribute([-1, 3, 0, -1, -1, 0, 3, -1, 0], 3));
  function meshesOf(materials) {
    const group = new THREE.Group();
    for (const m of materials) group.add(new THREE.Mesh(compileGeo, m));
    return group;
  }

  // Sahnenin ve gecislerin shader'larini ana thread'i kilitlemeden derler.
  // three programi cizilen hedefe gore (ton esleme, cikis renk uzayi) farkli
  // derliyor; on derleme de ayni hedef bagliyken yapilmali, yoksa ilk karede
  // hepsi yeniden derleniyor. Sahne ve bloom hedeflere, grade ekrana ciziyor.
  // OutputPass'in define'lari ilk render'inda kuruldugu icin onceden
  // derlenemiyor; tek ve kucuk bir program, ilk karede derleniyor.
  function compile() {
    const prev = renderer.getRenderTarget();
    renderer.setRenderTarget(composer.readBuffer);
    const ready = [
      renderer.compileAsync(scene, camera),
      renderer.compileAsync(
        meshesOf([
          bloom.materialHighPassFilter,
          ...bloom.separableBlurMaterials,
          bloom.compositeMaterial,
          bloom.blendMaterial,
        ]),
        camera,
      ),
    ];
    renderer.setRenderTarget(null);
    ready.push(renderer.compileAsync(meshesOf([grade.material]), camera));
    renderer.setRenderTarget(prev);
    return Promise.all(ready);
  }

  function dispose() {
    bloom.dispose();
    outputPass.dispose();
    grade.dispose();
    composer.dispose();
    compileGeo.dispose();
  }

  return { applyStyle, setSize, render, compile, dispose };
}
