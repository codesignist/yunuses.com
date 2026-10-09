"use client";
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { STYLES, STYLE_IDS, IDLE_DELAY, IDLE_AMP_X } from "./config";
import { createMaterialSets } from "./materials";
import { createSpine } from "./spine";
import { createBackdrop } from "./backdrop";
import { createBody } from "./body";
import { createMane } from "./mane";
import { createHead } from "./head";
import { createLimbs } from "./limbs";
import { createBreath } from "./breath";
import { createPost } from "./post";
import useLabKeys from "lib/useLabKeys";
import LabOptionBar from "components/molecules/LabOptionBar";

const LIGHT_DIR = new THREE.Vector3(440, 290, 320);
const STYLE_OPTIONS = STYLE_IDS.map((id) => ({ id, label: STYLES[id].label }));

export default function Dragon() {
  const containerRef = useRef(null);
  const branchRef = useRef(null);
  const [active, setActive] = useState("golge");
  const activeRef = useRef("golge");
  const [loading, setLoading] = useState(true);
  const [unsupported, setUnsupported] = useState(false);

  useEffect(() => {
    activeRef.current = active;
  }, [active]);

  useLabKeys(STYLE_IDS, setActive);

  // Dallarin fareye gore hafif kaymasi
  useEffect(() => {
    let raf = 0;
    let tx = 0, ty = 0, curX = 0, curY = 0, prev = 0;
    const MAX = 9;

    function onMove(e) {
      const nx = (e.clientX / (window.innerWidth || 1)) * 2 - 1;
      const ny = (e.clientY / (window.innerHeight || 1)) * 2 - 1;
      tx = -nx * MAX;
      ty = -ny * MAX;
    }
    function tick(t) {
      const dt = prev ? Math.min(0.1, (t - prev) / 1000) : 0;
      prev = t;
      const k = 1 - Math.pow(1 - 0.06, dt * 60);
      curX += (tx - curX) * k;
      curY += (ty - curY) * k;
      const el = branchRef.current;
      if (el) {
        el.style.transform = `scale(1.06) translate3d(${curX.toFixed(2)}px, ${curY.toFixed(2)}px, 0)`;
      }
      raf = requestAnimationFrame(tick);
    }
    window.addEventListener("pointermove", onMove);
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", onMove);
    };
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // WebGL2 acilamayan tarayicida (donanim hizlandirma kapali, GPU kara
    // listede) three hata firlatiyor, sayfa Next'in genel hata ekranina
    // dusuyordu.
    let renderer;
    try {
      // antialias kapali: sahne cok ornekli composer hedefine ciziliyor,
      // ekrana yalniz tam ekran ucgen gidiyor; varsayilan tamponun MSAA'si
      // hicbir kenari yumusatmadan GPU bellegi yiyordu.
      renderer = new THREE.WebGLRenderer({ antialias: false });
    } catch {
      setUnsupported(true);
      return;
    }
    const maxPR = Math.min(window.devicePixelRatio || 1, 2);
    let pixelRatio = maxPR;
    renderer.setPixelRatio(pixelRatio);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    const rect0 = container.getBoundingClientRect();
    renderer.setSize(rect0.width, rect0.height, false);
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";
    renderer.domElement.style.display = "block";
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(
      48,
      rect0.width / Math.max(1, rect0.height),
      1,
      6000,
    );
    camera.position.set(0, 0, 1150);
    camera.lookAt(0, 0, 0);

    const dirLight = new THREE.DirectionalLight(0xffffff, 1);
    dirLight.position.copy(LIGHT_DIR);
    scene.add(dirLight);
    const ambLight = new THREE.AmbientLight(0xffffff, 0.3);
    scene.add(ambLight);

    const { sets, dispose: disposeMats } = createMaterialSets(renderer, LIGHT_DIR);
    const styleRef = { current: sets[activeRef.current] };

    const spine = createSpine();
    const backdrop = createBackdrop(scene, camera);
    const body = createBody(scene, spine);
    const mane = createMane(scene, spine);
    const head = createHead(scene, spine, styleRef);
    const limbs = createLimbs(scene, spine, styleRef);
    const breath = createBreath(scene, spine);
    const post = createPost(renderer, scene, camera);

    let currentStyleId = null;
    function applyStyle(id) {
      currentStyleId = id;
      const style = STYLES[id];
      const set = sets[id];
      styleRef.current = set;

      dirLight.color.setHex(style.light);
      dirLight.intensity = style.lightIntensity;
      ambLight.color.setHex(style.ambient);
      ambLight.intensity = style.ambientIntensity;
      scene.environment = set.envMap;

      body.setMaterials(set);
      head.setMaterials(set);
      limbs.setMaterials(set);
      head.applyStyle(style);
      mane.applyStyle(style);
      backdrop.applyStyle(style);
      breath.applyStyle(style);
      post.applyStyle(style);
    }
    applyStyle(activeRef.current);

    // --- Fare ---
    const mouseNDC = new THREE.Vector2(0, 0);
    const mouse = { wx: 0, wy: 0, t: -Infinity, inside: false };
    const raycaster = new THREE.Raycaster();
    const dragPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
    const planeHit = new THREE.Vector3();

    function updateMouseWorld() {
      raycaster.setFromCamera(mouseNDC, camera);
      if (raycaster.ray.intersectPlane(dragPlane, planeHit)) {
        mouse.wx = planeHit.x;
        mouse.wy = planeHit.y;
      }
    }
    function onPointerMove(e) {
      const r = renderer.domElement.getBoundingClientRect();
      mouseNDC.x = ((e.clientX - r.left) / r.width) * 2 - 1;
      mouseNDC.y = -((e.clientY - r.top) / r.height) * 2 + 1;
      updateMouseWorld();
      mouse.t = performance.now();
      mouse.inside = true;
    }
    // Onceden window uzerinde "mouseout" dinleniyordu; o olay her eleman
    // gecisinde kabardigi icin fare hareket ederken bile idle'a kayiyordu.
    // pointerleave kabarmaz, sadece gercekten belgeden cikinca tetiklenir.
    function onLeave() {
      mouse.inside = false;
    }
    window.addEventListener("pointermove", onPointerMove);
    document.documentElement.addEventListener("pointerleave", onLeave);
    window.addEventListener("blur", onLeave);

    // --- Boyut ---
    let idleScaleX = 1;
    function resize() {
      const r = container.getBoundingClientRect();
      const w = Math.max(1, r.width);
      const h = Math.max(1, r.height);
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      // Bosta gezinmenin x genligi ekrandan bagimsizdi; dikey telefonda
      // gorunur yari genislik ~240 birim, kafa zamanin %40'inda ekran
      // disindaydi. Genligi gorunur genislige gore kisiyoruz, 1280x800 ve
      // ustunde olcek 1 kaliyor.
      const halfW =
        Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.position.z * camera.aspect;
      idleScaleX = Math.min(1, (halfW * 0.75) / IDLE_AMP_X);
      post.setSize(w, h, pixelRatio);
      backdrop.layout();
      updateMouseWorld();
    }
    const ro = new ResizeObserver(resize);
    ro.observe(container);
    resize();

    // --- Dongu ---
    // Hareketi azalt tercihinde bosta gezinme yok: bostayken hedef kafanin
    // kendi konumu, ejderha yavaslayip duruyor. Imlecin son konumunu hedef
    // almak yetmiyordu, donus yaricapi yuzunden o noktanin etrafinda durmadan
    // donuyordu. Imleci takip etmesi aynen suruyor.
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let raf = 0;
    let prevTime = -1;
    let idleBlend = 1;
    let frameAcc = 0;
    let frameCount = 0;
    let lastAdapt = 0;

    function step(now) {
      if (activeRef.current !== currentStyleId) applyStyle(activeRef.current);
      const style = STYLES[currentStyleId];

      if (prevTime < 0) prevTime = now;
      const dt = Math.min(0.1, (now - prevTime) / 1000);
      prevTime = now;
      const frames = dt * 60;

      const wantIdle = now - mouse.t > IDLE_DELAY || !mouse.inside;
      idleBlend = THREE.MathUtils.clamp(idleBlend + (wantIdle ? 1 : -1) * 0.018 * frames, 0, 1);

      let idleX, idleY;
      if (reduceMotion.matches) {
        idleX = spine.segs[0].x;
        idleY = spine.segs[0].y;
      } else {
        const idle = spine.idleTarget(now);
        idleX = idle.x * idleScaleX;
        idleY = idle.y;
      }
      const targetX = mouse.wx + (idleX - mouse.wx) * idleBlend;
      const targetY = mouse.wy + (idleY - mouse.wy) * idleBlend;

      spine.update(dt, targetX, targetY);
      body.update(now);
      mane.update(now, style);
      head.update(now, style);
      limbs.update(now);
      breath.update(now, dt);

      post.render(now);

      // Yumusakligin kendisi bir kalite meselesi: kare suresi tutarli sekilde
      // yuksekse cozunurlugu dusuruyoruz, rahatsa geri yukseltiyoruz.
      frameAcc += dt;
      frameCount++;
      if (now - lastAdapt > 1200 && frameCount > 20) {
        const avg = frameAcc / frameCount;
        let next = pixelRatio;
        if (avg > 0.024 && pixelRatio > 1) next = Math.max(1, pixelRatio - 0.25);
        else if (avg < 0.013 && pixelRatio < maxPR) next = Math.min(maxPR, pixelRatio + 0.25);
        if (next !== pixelRatio) {
          pixelRatio = next;
          renderer.setPixelRatio(pixelRatio);
          resize();
        }
        frameAcc = 0;
        frameCount = 0;
        lastAdapt = now;
      }

      raf = requestAnimationFrame(step);
    }

    // Dongu shader'lar hazir olunca basliyor. Ilk karede senkron derleme ana
    // thread'i saniyelerce kilitliyor, sayfa tiklamalara cevap vermiyordu.
    // Env map'in PMREM shader'i ve OutputPass yine senkron derleniyor:
    // birincisi icin three bir yol sunmuyor, ikincisinin ayarlari ilk
    // cizimde kuruluyor (bkz. post.js).
    let disposed = false;
    post.compile().then(() => {
      if (disposed) return;
      setLoading(false);
      raf = requestAnimationFrame(step);
    });

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener("pointermove", onPointerMove);
      document.documentElement.removeEventListener("pointerleave", onLeave);
      window.removeEventListener("blur", onLeave);
      // three'nin PBR malzemeleri modul seviyesindeki tek bir DFG LUT
      // dokusunu paylasiyor. Renderer ona bir dispose dinleyicisi takiyor;
      // doku hic dispose edilmedigi icin renderer, head.js'teki Sprite
      // geometrisinde oldugu gibi sayfa yenilenene kadar yasiyordu. Dispose
      // yalniz bu renderer'in GPU kopyasini siliyor, veri yerinde kaliyor.
      let dfgLUT = null;
      scene.traverse((o) => {
        if (!dfgLUT && o.material) {
          dfgLUT = renderer.properties.get(o.material).uniforms?.dfgLUT?.value ?? null;
        }
      });
      dfgLUT?.dispose();
      post.dispose();
      breath.dispose();
      limbs.dispose();
      head.dispose();
      mane.dispose();
      body.dispose();
      backdrop.dispose();
      disposeMats();
      scene.environment = null;
      renderer.dispose();
      // Baglami hemen birak: bir sey renderer'i hala tutsa bile GPU bellegi
      // cop toplayiciyi beklemesin.
      renderer.forceContextLoss();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  return (
    <div className="absolute inset-0 bg-black">
      {/* Tuvali three kendisi ekliyor; ad kapsayicida. */}
      <div
        ref={containerRef}
        role="img"
        aria-label="Ejderha sahnesi"
        className="absolute inset-0 w-full h-full touch-none select-none"
      />

      {/* Paralaks katmani: transform'u ref ile her karede veriliyor, boyutu
          tum ekran; next/image'in optimizasyonu burada bir sey kazandirmiyor. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        ref={branchRef}
        src="/lab/dragon/branches.webp"
        alt=""
        aria-hidden="true"
        className="pointer-events-none select-none absolute inset-0 w-full h-full object-cover z-20 will-change-transform"
        style={{ mixBlendMode: "multiply", transform: "scale(1.06)" }}
      />

      {/* data-chrome: sunucuda da ciziliyor, sayfanin markdown'ina girmesin. */}
      {loading && !unsupported && (
        <div data-chrome className="fixed inset-0 z-30 flex items-center justify-center text-[12px] text-white/55 pointer-events-none">
          Hazırlanıyor...
        </div>
      )}

      {unsupported ? (
        <div className="absolute inset-0 z-30 flex items-center justify-center text-white/70 text-sm px-6 text-center">
          Tarayıcın bu deneyi çalıştıramıyor. Başka bir tarayıcıda ya da cihazda dene.
        </div>
      ) : (
        <div className="fixed bottom-4 left-4 z-30">
          <LabOptionBar options={STYLE_OPTIONS} active={active} onSelect={setActive} />
        </div>
      )}
    </div>
  );
}
