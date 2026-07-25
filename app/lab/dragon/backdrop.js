import * as THREE from "three";

const MOON_Z = -1500;
const SKY_Z = -1900;

/**
 * Ay ve gokyuzu onceden DOM'daydi: canvas'in altinda bir <img> ve bir CSS
 * gradyani. Bu iki seyi imkansiz kiliyordu; cam malzemenin kiracak bir sey
 * bulmasi (transmission sadece sahneyi ornekler, opak gri levha cikiyordu) ve
 * bloom'un ana isik kaynagina degmesi. Ikisi de artik sahnenin icinde.
 */
export function createBackdrop(scene, camera) {
  const skyCanvas = document.createElement("canvas");
  skyCanvas.width = 4;
  skyCanvas.height = 256;
  const skyTex = new THREE.CanvasTexture(skyCanvas);
  skyTex.colorSpace = THREE.SRGBColorSpace;

  const skyMat = new THREE.MeshBasicMaterial({
    map: skyTex,
    depthWrite: false,
    depthTest: false,
    toneMapped: false,
  });
  const sky = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), skyMat);
  sky.position.z = SKY_Z;
  sky.renderOrder = -20;
  sky.frustumCulled = false;
  scene.add(sky);

  const moonTex = new THREE.TextureLoader().load("/lab/dragon/moon.jpg");
  moonTex.colorSpace = THREE.SRGBColorSpace;
  const moonMat = new THREE.MeshBasicMaterial({
    map: moonTex,
    // CSS'teki "screen" karisimin sahne icindeki karsiligi. transparent:false
    // birakiliyor ki opak kuyrukta kalsin ve renderOrder ile ejderhanin
    // arkasina siralansin; transparent olsaydi ejderhanin ustune cizilirdi.
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    depthTest: false,
    toneMapped: false,
  });
  const moon = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), moonMat);
  moon.position.z = MOON_Z;
  moon.renderOrder = -10;
  moon.frustumCulled = false;
  scene.add(moon);

  function layout() {
    const tanHalf = Math.tan(THREE.MathUtils.degToRad(camera.fov) * 0.5);

    const moonDist = camera.position.z - MOON_Z;
    const mh = 2 * moonDist * tanHalf;
    const mw = mh * camera.aspect;
    // DOM'daki hali 160vmin kare bir gorseldi, ayni cerceveyi koruyoruz.
    const side = 1.6 * Math.min(mw, mh);
    moon.scale.set(side, side, 1);

    const skyDist = camera.position.z - SKY_Z;
    const sh = 2 * skyDist * tanHalf;
    const sw = sh * camera.aspect;
    sky.scale.set(sw * 1.1, sh * 1.1, 1);
  }

  function applyStyle(style) {
    const ctx = skyCanvas.getContext("2d");
    const grad = ctx.createLinearGradient(0, 0, 0, skyCanvas.height);
    grad.addColorStop(0, style.sky[0]);
    grad.addColorStop(1, style.sky[1]);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, skyCanvas.width, skyCanvas.height);
    skyTex.needsUpdate = true;

    moonMat.color.setHex(style.moonTint).multiplyScalar(style.moonGain);
  }

  function dispose() {
    scene.remove(sky);
    scene.remove(moon);
    sky.geometry.dispose();
    moon.geometry.dispose();
    skyMat.dispose();
    moonMat.dispose();
    skyTex.dispose();
    moonTex.dispose();
  }

  return { layout, applyStyle, dispose };
}
