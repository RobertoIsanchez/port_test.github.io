import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';

let scene, camera, renderer, controls;
let currentModel = null;
let mixer = null;
let clock = new THREE.Clock();
let currentModelIndex = 0;
let animations = [];
let activeAction = null;
let isPlaying = false;
let gridHelper = null;
let axisHelper = null;

const loadingEl = document.getElementById('loading');
const techSpecsEl = document.getElementById('tech-specs');
const modelNameEl = document.getElementById('model-name');
const galleryItemsEl = document.getElementById('gallery-items');

const modelsGallery = [
  {
    id: 1,
    name: 'OWL',
    path: 'models/owl.glb',
    specs: {
      'POLYGON COUNT': '12,000 tris',
      'CONCEPT': 'Original',
      'TIME': '~8 hrs'
    },
    software: ['blender', 'substance']
  },
  {
    id: 2,
    name: 'MILES',
    path: 'models/miles.glb',
    specs: {
      'POLYGON COUNT': '18,500 tris',
      'CONCEPT': 'Original',
      'TIME': '~12 hrs'
    },
    software: ['blender', 'maya']
  },
  {
    id: 3,
    name: 'IXO',
    path: 'models/ixo.glb',
    specs: {
      'POLYGON COUNT': '9,200 tris',
      'CONCEPT': 'Original',
      'TIME': '~5 hrs'
    },
    software: ['blender']
  },
  {
    id: 4,
    name: 'VEHICLE',
    path: 'models/vehicle.glb',
    specs: {
      'POLYGON COUNT': '—',
      'CONCEPT': '—',
      'TIME': '—'
    },
    software: ['blender']
  }
];

// === HDR (ahora en carpeta /hdr) ===
const hdrPaths = {
  studio: 'hdr/studio.hdr',
  sunset: 'hdr/sunset.hdr',
  night: 'hdr/night.hdr',
  forest: 'hdr/forest.hdr',
  city: 'hdr/city.hdr',
  warehouse: 'hdr/warehouse.hdr'
};

const hdrCache = {};
const rgbeLoader = new RGBELoader();

init();
createGallery();
loadModelByIndex(0);

function init() {
  scene = new THREE.Scene();

  camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
  camera.position.set(0, 1.2, 3.5);

  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  document.getElementById('canvas-container').appendChild(renderer.domElement);

  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;

  // Helpers
  gridHelper = new THREE.GridHelper(20, 40, 0x333333, 0x222222);
  gridHelper.position.y = -0.9;
  scene.add(gridHelper);

  axisHelper = new THREE.AxesHelper(2);
  scene.add(axisHelper);

  // Lights
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
  scene.add(ambientLight);

  const mainLight = new THREE.DirectionalLight(0xffffff, 1.0);
  mainLight.position.set(2, 4, 2);
  scene.add(mainLight);

  // Default HDR
  setHDR('studio');

  // UI wiring (sliders)
  const hdrRotationEl = document.getElementById('hdr-rotation');
  const hdrExposureEl = document.getElementById('hdr-exposure');
  const lightIntensityEl = document.getElementById('light-intensity');
  const ambientIntensityEl = document.getElementById('ambient-intensity');

  hdrRotationEl.addEventListener('input', () => {
    scene.environmentRotation = new THREE.Euler(0, THREE.MathUtils.degToRad(Number(hdrRotationEl.value)), 0);
    scene.backgroundRotation = scene.environmentRotation;
  });

  hdrExposureEl.addEventListener('input', () => {
    renderer.toneMappingExposure = Number(hdrExposureEl.value);
  });

  lightIntensityEl.addEventListener('input', () => {
    mainLight.intensity = Number(lightIntensityEl.value);
  });

  ambientIntensityEl.addEventListener('input', () => {
    ambientLight.intensity = Number(ambientIntensityEl.value);
  });

  // Light type navigation
  const lightKeys = Object.keys(hdrPaths);
  let lightIndex = 0;

  document.getElementById('prev-light').addEventListener('click', () => {
    lightIndex = (lightIndex - 1 + lightKeys.length) % lightKeys.length;
    setHDR(lightKeys[lightIndex]);
    updateLightName(lightKeys[lightIndex]);
  });

  document.getElementById('next-light').addEventListener('click', () => {
    lightIndex = (lightIndex + 1) % lightKeys.length;
    setHDR(lightKeys[lightIndex]);
    updateLightName(lightKeys[lightIndex]);
  });

  // Prev/Next model
  document.getElementById('prev-model').addEventListener('click', () => {
    const newIndex = (currentModelIndex - 1 + modelsGallery.length) % modelsGallery.length;
    loadModelByIndex(newIndex);
  });

  document.getElementById('next-model').addEventListener('click', () => {
    const newIndex = (currentModelIndex + 1) % modelsGallery.length;
    loadModelByIndex(newIndex);
  });

  // Grid toggle
  document.getElementById('grid-toggle').addEventListener('click', (e) => {
    e.currentTarget.classList.toggle('active');
    const active = e.currentTarget.classList.contains('active');
    if (gridHelper) gridHelper.visible = active;
    if (axisHelper) axisHelper.visible = active;
  });

  // UI toggle
  const overlayEl = document.querySelector('.overlay');
  const uiRestoreEl = document.getElementById('ui-restore');
  const uiToggleEl = document.getElementById('ui-toggle');
  const uiRestoreToggleEl = document.getElementById('ui-restore-toggle');

  function setUIVisible(visible) {
    overlayEl.style.display = visible ? '' : 'none';
    uiRestoreEl.style.display = visible ? 'none' : 'flex';
    if (visible) uiToggleEl.classList.add('active');
    else uiToggleEl.classList.remove('active');
    if (!visible) uiRestoreToggleEl.classList.add('active');
    else uiRestoreToggleEl.classList.remove('active');
  }

  uiToggleEl.addEventListener('click', () => setUIVisible(false));
  uiRestoreToggleEl.addEventListener('click', () => setUIVisible(true));

  window.addEventListener('resize', onResize);
  animate();
}

function updateLightName(key) {
  const name = key.toUpperCase();
  document.getElementById('light-name').textContent = name;
}

function setHDR(key) {
  const url = hdrPaths[key];
  if (!url) return;

  if (hdrCache[url]) {
    applyHDR(hdrCache[url]);
    return;
  }

  rgbeLoader.load(url, (texture) => {
    texture.mapping = THREE.EquirectangularReflectionMapping;
    hdrCache[url] = texture;
    applyHDR(texture);
  });
}

const pmrem = new THREE.PMREMGenerator(renderer);

function applyHDR(texture) {
  const envMap = pmrem.fromEquirectangular(texture).texture;
  scene.environment = envMap;
  scene.background = null;
  renderer.setClearColor(0x0a0a0a, 1);
}


function createGallery() {
  galleryItemsEl.innerHTML = '';

  modelsGallery.forEach((model, index) => {
    const item = document.createElement('button');
    item.className = 'gallery-item';
    item.textContent = String(index + 1).padStart(2, '0');

    item.addEventListener('click', () => loadModelByIndex(index));
    galleryItemsEl.appendChild(item);
  });
}

function setActiveGalleryItem(index) {
  const items = Array.from(document.querySelectorAll('.gallery-item'));
  items.forEach((el, i) => el.classList.toggle('active', i === index));
}

function loadModelByIndex(index) {
  if (index < 0 || index >= modelsGallery.length) return;

  currentModelIndex = index;
  const modelData = modelsGallery[index];

  setActiveGalleryItem(index);
  updateModelInfo(modelData);

  loadingEl.classList.add('show');

  const loader = new GLTFLoader();
  loader.load(
    modelData.path,
    (gltf) => {
      if (currentModel) {
        scene.remove(currentModel);
        currentModel.traverse((obj) => {
          if (obj.geometry) obj.geometry.dispose?.();
          if (obj.material) {
            if (Array.isArray(obj.material)) obj.material.forEach((m) => m.dispose?.());
            else obj.material.dispose?.();
          }
        });
      }

      currentModel = gltf.scene;
      scene.add(currentModel);

      // Animations
      animations = gltf.animations || [];
      setupAnimations(animations);

      // Center model
      centerModel(currentModel);

      loadingEl.classList.remove('show');
    },
    undefined,
    (err) => {
      console.error('Error cargando modelo:', err);
      loadingEl.classList.remove('show');
    }
  );
}

function updateModelInfo(modelData) {
  modelNameEl.textContent = modelData.name || '';

  techSpecsEl.innerHTML = '';
  if (modelData.specs) {
    Object.entries(modelData.specs).forEach(([k, v]) => {
      const row = document.createElement('div');
      row.className = 'spec-row';
      row.innerHTML = `<span>${k}</span><span>${v}</span>`;
      techSpecsEl.appendChild(row);
    });
  }

  // software icons
  const icons = document.querySelectorAll('.software-icon');
  icons.forEach((el) => el.classList.add('hidden'));
  (modelData.software || []).forEach((key) => {
    const el = document.querySelector(`.software-icon[data-software="${key}"]`);
    if (el) el.classList.remove('hidden');
  });
}

function centerModel(model) {
  const box = new THREE.Box3().setFromObject(model);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());

  model.position.sub(center);

  const maxDim = Math.max(size.x, size.y, size.z);
  const dist = maxDim * 1.8;
  camera.position.set(0, maxDim * 0.35, dist);
  controls.target.set(0, 0, 0);
  controls.update();
}

function setupAnimations(anims) {
  const panel = document.getElementById('animation-panel');
  const select = document.getElementById('anim-select');
  const playBtn = document.getElementById('play-btn');
  const stopBtn = document.getElementById('stop-btn');
  const resetBtn = document.getElementById('reset-btn');

  if (!anims || anims.length === 0) {
    panel.classList.remove('show');
    select.disabled = true;
    playBtn.disabled = true;
    stopBtn.disabled = true;
    resetBtn.disabled = true;
    mixer = null;
    activeAction = null;
    isPlaying = false;
    return;
  }

  panel.classList.add('show');

  mixer = new THREE.AnimationMixer(currentModel);
  select.innerHTML = '';
  anims.forEach((a, i) => {
    const opt = document.createElement('option');
    opt.value = String(i);
    opt.textContent = a.name || `Animation ${i + 1}`;
    select.appendChild(opt);
  });

  select.disabled = false;
  playBtn.disabled = false;
  stopBtn.disabled = false;
  resetBtn.disabled = false;

  const playIcon = document.getElementById('play-icon');
  const pauseIcon = document.getElementById('pause-icon');

  function play(index = 0) {
    if (!mixer) return;
    if (activeAction) activeAction.stop();

    const clip = anims[index];
    activeAction = mixer.clipAction(clip);
    activeAction.reset();
    activeAction.play();
    isPlaying = true;
    playIcon.style.display = 'none';
    pauseIcon.style.display = '';
  }

  function pause() {
    if (!activeAction) return;
    isPlaying = false;
    activeAction.paused = true;
    playIcon.style.display = '';
    pauseIcon.style.display = 'none';
  }

  function resume() {
    if (!activeAction) return;
    isPlaying = true;
    activeAction.paused = false;
    playIcon.style.display = 'none';
    pauseIcon.style.display = '';
  }

  play(0);

  select.onchange = () => play(Number(select.value));

  playBtn.onclick = () => {
    if (!activeAction) return;
    if (!isPlaying) resume();
    else pause();
  };

  stopBtn.onclick = () => {
    if (!activeAction) return;
    activeAction.stop();
    isPlaying = false;
    playIcon.style.display = '';
    pauseIcon.style.display = 'none';
  };

  resetBtn.onclick = () => {
    if (!activeAction) return;
    activeAction.reset();
    if (!isPlaying) {
      activeAction.paused = true;
    }
  };
}

function animate() {
  requestAnimationFrame(animate);

  const delta = clock.getDelta();
  if (mixer) mixer.update(delta);

  controls.update();
  renderer.render(scene, camera);
}

function onResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}
