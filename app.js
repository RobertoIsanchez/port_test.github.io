import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { RGBELoader } from "three/addons/loaders/RGBELoader.js";

const assetURL = (p) => new URL(p, import.meta.url).toString();

let scene, camera, renderer, controls;
let currentModel, models = [];
let currentIndex = 0;

init();
loadModels();

function init() {
  scene = new THREE.Scene();

  camera = new THREE.PerspectiveCamera(45, innerWidth / innerHeight, 0.1, 100);
  camera.position.set(0, 1.2, 3);

  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(innerWidth, innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  document.getElementById("canvas-container").appendChild(renderer.domElement);

  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;

  new RGBELoader().load(assetURL("hdr/studio.hdr"), (hdr) => {
    hdr.mapping = THREE.EquirectangularReflectionMapping;
    scene.environment = hdr;
    scene.background = hdr;
  });

  window.addEventListener("resize", onResize);
  animate();
}

async function loadModels() {
  const res = await fetch(assetURL("models.json"));
  models = await res.json();
  buildGallery();
  loadModel(0);
}

function loadModel(index) {
  if (currentModel) scene.remove(currentModel);

  const loader = new GLTFLoader();
  const data = models[index];

  document.getElementById("loading").style.display = "flex";

  loader.load(assetURL(data.path), (gltf) => {
    currentModel = gltf.scene;
    scene.add(currentModel);
    document.getElementById("loading").style.display = "none";
    updateInfo(data);
  });
}

function updateInfo(data) {
  document.getElementById("model-name").textContent = data.name;

  const specs = Object.entries(data.specs)
    .map(([k, v]) => `<div>${k}: ${v}</div>`)
    .join("");

  document.getElementById("tech-specs").innerHTML = specs;
}

function buildGallery() {
  const container = document.getElementById("gallery-items");
  container.innerHTML = "";

  models.forEach((m, i) => {
    const item = document.createElement("div");
    item.textContent = i + 1;
    item.onclick = () => {
      currentIndex = i;
      loadModel(i);
    };
    container.appendChild(item);
  });

  document.getElementById("prev-model").onclick = () => {
    currentIndex = (currentIndex - 1 + models.length) % models.length;
    loadModel(currentIndex);
  };

  document.getElementById("next-model").onclick = () => {
    currentIndex = (currentIndex + 1) % models.length;
    loadModel(currentIndex);
  };
}

function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}

function onResize() {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
}
