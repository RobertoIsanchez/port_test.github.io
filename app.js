import * as THREE from 'three';
    import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
    import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
    import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';

    // ============================================================
    // CONFIGURACIÓN DE MODELOS - Edita este array
    // ============================================================
        // ============================================================
    // CONFIGURACIÓN DE MODELOS (JSON) - Edita models.json
    // ============================================================
    const MODELS_JSON_URL = './models.json';

    // Fallback (por si models.json no está disponible). Mantiene compatibilidad.
    const fallbackModelsGallery = [
  {
    "id": 1,
    "name": "OWL",
    "path": "models/owl.glb",
    "thumbnail": "",
    "software": [
      "blender",
      "substance"
    ],
    "specs": {
      "Polygon Count": "12,000 tris",
      "Concept": "Original",
      "Time": "~8 hrs"
    }
  },
  {
    "id": 2,
    "name": "Character Model",
    "path": "./miles.glb",
    "thumbnail": "",
    "software": [
      "blender",
      "zbrush",
      "substance",
      "photoshop"
    ],
    "specs": {
      "Polygon Count": "85,000 tris",
      "Concept": "Artist",
      "Time": "~120 hrs"
    }
  },
  {
    "id": 3,
    "name": "Environment Prop",
    "path": "./ixo.glb",
    "thumbnail": "",
    "software": [
      "blender",
      "photoshop"
    ],
    "specs": {
      "Polygon Count": "5,200 tris",
      "Concept": "Original",
      "Time": "~15 hrs"
    }
  },
  {
    "id": 4,
    "name": "Vehicle",
    "path": "/models/vehicle.glb",
    "thumbnail": "",
    "software": [
      "blender",
      "substance",
      "maya"
    ],
    "specs": {
      "Polygon Count": "45,000 tris",
      "Concept": "Commission",
      "Time": "~80 hrs"
    }
  }
];

    let modelsGallery = [];

    function hasModels() {
      return Array.isArray(modelsGallery) && modelsGallery.length > 0;
    }

    async function loadModelsGallery() {
      try {
        const res = await fetch(MODELS_JSON_URL, { cache: 'no-cache' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (!Array.isArray(data) || data.length === 0) throw new Error('JSON inválido o vacío');
        // Validación mínima
        data.forEach((m, i) => {
          if (!m || typeof m !== 'object') throw new Error(`Modelo inválido en índice ${i}`);
          if (!m.name || !m.path) throw new Error(`Falta "name" o "path" en índice ${i}`);
          if (!m.specs) m.specs = {};
          if (!Array.isArray(m.software)) m.software = [];
          if (typeof m.thumbnail !== 'string') m.thumbnail = '';
        });
        return data;
      } catch (err) {
        console.warn('No se pudo cargar models.json. Usando fallback interno.', err);
        return fallbackModelsGallery;
      }
    }

    // Tipos de luz
    const lightTypes = [
      { id: 'studio', name: 'STUDIO', icon: 'studio' },
      { id: 'sunset', name: 'SUNSET', icon: 'sunset' },
      { id: 'night', name: 'NIGHT', icon: 'night' },
      { id: 'forest', name: 'FOREST', icon: 'forest' },
      { id: 'city', name: 'CITY', icon: 'city' },
      { id: 'warehouse', name: 'WAREHOUSE', icon: 'warehouse' }
    ];

    const lightIcons = {
      studio: `<circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" stroke="currentColor" stroke-width="2"/>`,
      sunset: `<circle cx="12" cy="17" r="5"/><path d="M12 12V2M4 17h16" stroke="currentColor" stroke-width="2"/><path d="M5.64 11.64l1.42 1.42M18.36 11.64l-1.42 1.42" stroke="currentColor" stroke-width="2"/>`,
      night: `<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/><circle cx="17" cy="5" r="1"/><circle cx="19" cy="9" r="0.5"/>`,
      forest: `<path d="M12 2L7 9h3v4H7l5 9 5-9h-3V9h3L12 2z"/><rect x="11" y="18" width="2" height="4"/>`,
      city: `<rect x="3" y="10" width="4" height="12"/><rect x="10" y="6" width="4" height="16"/><rect x="17" y="12" width="4" height="10"/><path d="M5 12h0M12 8h0M12 11h0M19 14h0" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>`,
      warehouse: `<rect x="2" y="8" width="20" height="14" rx="1"/><path d="M6 8V4h12v4" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="15" r="3" fill="none" stroke="currentColor" stroke-width="2"/>`
    };

    // ============================================================
    // VARIABLES GLOBALES
    // ============================================================
    let currentModelIndex = 0;
    let currentModel = null;
    let mixer = null;
    let animations = [];
    let currentAction = null;
    let isPlaying = true;
    const clock = new THREE.Clock();

    let currentRenderMode = 'composite';
    let originalMaterials = new Map();
    let currentLightIndex = 0;

    // FPS counter
    let frameCount = 0;
    let lastTime = performance.now();
    let fps = 0;

    // ============================================================
    // SETUP ESCENA
    // ============================================================
    const container = document.getElementById('canvas-container');
    const loading = document.getElementById('loading');
    const galleryItems = document.getElementById('gallery-items');

    const scene = new THREE.Scene();

    const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 1, 5);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.minDistance = 2;
    controls.maxDistance = 10;
    controls.target.set(0, 0.5, 0);

    // ============================================================
    // GRID 3D
    // ============================================================
    const gridGroup = new THREE.Group();
    scene.add(gridGroup);

    const gridSize = 20;
    const gridDivisions = 20;
    const gridHelper = new THREE.GridHelper(gridSize, gridDivisions, 0x444444, 0x2a2a2a);
    gridHelper.position.y = 0;
    gridHelper.material.opacity = 0.4;
    gridHelper.material.transparent = true;
    gridGroup.add(gridHelper);

    const gridHelperFine = new THREE.GridHelper(gridSize, gridDivisions * 4, 0x333333, 0x1a1a1a);
    gridHelperFine.position.y = 0;
    gridHelperFine.material.opacity = 0.2;
    gridHelperFine.material.transparent = true;
    gridGroup.add(gridHelperFine);

    const axisLength = gridSize / 2;
    
    const xAxisGeometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(-axisLength, 0.01, 0),
      new THREE.Vector3(axisLength, 0.01, 0)
    ]);
    const xAxisMaterial = new THREE.LineBasicMaterial({ color: 0xff4444, opacity: 0.6, transparent: true });
    const xAxis = new THREE.Line(xAxisGeometry, xAxisMaterial);
    gridGroup.add(xAxis);

    const zAxisGeometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0.01, -axisLength),
      new THREE.Vector3(0, 0.01, axisLength)
    ]);
    const zAxisMaterial = new THREE.LineBasicMaterial({ color: 0x4444ff, opacity: 0.6, transparent: true });
    const zAxis = new THREE.Line(zAxisGeometry, zAxisMaterial);
    gridGroup.add(zAxis);

    const groundGeometry = new THREE.PlaneGeometry(gridSize, gridSize, 1, 1);
    const groundMaterial = new THREE.ShaderMaterial({
      uniforms: {
        uColor: { value: new THREE.Color(0x1a1a1a) },
        uOpacity: { value: 0.3 },
        uFadeRadius: { value: 0.8 }
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 uColor;
        uniform float uOpacity;
        uniform float uFadeRadius;
        varying vec2 vUv;
        void main() {
          vec2 center = vUv - 0.5;
          float dist = length(center) * 2.0;
          float fade = 1.0 - smoothstep(uFadeRadius * 0.5, uFadeRadius, dist);
          gl_FragColor = vec4(uColor, uOpacity * fade);
        }
      `,
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: false
    });
    const groundPlane = new THREE.Mesh(groundGeometry, groundMaterial);
    groundPlane.rotation.x = -Math.PI / 2;
    groundPlane.position.y = -0.01;
    groundPlane.receiveShadow = true;
    gridGroup.add(groundPlane);

    let gridOpacity = 1;

    let gridEnabled = true;

    // ============================================================
    // LUCES
    // ============================================================
    const hdrPaths = {
      studio: 'studio.hdr',
      sunset: 'sunset.hdr',
      night: 'night.hdr',
      forest: 'forest.hdr',
      city: 'city.hdr',
      warehouse: 'warehouse.hdr'
    };

    const hdrCache = {};
    const rgbeLoader = new RGBELoader();

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);

    const mainLight = new THREE.DirectionalLight(0xffffff, 1.5);
    mainLight.position.set(5, 10, 7);
    mainLight.castShadow = true;
    mainLight.shadow.mapSize.width = 2048;
    mainLight.shadow.mapSize.height = 2048;
    mainLight.shadow.camera.near = 0.1;
    mainLight.shadow.camera.far = 50;
    mainLight.shadow.camera.left = -10;
    mainLight.shadow.camera.right = 10;
    mainLight.shadow.camera.top = 10;
    mainLight.shadow.camera.bottom = -10;
    mainLight.shadow.radius = 2;
    mainLight.shadow.bias = -0.0001;
    scene.add(mainLight);

    const fillLight = new THREE.DirectionalLight(0x8888ff, 0.5);
    fillLight.position.set(-5, 5, -5);
    scene.add(fillLight);

    const rimLight = new THREE.DirectionalLight(0xffffff, 0.8);
    rimLight.position.set(0, 5, -10);
    scene.add(rimLight);

    // ============================================================
    // CONFIGURACIÓN HDR
    // ============================================================
    const lightConfigs = {
      studio: {
        ambient: { color: 0xffffff, intensity: 0.6 },
        main: { color: 0xffffff, intensity: 1.5, pos: [5, 10, 7] },
        fill: { color: 0xcccccc, intensity: 0.4, pos: [-5, 5, -5] },
        rim: { color: 0xffffff, intensity: 0.8, pos: [0, 5, -10] }
      },
      sunset: {
        ambient: { color: 0xffa07a, intensity: 0.4 },
        main: { color: 0xff8c00, intensity: 2.0, pos: [-8, 3, 5] },
        fill: { color: 0xff6347, intensity: 0.6, pos: [5, 2, -5] },
        rim: { color: 0xffd700, intensity: 1.0, pos: [0, 8, -8] }
      },
      night: {
        ambient: { color: 0x1a1a2e, intensity: 0.3 },
        main: { color: 0x4a69bd, intensity: 1.0, pos: [5, 10, 7] },
        fill: { color: 0x6c5ce7, intensity: 0.5, pos: [-5, 5, -5] },
        rim: { color: 0x00cec9, intensity: 0.6, pos: [0, 5, -10] }
      },
      forest: {
        ambient: { color: 0x2d5016, intensity: 0.5 },
        main: { color: 0x90EE90, intensity: 1.2, pos: [3, 12, 5] },
        fill: { color: 0x228B22, intensity: 0.4, pos: [-5, 5, -5] },
        rim: { color: 0xADFF2F, intensity: 0.7, pos: [0, 5, -10] }
      },
      city: {
        ambient: { color: 0x2c3e50, intensity: 0.4 },
        main: { color: 0x3498db, intensity: 1.3, pos: [5, 10, 7] },
        fill: { color: 0x9b59b6, intensity: 0.5, pos: [-5, 5, -5] },
        rim: { color: 0xe74c3c, intensity: 0.6, pos: [0, 5, -10] }
      },
      warehouse: {
        ambient: { color: 0xffffff, intensity: 0.8 },
        main: { color: 0xffffff, intensity: 1.8, pos: [0, 15, 0] },
        fill: { color: 0xeeeeee, intensity: 0.6, pos: [-5, 5, -5] },
        rim: { color: 0xffffff, intensity: 0.4, pos: [0, 5, -10] }
      }
    };

    function loadHDR(hdrName) {
      const path = hdrPaths[hdrName];
      
      if (hdrCache[hdrName]) {
        applyEnvironment(hdrCache[hdrName]);
        return;
      }

      rgbeLoader.load(
        path,
        (texture) => {
          texture.mapping = THREE.EquirectangularReflectionMapping;
          hdrCache[hdrName] = texture;
          applyEnvironment(texture);
        },
        undefined,
        () => {
          applySimulatedLighting(hdrName);
        }
      );
    }

    function applyEnvironment(texture) {
      scene.environment = texture;
    }

    function applySimulatedLighting(hdrName) {
      scene.environment = null;
      const config = lightConfigs[hdrName] || lightConfigs.studio;

      ambientLight.color.setHex(config.ambient.color);
      ambientLight.intensity = config.ambient.intensity;

      mainLight.color.setHex(config.main.color);
      mainLight.intensity = config.main.intensity;
      mainLight.position.set(...config.main.pos);

      fillLight.color.setHex(config.fill.color);
      fillLight.intensity = config.fill.intensity;
      fillLight.position.set(...config.fill.pos);

      rimLight.color.setHex(config.rim.color);
      rimLight.intensity = config.rim.intensity;
      rimLight.position.set(...config.rim.pos);
    }

    function updateLightUI() {
      const light = lightTypes[currentLightIndex];
      document.getElementById('light-name').textContent = light.name;
      document.getElementById('light-svg').innerHTML = lightIcons[light.id];
      loadHDR(light.id);
    }

    // Light navigation
    document.getElementById('prev-light').addEventListener('click', () => {
      currentLightIndex = (currentLightIndex - 1 + lightTypes.length) % lightTypes.length;
      updateLightUI();
    });

    document.getElementById('next-light').addEventListener('click', () => {
      currentLightIndex = (currentLightIndex + 1) % lightTypes.length;
      updateLightUI();
    });

    // ============================================================
    // AJUSTES HDR
    // ============================================================
    const hdrRotationSlider = document.getElementById('hdr-rotation');
    const hdrExposureSlider = document.getElementById('hdr-exposure');
    const lightIntensitySlider = document.getElementById('light-intensity');
    const ambientIntensitySlider = document.getElementById('ambient-intensity');
    // Shadows se mantienen activas (UI de "Shadows" eliminada)
    const shadowsEnabled = true;

    hdrRotationSlider.addEventListener('input', (e) => {
      const hdrRotation = parseFloat(e.target.value);
      const radians = THREE.MathUtils.degToRad(hdrRotation);
      mainLight.position.set(
        5 * Math.cos(radians) - 7 * Math.sin(radians),
        10,
        5 * Math.sin(radians) + 7 * Math.cos(radians)
      );
      fillLight.position.set(
        -5 * Math.cos(radians) + 5 * Math.sin(radians),
        5,
        -5 * Math.sin(radians) - 5 * Math.cos(radians)
      );
      rimLight.position.set(
        -10 * Math.sin(radians),
        5,
        -10 * Math.cos(radians)
      );
    });

    hdrExposureSlider.addEventListener('input', (e) => {
      renderer.toneMappingExposure = parseFloat(e.target.value);
    });

    lightIntensitySlider.addEventListener('input', (e) => {
      const intensity = parseFloat(e.target.value);
      mainLight.intensity = 1.5 * intensity;
      fillLight.intensity = 0.5 * intensity;
      rimLight.intensity = 0.8 * intensity;
    });

    ambientIntensitySlider.addEventListener('input', (e) => {
      ambientLight.intensity = parseFloat(e.target.value);
    });

    // Shadow blur se deja fijo por código (antes era UI)
    mainLight.shadow.radius = 2;


    // ============================================================
    // VISIBILITY TOGGLES (GRID / UI)
    // ============================================================
    const gridToggle = document.getElementById('grid-toggle');
    const uiToggle = document.getElementById('ui-toggle');
    const uiRestore = document.getElementById('ui-restore');
    const uiRestoreToggle = document.getElementById('ui-restore-toggle');

    let uiEnabled = true;

    function setGridEnabled(enabled) {
      gridEnabled = enabled;
      if (gridToggle) gridToggle.classList.toggle('active', gridEnabled);
      // Force hide when disabled (animate loop keeps fade behavior when enabled)
      if (!gridEnabled) {
        gridGroup.visible = false;
      }
    }

    function setUIEnabled(enabled) {
      uiEnabled = enabled;
      document.body.classList.toggle('ui-hidden', !uiEnabled);

      if (uiToggle) uiToggle.classList.toggle('active', uiEnabled);
      // Floating toggle is always visible: active when UI is visible
      if (uiRestoreToggle) uiRestoreToggle.classList.toggle('active', uiEnabled);
    }

    if (gridToggle) {
      gridToggle.addEventListener('click', () => {
        setGridEnabled(!gridEnabled);
      });
    }

    if (uiToggle) {
      uiToggle.addEventListener('click', () => {
        setUIEnabled(!uiEnabled);
      });
    }

    if (uiRestore) {
      uiRestore.addEventListener('click', () => {
        setUIEnabled(!uiEnabled);
      });
    }

    // Init
    setGridEnabled(true);
    setUIEnabled(true);

    // ============================================================
    // RENDER MODE DROPDOWN
    // ============================================================
    const renderDropdownBtn = document.getElementById('render-dropdown-btn');
    const renderDropdownMenu = document.getElementById('render-dropdown-menu');

    renderDropdownBtn.addEventListener('click', () => {
      renderDropdownBtn.classList.toggle('open');
      renderDropdownMenu.classList.toggle('open');
    });

    document.addEventListener('click', (e) => {
      if (!renderDropdownBtn.contains(e.target) && !renderDropdownMenu.contains(e.target)) {
        renderDropdownBtn.classList.remove('open');
        renderDropdownMenu.classList.remove('open');
      }
    });

    document.querySelectorAll('.render-option').forEach(btn => {
      btn.addEventListener('click', () => {
        const mode = btn.dataset.mode;
        setRenderMode(mode);
        document.getElementById('current-render-mode').textContent = btn.textContent;
        document.querySelectorAll('.render-option').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        renderDropdownBtn.classList.remove('open');
        renderDropdownMenu.classList.remove('open');
      });
    });

    function setRenderMode(mode) {
      if (!currentModel) return;

      // Compatibilidad: nombres antiguos
      if (mode === 'render') mode = 'composite';
      if (mode === 'ao') mode = 'ambientOcclusion';
      // Compatibilidad: variantes de texto
      if (mode === 'ambient occlusion') mode = 'ambientOcclusion';
      if (mode === 'ambient-occlusion') mode = 'ambientOcclusion';

      currentRenderMode = mode;

      currentModel.traverse((child) => {
        if (child.isMesh) {
          if (originalMaterials.has(child.uuid)) {
            child.material = originalMaterials.get(child.uuid);
          }

          const originalMat = child.material;

          switch (mode) {
            case 'composite':
              child.material.wireframe = false;
              break;
            case 'albedo':
              if (originalMat.map) {
                child.material = new THREE.MeshBasicMaterial({ map: originalMat.map, side: originalMat.side });
              } else if (originalMat.color) {
                child.material = new THREE.MeshBasicMaterial({ color: originalMat.color, side: originalMat.side });
              }
              break;
            case 'roughness':
              if (originalMat.roughnessMap) {
                child.material = new THREE.MeshBasicMaterial({ map: originalMat.roughnessMap, side: originalMat.side });
              } else {
                const roughnessValue = originalMat.roughness !== undefined ? originalMat.roughness : 0.5;
                child.material = new THREE.MeshBasicMaterial({ color: new THREE.Color(roughnessValue, roughnessValue, roughnessValue), side: originalMat.side });
              }
              break;
            case 'metallic':
              if (originalMat.metalnessMap) {
                child.material = new THREE.MeshBasicMaterial({ map: originalMat.metalnessMap, side: originalMat.side });
              } else {
                const metalnessValue = originalMat.metalness !== undefined ? originalMat.metalness : 0;
                child.material = new THREE.MeshBasicMaterial({ color: new THREE.Color(metalnessValue, metalnessValue, metalnessValue), side: originalMat.side });
              }
              break;
            case 'normal':
              if (originalMat.normalMap) {
                child.material = new THREE.MeshBasicMaterial({ map: originalMat.normalMap, side: originalMat.side });
              } else {
                child.material = new THREE.MeshBasicMaterial({ color: 0x8080ff, side: originalMat.side });
              }
              break;
            case 'ambientOcclusion':
              if (originalMat.aoMap) {
                child.material = new THREE.MeshBasicMaterial({ map: originalMat.aoMap, side: originalMat.side });
              } else {
                child.material = new THREE.MeshBasicMaterial({ color: 0xffffff, side: originalMat.side });
              }
              break;
            case 'emissive':
              if (originalMat.emissiveMap) {
                child.material = new THREE.MeshBasicMaterial({ map: originalMat.emissiveMap, side: originalMat.side });
              } else if (originalMat.emissive) {
                child.material = new THREE.MeshBasicMaterial({ color: originalMat.emissive, side: originalMat.side });
              } else {
                child.material = new THREE.MeshBasicMaterial({ color: 0x000000, side: originalMat.side });
              }
              break;
            case 'wireframe':
              child.material = originalMaterials.get(child.uuid).clone();
              child.material.wireframe = true;
              break;
          }
        }
      });
    }

    // ============================================================
    // GALERÍA Y UI
    // ============================================================
    function createGalleryUI() {
      galleryItems.innerHTML = '';
      if (!hasModels()) return;
      
      modelsGallery.forEach((model, index) => {
        const item = document.createElement('div');
        item.className = `gallery-item ${index === currentModelIndex ? 'active' : ''}`;
        item.dataset.index = index;
        
        if (model.thumbnail) {
          item.innerHTML = `<img src="${model.thumbnail}" alt="${model.name}">`;
        } else {
          item.innerHTML = `<span class="gallery-number">${String(index + 1).padStart(2, '0')}</span>`;
        }
        
        item.addEventListener('click', () => loadModelByIndex(index));
        galleryItems.appendChild(item);
      });
    }

    function updateSoftwareIcons(softwareList) {
      document.querySelectorAll('.software-icon').forEach(icon => {
        const software = icon.dataset.software;
        icon.classList.toggle('visible', softwareList.includes(software));
      });
    }

    function updateTechSpecs(specs) {
      const techSpecs = document.getElementById('tech-specs');
      techSpecs.innerHTML = '';
      
      Object.entries(specs).forEach(([label, value]) => {
        const row = document.createElement('div');
        row.className = 'spec-row';
        row.innerHTML = `<span class="spec-label">${label}</span><span class="spec-value">${value}</span>`;
        techSpecs.appendChild(row);
      });
    }

    function updateModelInfo(modelData) {
      document.getElementById('model-name').textContent = modelData.name;
      updateTechSpecs(modelData.specs);
      updateSoftwareIcons(modelData.software);
      
      document.querySelectorAll('.gallery-item').forEach((item, index) => {
        item.classList.toggle('active', index === currentModelIndex);
      });
    }

    function loadModelByIndex(index) {
      if (!hasModels()) return;
      if (index < 0 || index >= modelsGallery.length) return;
      currentModelIndex = index;
      const modelData = modelsGallery[index];
      updateModelInfo(modelData);
      loadModel(modelData.path);
    }

    document.getElementById('prev-model').addEventListener('click', () => {
      if (!hasModels()) return;
      const newIndex = (currentModelIndex - 1 + modelsGallery.length) % modelsGallery.length;
      loadModelByIndex(newIndex);
    });

    document.getElementById('next-model').addEventListener('click', () => {
      if (!hasModels()) return;
      const newIndex = (currentModelIndex + 1) % modelsGallery.length;
      loadModelByIndex(newIndex);
    });

    document.addEventListener('keydown', (e) => {
      if (!hasModels()) return;
      if (e.key === 'ArrowLeft') {
        const newIndex = (currentModelIndex - 1 + modelsGallery.length) % modelsGallery.length;
        loadModelByIndex(newIndex);
      } else if (e.key === 'ArrowRight') {
        const newIndex = (currentModelIndex + 1) % modelsGallery.length;
        loadModelByIndex(newIndex);
      }
    });

    // ============================================================
    // CONTROLES DE ANIMACIÓN
    // ============================================================
    const playBtn = document.getElementById('play-btn');
    const stopBtn = document.getElementById('stop-btn');
    const resetBtn = document.getElementById('reset-btn');
    const animSelect = document.getElementById('anim-select');

    function setupAnimationControls(clips) {
      if (clips.length === 0) {
        playBtn.disabled = true;
        stopBtn.disabled = true;
        resetBtn.disabled = true;
        animSelect.disabled = true;
        animSelect.innerHTML = '<option>Sin animaciones</option>';
        return;
      }

      playBtn.disabled = false;
      stopBtn.disabled = false;
      resetBtn.disabled = false;
      animSelect.disabled = false;

      animSelect.innerHTML = '';
      clips.forEach((clip, index) => {
        const option = document.createElement('option');
        option.value = index;
        option.textContent = clip.name || `Animation ${index + 1}`;
        animSelect.appendChild(option);
      });

      playAnimation(0);
    }

    function playAnimation(index) {
      if (!mixer || !animations[index]) return;

      if (currentAction) {
        currentAction.fadeOut(0.3);
      }

      currentAction = mixer.clipAction(animations[index]);
      currentAction.reset();
      currentAction.fadeIn(0.3);
      currentAction.play();
      
      isPlaying = true;
      updatePlayButton();
    }

    function togglePlay() {
      if (!currentAction) return;

      if (isPlaying) {
        currentAction.paused = true;
        isPlaying = false;
      } else {
        currentAction.paused = false;
        isPlaying = true;
      }
      updatePlayButton();
    }

    function stopAnimation() {
      if (!currentAction) return;
      currentAction.stop();
      currentAction.reset();
      isPlaying = false;
      updatePlayButton();
    }

    function resetAnimation() {
      if (!currentAction) return;
      currentAction.reset();
      currentAction.play();
      isPlaying = true;
      updatePlayButton();
    }

    function updatePlayButton() {
      const playIcon = document.getElementById('play-icon');
      const pauseIcon = document.getElementById('pause-icon');
      playIcon.style.display = isPlaying ? 'none' : 'block';
      pauseIcon.style.display = isPlaying ? 'block' : 'none';
    }

    playBtn.addEventListener('click', togglePlay);
    stopBtn.addEventListener('click', stopAnimation);
    resetBtn.addEventListener('click', resetAnimation);
    animSelect.addEventListener('change', (e) => playAnimation(parseInt(e.target.value)));

    // ============================================================
    // CARGA DE MODELOS
    // ============================================================
    const gltfLoader = new GLTFLoader();

    function loadModel(path) {
      loading.style.display = 'block';
      loading.innerHTML = `<div class="loading-spinner"></div>Cargando modelo...`;

      if (currentModel) {
        scene.remove(currentModel);
        currentModel = null;
      }

      if (mixer) {
        mixer.stopAllAction();
        mixer = null;
      }
      animations = [];
      currentAction = null;
      originalMaterials.clear();

      gltfLoader.load(
        path,
        (gltf) => {
          currentModel = gltf.scene;
          
          const box = new THREE.Box3().setFromObject(currentModel);
          const center = box.getCenter(new THREE.Vector3());
          const size = box.getSize(new THREE.Vector3());
          
          const maxDim = Math.max(size.x, size.y, size.z);
          const scale = 2 / maxDim;
          currentModel.scale.multiplyScalar(scale);
          
          currentModel.position.x = -center.x * scale;
          currentModel.position.y = -center.y * scale + 0.5;
          currentModel.position.z = -center.z * scale;
          
          currentModel.traverse((child) => {
            if (child.isMesh) {
              child.castShadow = shadowsEnabled;
              child.receiveShadow = shadowsEnabled;
              originalMaterials.set(child.uuid, child.material.clone());
            }
          });
          
          scene.add(currentModel);
          loading.style.display = 'none';

          animations = gltf.animations;
          if (animations && animations.length > 0) {
            mixer = new THREE.AnimationMixer(currentModel);
            setupAnimationControls(animations);
          } else {
            setupAnimationControls([]);
          }

          currentRenderMode = 'composite';
          document.getElementById('current-render-mode').textContent = 'Composite';
          document.querySelectorAll('.render-option').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.mode === 'composite');
          });

          camera.position.set(0, 1, 5);
          controls.target.set(0, 0.5, 0);
          controls.update();
        },
        (progress) => {
          if (progress.total > 0) {
            const percent = (progress.loaded / progress.total * 100).toFixed(0);
            loading.innerHTML = `<div class="loading-spinner"></div>Cargando... ${percent}%`;
          }
        },
        (error) => {
          console.error('Error cargando modelo:', error);
          loading.innerHTML = 'Error al cargar el modelo<br><small>Verifica la ruta del archivo .glb</small>';
        }
      );
    }

    // ============================================================
    // INICIALIZACIÓN
    // ============================================================
    async function start() {
      modelsGallery = await loadModelsGallery();
      createGalleryUI();
      updateLightUI();
      loadModelByIndex(0);
    }
    start();

    function animate() {
      requestAnimationFrame(animate);
      
      const delta = clock.getDelta();
      if (mixer) mixer.update(delta);

      // FPS counter
      frameCount++;
      const currentTime = performance.now();
      if (currentTime - lastTime >= 1000) {
        fps = Math.round(frameCount * 1000 / (currentTime - lastTime));
        const fpsEl = document.getElementById("fps-value");
        if (fpsEl) fpsEl.textContent = fps;
        frameCount = 0;
        lastTime = currentTime;
      }
      
      // Grid fade when camera goes below floor
      const cameraY = camera.position.y;
      const targetOpacity = cameraY > 0 ? 1 : 0;
      gridOpacity += (targetOpacity - gridOpacity) * 0.1;

      if (gridEnabled) {
        gridHelper.material.opacity = 0.4 * gridOpacity;
        gridHelperFine.material.opacity = 0.2 * gridOpacity;
        xAxisMaterial.opacity = 0.6 * gridOpacity;
        zAxisMaterial.opacity = 0.6 * gridOpacity;
        groundMaterial.uniforms.uOpacity.value = 0.3 * gridOpacity;
        gridGroup.visible = gridOpacity > 0.01;
      } else {
        gridGroup.visible = false;
      }
      
      controls.update();
      renderer.render(scene, camera);
    }
    animate();

    window.addEventListener('resize', () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    });
