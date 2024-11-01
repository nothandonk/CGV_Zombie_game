import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.169.0/build/three.module.js";
import { GLTFLoader } from "https://cdn.jsdelivr.net/npm/three@0.169.0/examples/jsm/loaders/GLTFLoader.js";
import { GLTFObject } from "./object/object.js";
import { RGBELoader } from "https://cdn.jsdelivr.net/npm/three@0.169.0/examples/jsm/loaders/RGBELoader.js";
import Zombie from "./object/zombie.js";
import MiniMap from "../hud/minimap.js";
import { ShootingMechanism } from "./shooting.js";
import GameState from "../gameState.js";
import { NavigationMesh, PathFinder } from "./object/zombiePathFinding.js";

class Scene {
  constructor() {
    this.scene = new THREE.Scene();
    // const fogColor = 0xcccccc;  // Light gray color
    // const fogNear = 10;  // Distance at which the fog starts
    // const fogFar = 1000;  // Distance at which the fog is fully opaque
    // this.scene.fog = new THREE.Fog(fogColor, fogNear, fogFar);
    this.gameState = new GameState(this);

    this.clock = new THREE.Clock();

    const initialFogColor = 0x4b4b4b; // A medium dark grey
    this.scene.fog = new THREE.Fog(initialFogColor, 50, 1000);
    this.width = window.innerWidth;
    this.height = window.innerHeight;
    this.mouseSensitivity = 0.002;
    this.mouseX = 0;
    this.mouseY = 0;

    // Player state
    this.moveSpeed = 3;
    this.playerHeight = 30;
    this.playerRadius = 0.5;
    this.gravity = 0.05;
    this.jumpForce = 2;
    this.verticalVelocity = 0;

    this.minimap = new MiniMap("minimap-container", {
      size: 150,
      playerColor: "#00ff00",
      enemyColor: "#ff0000",
      obstacleColor: "#666666",
    });

    // Mouse state
    this.mouseButtons = { left: false, right: false };
    this.lastMousePosition = { x: 0, y: 0 };

    // Set up camera
    this.camera = new THREE.PerspectiveCamera(
      45,
      this.width / this.height,
      1,
      3000,
    );
    this.camera.position.set(500, 0, 0);
    this.camera.rotation.y = Math.PI / 2;
    this.camera.lookAt(0, 0, 0);
    this.camera.logarithmicDepthBuffer = true; // Enable logarithmic depth buffer
    this.scene.add(this.camera); // camera will have children, so this is necessary
    this.objects = [];

    this.zombies = [];

    // Set up renderer1
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(this.width, this.height);
    document.body.appendChild(this.renderer.domElement);

    const secondview = document.getElementById("Second_view");
    this.secondRenderer = new THREE.WebGLRenderer();
    this.secondRenderer.setSize(
      secondview.offsetWidth,
      secondview.offsetHeight,
    );
    secondview.appendChild(this.secondRenderer.domElement);

    // this.secondCamera = new THREE.PerspectiveCamera(
    //   90,
    //   secondview.offsetWidth/secondview.offsetHeight,
    //   0.1,
    //   500
    // );

    this.secondCamera = new THREE.OrthographicCamera(
      secondview.offsetWidth / -2,
      secondview.offsetWidth / 2,
      secondview.offsetHeight / 2,
      secondview.offsetHeight / -2,
      1,
      1000,
    );

    this.secondCamera.position.set(0, 3000, 0);

    this.secondCamera.lookAt(0, 0, 0);
    this.secondCamera.rotation.z = Math.PI;
    this.secondCamera.logarithmicDepthBuffer = true;

    // Set up lights
    // this.ambientLight = new THREE.AmbientLight(0x404040);
    // this.scene.add(this.ambientLight);

    this.ambient = new THREE.HemisphereLight(0xffffff, 0xbbbbff, 1);
    this.scene.add(this.ambient);

    // this.directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);
    // this.directionalLight.position.set(50, 50, 50);
    // this.scene.add(this.directionalLight);

    this.scene.fog = new THREE.FogExp2(0x11111f, 0.002);
    this.renderer.setClearColor(this.scene.fog.color);

    // Add world axes helper
    const worldAxesHelper = new THREE.AxesHelper(50);
    this.scene.add(worldAxesHelper);

    // Add player axes helper
    this.playerAxesHelper = new THREE.AxesHelper(5);

    this.scene.add(this.playerAxesHelper);

    // Set up controls
    this.setupControls();

    this.mouseControls = false;

    document.addEventListener("mousemove", this.onMouseMove.bind(this));
    // Lock the pointer when clicking on the canvas
    this.renderer.domElement.addEventListener("click", () => {
      this.renderer.domElement.requestPointerLock();
      this.mouseControls = true;
    });

    // Listen for the keydown event for key presses
    document.addEventListener("keydown", (event) => {
      if (event.key == "Escape") {
        // Check for Escape key
        // Unlock the pointer
        document.exitPointerLock(); // Exit pointer lock
        this.mouseControls = false; // Disable mouse controls
      }
    });

    this.objectsToCheck = [];
    this.playerBoundingBox = new THREE.Box3();

    this.navMesh = new NavigationMesh(this);
    this.pathFinder = new PathFinder(this.navMesh);

    this.shooter = new ShootingMechanism(this);
    this.totalGameAssets = 0;
    this.loadedGameAssets = 0;
    this.loadingProgress = document.getElementById("loading-progress");
    this.chapters = document.querySelectorAll(".loading-screen");
    this.mainMenu = document.getElementById("start-menu");
    this.currentChapter = 0;
  }

  onMouseMove(event) {
    if (document.pointerLockElement === this.renderer.domElement) {
      this.mouseX += event.movementX * this.mouseSensitivity;
      this.mouseY += event.movementY * this.mouseSensitivity;

      // Clamp vertical rotation
      this.mouseY = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, this.mouseY));
    }
  }

  addObject(obj) {
    this.objects = [...this.objects, obj];
    this.scene.add(obj.scene);
  }

  removeObject(id) {
    const newObjects = this.objects.filter((obj) => obj.id != id);
    this.objects = newObjects;
  }

  setupControls() {
    // Keyboard controls
    this.keysPressed = {};

    window.addEventListener(
      "keydown",
      (e) => (this.keysPressed[e.key.toLowerCase()] = true),
    );
    window.addEventListener(
      "keyup",
      (e) => (this.keysPressed[e.key.toLowerCase()] = false),
    );

    // Prevent context menu on right click
    // this.renderer.domElement.addEventListener("contextmenu", (e) =>
    //   e.preventDefault(),
    // );
  }

  async init() {
    this.debug = false; // Set to true to see collision boxes

    if (this.debug) {
      this.helper = new YUKA.EntityManager();
      // Visualize paths and steering
  }

    //this needs to load after world has loaded for some reasons idk
    this.startChapterLoading();
    this.initializeRainAndLighting();
    this.generateTerrain();
    this.positionCameraAboveTerrain();

    this.loadImmutableObjects();

    this.loadBuildings();
    this.loadGravestones();
    this.loadTower();
    this.loadGarage();
    this.loadBodybag();
    this.loadHospital();

    this.loadcar();
    this.loadHospital();

    this.animate();
    this.animate2();
  }

  addCollidableObject(object) {
    const boundingBox = new THREE.Box3().setFromObject(object);
    
    // Add the object and its bounding box to the objects to check for collision
    this.objectsToCheck.push({
        object: object,
        boundingBox: boundingBox
    });

    // Debug visualization
    if (this.debug) {
        const boxHelper = new THREE.Box3Helper(boundingBox, 0x00ff00);
        this.scene.add(boxHelper);
    }
}

  loadBuildings() {
    const gltfLoader = new GLTFLoader();
    let scene;
    gltfLoader.load("/house.glb", (gltf) => {
      scene = gltf.scene;
      scene.scale.set(20, 20, 20); // Adjust scale if needed
      scene.position.set(-250, 0, 800); // Position th
      this.scene.add(scene);

      this.addCollidableObject(scene);
    });
  }
  loadBuild() {
    const loader = new GLTFLoader();
    let fact;
    loader.load("/old_factory_ruin.glb", (gltf) => {
      fact = gltf.scene;
      fact.scale.set(10, 10, 10);
      fact.position.set(-600, -55, -100);
      fact.rotation.y = Math.PI / 2;
      this.scene.add(fact);

      this.addCollidableObject(fact);
    });
  }
  loadpath() {
    const gltfLoader = new GLTFLoader();
    let scene;
    gltfLoader.load("/way_path_blocks.glb", (gltf) => {
      scene = gltf.scene;
      scene.scale.set(600, 200, 0); // Adjust scale if needed
      scene.position.set(550, -100, 0); // Position th
      scene.rotation.x = Math.PI / 2;
      this.scene.add(scene);
    });
  }
  loadcar() {
    const gltfLoader = new GLTFLoader();
    let scene;
    gltfLoader.load("/old_car_wreck.glb", (gltf) => {
      scene = gltf.scene;
      scene.scale.set(0.4, 0.4, 0.4); // Adjust scale if needed
      scene.position.set(-90, 0, 200); // Position thxv
      this.scene.add(scene);
      this.addCollidableObject(scene);
    });
  }

  spawnZombie(position, type) {
    const zombie = new Zombie(this, position, type);
    this.zombies.push(zombie);
    return zombie;
  }

  loadTower() {
    const gltfLoader = new GLTFLoader();
    let tower = new GLTFObject(
      "/old_soviet_radio_tower.glb",
      [800, 0, 0],
      [0, Math.PI, 0],
      [0.5, 0.5, 0.5],
      this,
      false,
      false,
    );
  }

  loadAmbulance() {
    const gltfLoader = new GLTFLoader();
    let ambulance = new GLTFObject(
      "/ambulance.glb",
      [0, 0, 0],
      [0, 0, 0],
      [10, 10, 10],
      this,
      false,
      false,
    );
  }

  loadShakaZulu() {
    const gltfLoader = new GLTFLoader();
    let scene;
    gltfLoader.load("/zulu.glb", (gltf) => {
      scene = gltf.scene;
      scene.scale.set(70, 100, 100); // Adjust scale if needed
      scene.position.set(0, 0, 0); // Position th
      scene.rotation.y = Math.PI / 2;
      this.scene.add(scene);

      //const boundingBox = new THREE.Box3().setFromObject(scene);

      // Add the tower and its bounding box to the objects to check for collision
      //this.objectsToCheck.push({ object: scene, boundingBox: boundingBox });
    });
  }

  loadBodybag() {
    const gltfLoader = new GLTFLoader();
    let bodybag = new GLTFObject(
      "/old_soviet_radio_tower.glb",
      [800, 0, 0],
      [0, Math.PI, 0],
      [0.5, 0.5, 0.5],
      this,
      false,
      false,
    );
  }
  loadGarage() {
    const gltfLoader = new GLTFLoader();
    let bodybag = new GLTFObject(
      "/gas_station.glb",
      [-800, 0, -800],
      [0, Math.PI, 0],
      [15, 15, 15],
      this,
      false,
      false,
    );
  }

  loadHospital() {
    const gltfLoader = new GLTFLoader();
    let hospital = new GLTFObject(
      "/zombie_hospital.glb",
      [500, 0, -800],
      [0, 0, 0],
      [15, 15, 15],
      this,
      false,
      false,
    );
  }

  loadGravestones() {
    const gltfLoader = new GLTFLoader();
    let scene;
    gltfLoader.load("/gravestones.glb", (gltf) => {
      scene = gltf.scene;
      scene.scale.set(10, 10, 10); // Adjust scale if needed
      scene.position.set(0, 0, -150); // Position th
      this.scene.add(scene);

      this.addCollidableObject(scene);
    });
  }
  loadPlayer() {
    // Load the 3D Gun Model using GLTFLoader
    const gltfLoader = new GLTFLoader();
    // const gun = gltfLoader.load(
    //   "/rovelver1.0.0.glb",
    //   (gltf) => {
    //     const gunModel = gltf.scene;
    //     gunModel.scale.set(0.5, 0.5, 0.5); // Adjust scale if needed
    //     gunModel.position.set(0, 5, 0); // Position the gun in the center
    //     gunModel;
    //     this.scene.add(gunModel);
    //   },
    const gun = gltfLoader.load(
      "/remington1100.glb",
      (gltf) => {
        const gunModel = gltf.scene;
        gunModel.scale.set(5, 5, 5); // Adjust scale if needed
        gunModel.position.set(0, 5, 0); // Position the gun in the center
        gunModel;
        this.scene.add(gunModel);
      },
      function (xhr) {
        console.log((xhr.loaded / xhr.total) * 100 + "% loaded"); // Loading progress
      },
      function (error) {
        console.error("An error happened while loading the model", error);
      },
    );
  }

  addWall() {
    const wallWidth = 2000; // Width of the wall
    const wallHeight = 100; // Height of the wall
    const wallDepth = 1; // Depth of the wall (thickness)

    // Create wall geometry
    const wallGeometry = new THREE.BoxGeometry(
      wallWidth,
      wallHeight,
      wallDepth,
    );

    // Load the texture
    const textureLoader = new THREE.TextureLoader();
    const wallTexture = textureLoader.load("worn_brick_floor_diff_2k.jpg"); // Replace with the path to your texture
    wallTexture.wrapS = THREE.RepeatWrapping;
    wallTexture.wrapT = THREE.RepeatWrapping;
    wallTexture.repeat.set(5, 5);
    // Create the material with the texture
    const wallMaterial = new THREE.MeshStandardMaterial({ map: wallTexture });

    // Create the wall mesh
    const wallMesh = new THREE.Mesh(wallGeometry, wallMaterial);

    // Position the wall across the X-axis at y = 0
    wallMesh.position.set(0, 0, 0); // Center it vertically at y = 0
    //wallMesh.rotation.x = Math.PI / 2;
    // Add the wall to the scene
    this.scene.add(wallMesh);
  }

  generateTerrain() {
    const noise = new Noise(Math.random());
    const width = 2000;
    const depth = 2000;
    const widthSegments = 2000;
    const depthSegments = 2000;

    // //skybox
    // // const textureLoader = new THREE.TextureLoader();
    // // const skyboxGeometry = new THREE.BoxGeometry(width, depth, depth);
    // // const skyboxMaterial = new THREE.MeshBasicMaterial({
    // //   map: textureLoader.load("http://localhost:3000/skybox/overcast.png"),
    // //   side: THREE.BackSide,
    // //   transparent: true,
    // // });

    // // const skybox = new THREE.Mesh(skyboxGeometry, skyboxMaterial);
    // // this.scene.add(skybox);
    // const rgbeLoader = new RGBELoader();
    // rgbeLoader.load("/overcast_soil_2_4k.hdr", (hdrTexture) => {
    //   hdrTexture.mapping = THREE.EquirectangularReflectionMapping;
    //   this.scene.environment = hdrTexture;
    //   this.scene.environment.intensity = 0.05;
    //   this.scene.background = hdrTexture; // Set the HDR as the background
    //   //const fogColor = new THREE.Color(0xb0c4de);  // Adjust this color to match your HDR background
    //   //this.scene.fog = new THREE.Fog(fogColor, 100, 1000);
    //   //this.renderer.toneMappingExposure = 0.5;
    //   // Define our dystopian fog color
    //   const dystopianFogColor = new THREE.Color(0x4b4b4b); // Medium dark grey

    //   // Optional: Slightly adjust the fog color based on the HDR
    //   const renderTarget = new THREE.WebGLRenderTarget(1, 1, {
    //     generateMipmaps: false,
    //     type: THREE.HalfFloatType,
    //     format: THREE.RGBAFormat,
    //   });

    //   const renderer = this.renderer;
    //   const cubeCamera = new THREE.CubeCamera(0.1, 10, renderTarget);
    //   cubeCamera.update(renderer, this.scene);

    //   const pixelBuffer = new Float32Array(4);
    //   renderer.readRenderTargetPixels(renderTarget, 0, 0, 1, 1, pixelBuffer);

    //   const hdrColor = new THREE.Color(
    //     Math.pow(pixelBuffer[0], 1 / 2.2),
    //     Math.pow(pixelBuffer[1], 1 / 2.2),
    //     Math.pow(pixelBuffer[2], 1 / 2.2),
    //   );

    //   // Slightly blend the dystopian color with the HDR color
    //   dystopianFogColor.lerp(hdrColor, 0.1); // Only 10% influence from HDR

    //   // Update fog with the dystopian color
    //   this.scene.fog = new THREE.Fog(dystopianFogColor, 50, 1000);

    //   // Adjust the scene's ambient light to match the dystopian atmosphere
    //   if (this.ambient) {
    //     this.ambient.groundColor.copy(dystopianFogColor);
    //     this.ambient.skyColor.copy(dystopianFogColor).multiplyScalar(1.1); // Slightly brighter sky
    //     this.ambient.intensity = 0.7; // Reduce overall ambient light intensity
    //   }

    //   // Adjust the directional light for a more oppressive feel
    //   if (this.directionalLight) {
    //     this.directionalLight.intensity = 0.6; // Reduce directional light intensity
    //     this.directionalLight.color.setHex(0xcccccc); // Slightly warm light color
    //   }

    //   // Adjust the environment map intensity for a more muted look
    //   this.scene.environment = hdrTexture;
    //   this.scene.environment.intensity = 0.5;
    // });

    const geometry = new THREE.PlaneGeometry(
      width,
      depth,
      widthSegments,
      depthSegments,
    );

    const vertices = geometry.attributes.position.array;

    for (let i = 0; i < vertices.length; i += 3) {
      const x = vertices[i];
      const y = vertices[i + 1];
      const lambda = 200; //adjust mountains with this parameter
      const height = noise.perlin2(x / lambda, y / lambda);
      vertices[i + 2] = height * 10;
    }

    geometry.computeVertexNormals();
    // Load the grass texture
    const textureLoader = new THREE.TextureLoader();
    const grassTexture = textureLoader.load("/thesoil.jpg"); // Path to your texture image

    // Optionally, adjust texture properties to repeat it
    grassTexture.wrapS = THREE.RepeatWrapping;
    grassTexture.wrapT = THREE.RepeatWrapping;
    grassTexture.repeat.set(50, 50); // Repeat the texture 10 times across the plane

    // Apply the texture to a material
    const material = new THREE.MeshStandardMaterial({
      map: grassTexture, // Use the texture as the map for the material
      // roughness:0.8,
      color: 0x666666,
    });
    //const material = new THREE.MeshStandardMaterial();

    this.groundMesh = new THREE.Mesh(geometry, material);
    this.groundMesh.rotation.x = -Math.PI / 2;
    this.scene.add(this.groundMesh);

    // Load FBX model
    // const loader = new GLTFLoader();
    // loader.load(
    //   "/textures/stone_floor.glb",
    //   (gltf) => {
    //     const tile = gltf.scene;
    //     tile.scale.set(1, 1, 1); // Scale the tile to fit the ground if necessary

    //     const tileSize = 1; // Adjust based on your GLB model's size
    //     const tilesPerRow = Math.ceil(width / tileSize);
    //     const tilesPerColumn = Math.ceil(width / tileSize);

    //     // Duplicate and position the tiles in a grid to cover the ground
    //     for (let i = 0; i < tilesPerRow; i++) {
    //       for (let j = 0; j < tilesPerColumn; j++) {
    //         const tileClone = tile.clone(); // Clone the tile for each position
    //         tileClone.position.set(
    //           i * tileSize - width / 2 + tileSize / 2,
    //           0,
    //           j * tileSize - width / 2 + tileSize / 2,
    //         );
    //         this.scene.add(tileClone);
    //       }
    //     }
    //   },
    //   undefined,
    //   function (error) {
    //     console.error("An error occurred while loading the GLB model:", error);
    //   },
    // );
  }

  getCurrentChapter() {
    return Array.from(document.querySelectorAll(".loading-screen")).findIndex(
      (screen) => screen.classList.contains("active"),
    );
  }

  updateGameLoadingProgress(loaded, total) {
    this.totalGameAssets = total;
    this.loadedGameAssets = loaded;
    const progress = (loaded / total) * 100;
    this.loadingProgress.textContent = `Loading game assets: ${Math.round(progress)}%`;
  }

  updateLoadingProgress(chapter, progress) {
    const loadingBar = this.chapters[chapter].querySelector(".loading-bar");
    const loadingText = this.chapters[chapter].querySelector(".loading-text");

    loadingBar.style.width = `${progress}%`;
    loadingText.textContent = `Loading Chapter ${chapter + 1}... ${Math.round(progress)}%`;
    if (progress >= 100) {
      this.chapters[chapter].classList.remove("active");
    } else {
      // setTimeout(() => {
      //   this.updateGameLoadingProgress(progress, total);
      // }, 2000);
    }
  }

  startChapterLoading() {
    const chapter = this.currentChapter;
    this.chapters[chapter].classList.add("active");
    let progress = 0;
    const interval = setInterval(() => {
      progress += Math.random() * 15;
      if (progress > 100) {
        progress = 100;
        clearInterval(interval);
      }
      this.updateLoadingProgress(chapter, progress);
    }, 500);
    this.gameState.startNewWave();
  }

  getTerrainHeight(x, z) {
    if (!this.groundMesh) return 0;

    const width = 2000; // Same as the terrain size
    const widthSegments = 2000;
    const heightArray = this.groundMesh.geometry.attributes.position.array;

    // Scale x and z to match terrain coordinates
    const gridX = ((x + width / 2) / width) * widthSegments;
    const gridZ = ((z + width / 2) / width) * widthSegments;

    // Get the integer part of the position and fractional part for interpolation
    const x1 = Math.floor(gridX);
    const z1 = Math.floor(gridZ);
    const x2 = x1 + 1;
    const z2 = z1 + 1;

    // Make sure indices don't exceed the terrain boundaries
    const clampedX1 = Math.max(0, Math.min(x1, widthSegments));
    const clampedZ1 = Math.max(0, Math.min(z1, widthSegments));
    const clampedX2 = Math.max(0, Math.min(x2, widthSegments));
    const clampedZ2 = Math.max(0, Math.min(z2, widthSegments));

    // Get the height values at the four corners around the camera
    const height11 =
      heightArray[(clampedX1 + clampedZ1 * (widthSegments + 1)) * 3 + 2];
    const height12 =
      heightArray[(clampedX1 + clampedZ2 * (widthSegments + 1)) * 3 + 2];
    const height21 =
      heightArray[(clampedX2 + clampedZ1 * (widthSegments + 1)) * 3 + 2];
    const height22 =
      heightArray[(clampedX2 + clampedZ2 * (widthSegments + 1)) * 3 + 2];

    // Fractional distances from the closest grid points
    const fracX = gridX - x1;
    const fracZ = gridZ - z1;

    // Perform bilinear interpolation between the four surrounding points
    const height =
      (1 - fracX) * ((1 - fracZ) * height11 + fracZ * height12) +
      fracX * ((1 - fracZ) * height21 + fracZ * height22);

    return height;
  }

  initializeRainAndLighting() {
    // Initialize lightning flash
    this.flash = new THREE.PointLight(0x062d89, 30, 500, 1.7);
    this.flash.position.set(200, 300, 100);
    this.scene.add(this.flash);

    // Initialize rain geometry
    this.rainGeo = new THREE.BufferGeometry();
    const rainPositions = [];
    this.rainVelocities = [];
    this.rainCOunt = 10000;

    for (let i = 0; i < this.rainCount; i++) {
      rainPositions.push(
        Math.random() * 1000 - 500, // x
        Math.random() * 500 - 250, // y
        Math.random() * 1000 - 500, // z
      );

      this.rainVelocities.push(0, -Math.random() * 0.2 - 0.1, 0);

      // // Store velocity for each raindrop
      // this.rainDrops.push({
      //   velocity: -0.1 - Math.random() * 0.1,
      //   pos: rainPositions.slice(i * 3, (i * 3) + 3)
      // });
    }

    this.rainGeo.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(rainPositions, 3),
    );

    // Create rain material
    const rainMaterial = new THREE.PointsMaterial({
      color: 0xaaaaaa,
      size: 0.1,
      transparent: true,
      opacity: 0.6,
      depthWrite: false,
    });

    // Create rain system
    this.rain = new THREE.Points(this.rainGeo, rainMaterial);
    this.scene.add(this.rain);

    // Load cloud texture and create clouds
    const loader = new THREE.TextureLoader();
    loader.load("/textures/smoke.png", (texture) => {
      const cloudGeo = new THREE.PlaneGeometry(500, 500);
      const cloudMaterial = new THREE.MeshLambertMaterial({
        map: texture,
        transparent: true,
        opacity: 0.4,
      });

      this.cloudParticles = [];
      // Create multiple clouds
      for (let p = 0; p < 25; p++) {
        const cloud = new THREE.Mesh(cloudGeo, cloudMaterial);
        cloud.position.set(
          Math.random() * 1000 - 500,
          400,
          Math.random() * 1000 - 500,
        );
        cloud.rotation.x = 1.16;
        cloud.rotation.y = -0.12;
        cloud.rotation.z = Math.random() * 2 * Math.PI;
        cloud.material.opacity = 0.6;

        this.cloudParticles.push(cloud);
        this.scene.add(cloud);
      }
    });
  }

  // animateRain(){
  //   const rainPositions = this.rainGeo.attributes.position.array;

  //   for (let i = 0; i< rainPositions.length; i+=3){
  //     rainPositions[i+1] == this .rainVelocities[i+1];

  //     if (rainPositions[i+1] < -250){
  //       rainPositions[i+1] = 250;
  //     }
  //   }
  //   this.rainGeo.attributes.position.needsUpdate = true;
  // }
  updateRainAndLighting() {
    // Animate clouds
    this.cloudParticles.forEach((cloud) => {
      cloud.rotation.z -= 0.001;
    });

    // Update rain positions
    const positions = this.rainGeo.attributes.position.array;

    for (let i = 0; i < this.rainCount; i++) {
      const rainDrop = this.rainDrops[i];

      // Update Y position with velocity
      positions[i * 3 + 1] += rainDrop.velocity;

      // Reset raindrop if it falls below certain height
      if (positions[i * 3 + 1] < -200) {
        positions[i * 3 + 1] = 200;
      }
    }

    this.rainGeo.attributes.position.needsUpdate = true;

    // Random lightning effect
    if (Math.random() > 0.93 || this.flash.power > 100) {
      if (this.flash.power < 100) {
        this.flash.position.set(
          Math.random() * 400,
          300 + Math.random() * 200,
          100,
        );
      }
      this.flash.power = 50 + Math.random() * 500;
    }
  }
  _checkBoundary(position, movement) {
    //check each basis to see if we are about to go beyond bounds
    //return adjusted movement vector

    //im just going to add a little bit of padding :)
    let padding = 10;

    let movX = movement.x;
    let movZ = movement.z;
    if (Math.abs(position.x + movement.x) > 950 - padding) {
      movX = 0;
    }
    if (Math.abs(position.z + movement.z) > 950 - padding) {
      movZ = 0;
    }

    return { x: movX, y: 0, z: movZ };
  }

  positionCameraAboveTerrain() {
    const terrainHeight = this.getTerrainHeight(
      this.camera.position.x,
      this.camera.position.z,
    );
    this.camera.position.y = terrainHeight + this.playerHeight;
  }

  updatePlayerMovement() {
    // Get camera's forward direction
    const forward = new THREE.Vector3(0, 0, -1);
    const right = new THREE.Vector3(1, 0, 0);
    forward.applyQuaternion(this.camera.quaternion);
    forward.y = 0; // Keep movement horizontal
    forward.normalize();
    right.applyQuaternion(this.camera.quaternion);
    right.y = 0;
    right.normalize();

    const previousPosition = this.camera.position.clone();
    // Handle movement
    if (this.keysPressed["w"]) {
      const moveAmount = this.moveSpeed;
      let movement = forward.clone().multiplyScalar(moveAmount);
      movement = this._checkBoundary(this.camera.position, movement);
      this.camera.position.add(movement);
    }

    if (this.keysPressed["s"]) {
      const moveAmount = -this.moveSpeed;
      let movement = forward.clone().multiplyScalar(moveAmount);
      movement = this._checkBoundary(this.camera.position, movement);
      this.camera.position.add(movement);
    }

    if (this.keysPressed["d"]) {
      const moveAmount = this.moveSpeed;
      let movement = right.clone().multiplyScalar(moveAmount);
      movement = this._checkBoundary(this.camera.position, movement);
      this.camera.position.add(movement);
    }

    if (this.keysPressed["a"]) {
      const moveAmount = -this.moveSpeed;
      let movement = right.clone().multiplyScalar(moveAmount);
      movement = this._checkBoundary(this.camera.position, movement);
      this.camera.position.add(movement);
    }

    if (this.mouseControls) {
      // Handle rotation (now using mouse input)
      const rotation = new THREE.Euler(0, 0, 0, "YXZ");
      rotation.x = -this.mouseY;
      rotation.y = -this.mouseX;

      this.camera.quaternion.setFromEuler(rotation);
    } else {
      // Create a quaternion to store the rotation
      const rotationSpeed = 0.02; // Adjust this for the rotation speed

      // Get the camera's current rotation as Euler angles
      const rotation = new THREE.Euler().setFromQuaternion(
        this.camera.quaternion,
        "YXZ",
      );

      // Yaw (rotate around the world y-axis)
      if (this.keysPressed["arrowleft"]) {
        rotation.y += rotationSpeed;
      }
      if (this.keysPressed["arrowright"]) {
        rotation.y -= rotationSpeed;
      }

      // Pitch (rotate around the world x-axis)
      if (this.keysPressed["arrowup"]) {
        rotation.x += rotationSpeed;
      }
      if (this.keysPressed["arrowdown"]) {
        rotation.x -= rotationSpeed;
      }

      // Clamp the pitch to prevent over-rotation
      rotation.x = Math.max(
        -Math.PI / 2 + 0.01,
        Math.min(Math.PI / 2 - 0.01, rotation.x),
      );

      // Update the camera's quaternion from the adjusted Euler angles
      this.camera.quaternion.setFromEuler(rotation);
    }

    // Apply gravity and terrain collision
    const terrainHeight = this.getTerrainHeight(
      this.camera.position.x,
      this.camera.position.z,
    );

    const targetHeight = terrainHeight + this.playerHeight;

    // Handle jumping
    if (this.keysPressed[" "] && this.camera.position.y <= targetHeight) {
      this.verticalVelocity = this.jumpForce;
    }

    if (this.camera.position.y > targetHeight) {
      this.verticalVelocity -= this.gravity;
      this.camera.position.y += this.verticalVelocity;
    }

    if (this.camera.position.y < targetHeight) {
      this.camera.position.y = targetHeight;
      this.verticalVelocity = 0;
    }

    // Update player axes helper
    this.playerAxesHelper.position.copy(this.camera.position);
    this.playerAxesHelper.rotation.copy(this.camera.rotation);

    // Update player bounding box
    this.playerBoundingBox.setFromCenterAndSize(
      this.camera.position,
      new THREE.Vector3(
        this.playerRadius * 2,
        this.playerHeight,
        this.playerRadius * 2,
      ),
    );

    // Check for collisions and adjust position if necessary
    if (this.checkCollision()) {
      // If a collision occurred, revert to the previous position
      this.camera.position.copy(previousPosition);
      this.playerBoundingBox.setFromCenterAndSize(
        this.camera.position,
        new THREE.Vector3(
          this.playerRadius * 2,
          this.playerHeight,
          this.playerRadius * 2,
        ),
      );
    }

    this.gameState.updateMinimap(this.minimap);
  }

  loadMutableObjects() {
    this.objects.forEach((obj) => {
      if (obj.mutable) {
        obj.render();
      }
    });
  }

  loadImmutableObjects() {
    this.objects.forEach((obj) => {
      if (!obj.mutable) {
        obj.render();
      }
    });
  }

  animate = () => {
    requestAnimationFrame(this.animate);
    // if (this.rain && this.flash) {
    //   this.updateRainAndLighting();
    // }
    this.updatePlayerMovement();

    const delta = this.clock.getDelta();

    // Update all zombies
    this.zombies.forEach((zombie) => {
      zombie.update(delta);
    });

    this.renderer.render(this.scene, this.camera);

    //render objects
    this.loadMutableObjects();

    this.gameState.updateUI();
    this.renderer.render(this.scene, this.camera);
  };

  animate2 = () => {
    requestAnimationFrame(this.animate2); // Fix: Was calling this.animate instead of this.animate2

    // Update second camera position to follow main camera from above
    this.secondCamera.position.set(
      this.camera.position.x,
      this.camera.position.y + 50, // Position it 50 units above the player
      this.camera.position.z,
    );
    this.secondCamera.lookAt(this.camera.position); // Look at the player

    this.loadMutableObjects();
    this.secondRenderer.render(this.scene, this.secondCamera);
  };
  checkCollision() {
    for (const { boundingBox } of this.objectsToCheck) {
      if (this.playerBoundingBox.intersectsBox(boundingBox)) {
        console.log("Collision detected!");
        return true; // Collision detected
      }
    }
    return false; // No collision
  }
}

export default Scene;
