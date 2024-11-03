import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.169.0/build/three.module.js";
import { GLTFLoader } from "https://cdn.jsdelivr.net/npm/three@0.169.0/examples/jsm/loaders/GLTFLoader.js";
import { GLTFObject } from "./object/object.js";
import { RGBELoader } from "https://cdn.jsdelivr.net/npm/three@0.169.0/examples/jsm/loaders/RGBELoader.js";
import Zombie from "./object/zombie.js";
import MiniMap from "../hud/minimap.js";
import { ShootingMechanism } from "./shooting.js";
import GameState from "../gameState.js";
import { Sky } from 'three/addons/objects/Sky.js';

// Vertex shader
const vertexShader = `
varying vec2 vUv;
varying vec3 vNormal;

void main() {
    vUv = uv;
    vNormal = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

// Fragment shader with basic lighting
const fragmentShader = `
uniform sampler2D brickTexture;
uniform vec3 lightPosition;

varying vec2 vUv;
varying vec3 vNormal;

void main() {
    vec3 lightDir = normalize(lightPosition);
    float diffuse = max(dot(vNormal, lightDir), 0.0);
    
    vec4 textureColor = texture2D(brickTexture, vUv);
    vec3 ambient = textureColor.rgb * 0.3;
    vec3 finalColor = ambient + textureColor.rgb * diffuse;
    
    gl_FragColor = vec4(finalColor, 1.0);
}
`;

class Scene {
  constructor() {
    this.scene = new THREE.Scene();
     const fogColor = 0xcccccc;  // Light gray color
     const fogNear = 10;  // Distance at which the fog starts
     const fogFar = 1000;  // Distance at which the fog is fully opaque
     this.scene.fog = new THREE.Fog(fogColor, fogNear, fogFar);
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
    //this.ambientLight = new THREE.AmbientLight(0x404040);
    //this.scene.add(this.ambientLight);

    this.ambient = new THREE.HemisphereLight(0xffffff, 0xbbbbff, 1);
    this.scene.add(this.ambient);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.directionalLight = new THREE.DirectionalLight(0x00008b, 1);
    this.directionalLight.position.set(0, 100, 10);
    this.directionalLight.castShadow = true;
    this.directionalLight.shadow.mapSize.width = 4096; // Larger shadow map
    this.directionalLight.shadow.mapSize.height = 4096;
    const d = 1000;
    this.directionalLight.shadow.camera.left = - d;
    this.directionalLight.shadow.camera.right = d;
    this.directionalLight.shadow.camera.top = d;
    this.directionalLight.shadow.camera.bottom = - d;
    this.directionalLight.shadow.camera.near = 1;
    this.directionalLight.shadow.camera.far = 5000;
    this.directionalLight.shadow.bias = -0.001;
    this.directionalLight.shadow.normalBias = 0.02;
    this.scene.add(new THREE.CameraHelper(this.directionalLight.shadow.camera))
    this.scene.add(this.directionalLight);

    this.scene.fog = new THREE.FogExp2(0x11111f,0.002);
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

    this.shooter = new ShootingMechanism(this);
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
    const skyboxGeo = new THREE.BoxGeometry(10000, 10000, 10000);
    const skybox = new THREE.Mesh(skyboxGeo);
    this.scene.add(skybox);
    this.skybox = skybox;
    // Prevent context menu on right click
    // this.renderer.domElement.addEventListener("contextmenu", (e) =>
    //   e.preventDefault(),
    // );
  }

  createPathStrings(filename) {
    const basePath = "./skybox/";
    const baseFilename = basePath + filename;
    const fileType = ".png";
    const sides = ["ft", "bk", "up", "dn", "rt", "lf"];
    const pathStings = sides.map(side => {
      return baseFilename + "_" + side + fileType;
    });
  
    return pathStings;
  }

  async init() {
    ////this.initializeRainAndLighting();
    
    

    this.generateTerrain();
    this.positionCameraAboveTerrain();
    // this.addZombie();

    this.loadImmutableObjects();

 
    this.loadBuildings();
    
    this.loadTower();
    this.loadGarage();
    this.loadBodybag();
    //this.loadShakaZulu();
    this.loadHospital();
    this.loadBuild();
    //this.loadCone();
    this.loadcar();
    this.loadHospital();
   // this.loadTombstone();
    this.loadTombstoneTwo();
    this.loadWall();
    this.loadtree();
    this.loadtree2();
    //this.loadshortwalls();
    this.loadwallset();
    this.loadwallsetl();
    //this.loadstreetlight();
    //this.loadZombie();
    //this.loadstairtower();
    this.gameState.startNewWave();

    this.animate();
    this.animate2();
    this.animateRain();
    //this.initSky();
  }

  loadstairtower(){
    // Tower structure
const towerGeometry = new THREE.CylinderGeometry(5, 5, 20, 32);
const towerMaterial = new THREE.MeshPhongMaterial({ color: 0x808080 });
const tower = new THREE.Mesh(towerGeometry, towerMaterial);
this.scene.add(tower);

// Create spiral stairs
function createStairs() {
    const stairsGroup = new THREE.Group();
    const stepsCount = 20;
    const radiusStart = 2;
    const heightStep = 0.8;
    const angleStep = (Math.PI * 2) / (stepsCount / 2);

    for (let i = 0; i < stepsCount; i++) {
        const stepGeometry = new THREE.BoxGeometry(2, 0.2, 0.8);
        const stepMaterial = new THREE.MeshPhongMaterial({ color: 0x8b4513 });
        const step = new THREE.Mesh(stepGeometry, stepMaterial);

        // Position each step in a spiral
        const angle = i * angleStep;
        const radius = radiusStart;
        const height = i * heightStep;

        step.position.x = Math.cos(angle) * radius;
        step.position.y = height - 8; // Start from bottom of tower
        step.position.z = Math.sin(angle) * radius;

        // Rotate step to face center
        step.rotation.y = -angle;

        stairsGroup.add(step);
    }
    return stairsGroup;
}

const stairs = createStairs();
stairs.scale(5,5,5);
stairs.position(0,0,0);
this.scene.add(stairs);
  }

  loadtree() {
    const gltfLoader = new GLTFLoader();
    let scene;
    gltfLoader.load("/dark_tree_-_dol_guldur.glb", (gltf) => {
      scene = gltf.scene;
      scene.scale.set(5, 5, 5); // Adjust scale if needed
      scene.position.set(750, 0, 700); // Position thxv
      //700, 0, -300
      scene.traverse((child) => {
        if (child.isMesh) {
          child.castShadow = true;
          child.receiveShadow = true;
        }
      });

      this.scene.add(scene);
      const boundingBox = new THREE.Box3().setFromObject(scene);
      this.objectsToCheck.push({ object: scene, boundingBox: boundingBox });
    });
  }

  loadtree2() {
    const gltfLoader = new GLTFLoader();
    let scene;
    gltfLoader.load("/dark_tree_-_dol_guldur.glb", (gltf) => {
      scene = gltf.scene;
      scene.scale.set(5, 5, 5); // Adjust scale if needed
      scene.position.set(-750, 0, 700); // Position thxv
      //700, 0, -300
      scene.traverse((child) => {
        if (child.isMesh) {
          child.castShadow = true;
          child.receiveShadow = true;
        }
      });

      this.scene.add(scene);
      const boundingBox = new THREE.Box3().setFromObject(scene);
      this.objectsToCheck.push({ object: scene, boundingBox: boundingBox });
    });
  }

  loadwallset() {
    const gltfLoader = new GLTFLoader();
    let scene;
    gltfLoader.load("/stone_bricks_beige_wall-set.glb", (gltf) => {
      scene = gltf.scene;
      scene.scale.set(100, 100, 100); // Adjust scale if needed
      scene.position.set(-930, 0, 350); // Position thxv
      scene.rotation.y = Math.PI / 2;
      //700, 0, -300
      scene.traverse((child) => {
        if (child.isMesh) {
          child.castShadow = true;
          child.receiveShadow = true;
        }
      });

      this.scene.add(scene);
      const boundingBox = new THREE.Box3().setFromObject(scene);
      this.objectsToCheck.push({ object: scene, boundingBox: boundingBox });
    });
  }loadwallsetl() {
    const gltfLoader = new GLTFLoader();
    let scene;
    gltfLoader.load("/stone_bricks_beige_wall-set.glb", (gltf) => {
      scene = gltf.scene;
      scene.scale.set(100, 100, 100); // Adjust scale if needed
      scene.position.set(400, -10, 950); // Position thxv
      scene.rotation.y = -Math.PI ;
      //700, 0, -300
      scene.traverse((child) => {
        if (child.isMesh) {
          child.castShadow = true;
          child.receiveShadow = true;
        }
      });

      this.scene.add(scene);
      const boundingBox = new THREE.Box3().setFromObject(scene);
      this.objectsToCheck.push({ object: scene, boundingBox: boundingBox });
    });
  }

  loadshortwalls(){
    
  //let wall;
    // Create half wall geometry
  const wallGeometry = new THREE.BoxGeometry(4, 2, 0.3);
  const textureLoader = new THREE.TextureLoader();

  // Load brick texture
  const brickTexture = textureLoader.load('/worn_brick_floor_diff_2k.jpg', (texture) => {
      texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
      texture.repeat.set(2, 1);
  });

  // Create shader material
  const wallMaterial = new THREE.ShaderMaterial({
      uniforms: {
          brickTexture: { value: brickTexture },
          lightPosition: { value: new THREE.Vector3(5, 5, 5) }
      },
      vertexShader: vertexShader,
      fragmentShader: fragmentShader
  });

  // Create mesh
  const wall = new THREE.Mesh(wallGeometry, wallMaterial);
  wall.scale.set(150, 50, 20);
  wall.position.set(300, 0, 950);
  this.scene.add(wall);

  // Add light
  //
  //scene.add(light);

  //this.scene.add(scene);
  }

  loadstreetlight() {
    const gltfLoader = new GLTFLoader();
    let scene;
    gltfLoader.load("/brazilian_streetlight.glb", (gltf) => {
      scene = gltf.scene;
      scene.scale.set(20, 20, 20); // Adjust scale if needed
      scene.position.set(250, 0, 50); // Position th
      this.scene.add(scene);
    // Use SpotLight instead for directional light
    const distance = 0;
    const angle = 4;
    const penumbra = 0.6;
    const decay = 0;
    const spotLight = new THREE.SpotLight(
      0x1fc600,
      2,
      distance,
      Math.PI / angle,
      penumbra,
      decay,
    );
    spotLight.position.set(860, 700, -12);
    // const light = new THREE.SpotLight(0xff0000, 5, 200, Math.PI / 4, 0.5, 2);
    // light.position.set(250, 100, 50); // Position the light
    //spotLight.target.position.set(250, 0, 50); // Aim at the streetlight
    this.scene.add(spotLight);
    //this.scene.add(spotLight.target); // Required to set the spotlight direction

    //Optionally, add a helper to visualize the light
    const lightHelper = new THREE.SpotLightHelper(spotLight);
    this.scene.add(lightHelper);

    // // Enable shadows if needed
    // light.castShadow = true;
    // light.shadow.mapSize.width = 512;
    // light.shadow.mapSize.height = 512;
    // light.shadow.camera.near = 0.5;
    // light.shadow.camera.far = 500;

    // Bounding box for collision check
    const boundingBox = new THREE.Box3().setFromObject(scene);
    this.objectsToCheck.push({ object: scene, boundingBox: boundingBox });

    // Log the scene dimensions
    const box = new THREE.Box3().setFromObject(this.scene);
    console.log("Scene size:", box.getSize(new THREE.Vector3()));
    });
  }

  loadBuildings() {
    const gltfLoader = new GLTFLoader();
    let scene;
    gltfLoader.load("/house.glb", (gltf) => {
      scene = gltf.scene;
      scene.scale.set(20, 20, 20); // Adjust scale if needed
      scene.position.set(-250, 0, 800); // Position th
      scene.traverse((child) => {
        if (child.isMesh) {
          child.castShadow = true;
          child.receiveShadow = true;
          // const boundingBox = new THREE.Box3().setFromObject(child);
          // this.objectsToCheck.push({
          //   mesh: child,
          //   boundingBox: boundingBox});
        }
      });
      this.scene.add(scene);

      const boundingBox = new THREE.Box3().setFromObject(scene);
      const box = new THREE.Box3().setFromObject(this.scene); // Create a bounding box for the whole scene
      console.log("Scene size:", box.getSize(new THREE.Vector3())); // Log the width, height, depth of the scene

      // Add the tower and its bounding box to the objects to check for collision
      this.objectsToCheck.push({ object: scene, boundingBox: boundingBox });
    });
  }
  loadBuild() {
    const loader = new GLTFLoader();
    let fact;
    loader.load("/building.glb", (gltf) => {
      fact = gltf.scene;
      fact.scale.set(25, 25, 25);
      fact.position.set(-600, -5, 0);
      fact.rotation.y = Math.PI / 2;
   
      fact.traverse((child) => {
        if (child.isMesh) {
          child.castShadow = true;
          child.receiveShadow = true;
          // const boundingBox = new THREE.Box3().setFromObject(child);
          // this.objectsToCheck.push({
          //   mesh: child,
          //   boundingBox: boundingBox});
        }
      });
      
      this.scene.add(fact);

      //const boundingBox = new THREE.Box3().setFromObject(fact);
      // fact.traverse((child) => {
      //   if (child.isMesh) {
      //     child.objectsToCheck.push({object: fact, boundingBox: boundingBox});
      //   }
      // });
      // Add the tower and its bounding box to the objects to check for collision
     // this.objectsToCheck.push({ object: fact, boundingBox: boundingBox });
    });
  }
  loadCone() {
    const cylinder = new THREE.Mesh(
        new THREE.CylinderGeometry(2, 2, 10, 64), // Increased radius and height
        new THREE.MeshPhongMaterial({ color: 0x3ea34c })
    );
    cylinder.position.set(0, 5, 0); // Position centered in scene
    cylinder.receiveShadow = true;
    cylinder.castShadow = true;
    this.scene.add(cylinder); // Add directly to the scene like in loadBuildings()

    // Optionally, if you want collision detection for the cone:
    const boundingBox = new THREE.Box3().setFromObject(cylinder);
    this.objectsToCheck.push({ object: cylinder, boundingBox: boundingBox });
}
  loadcar() {
    const gltfLoader = new GLTFLoader();
    let scene;
    gltfLoader.load("/old_car_wreck.glb", (gltf) => {
      scene = gltf.scene;
      scene.scale.set(0.4, 0.4, 0.4); // Adjust scale if needed
      scene.position.set(-90, -1, 200); // Position thxv

      scene.traverse((child) => {
        if (child.isMesh) {
          child.castShadow = true;
          child.receiveShadow = true;
        }
      });

      this.scene.add(scene);
      const boundingBox = new THREE.Box3().setFromObject(scene);
      this.objectsToCheck.push({ object: scene, boundingBox: boundingBox });
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


  loadTombstone() {
    const gltfLoader = new GLTFLoader();
    let ambulance = new GLTFObject(
      "/tombstone_set__1.glb",
      [700, 0, 0],
      [0, 0, 0],
      [50, 50, 50],
      this,
      false,
      false,
    );
  }
  loadTombstoneTwo() {
    const gltfLoader = new GLTFLoader();
    let ambulance = new GLTFObject(
      "/tombstone_set__1.glb",
      [700, 0, -300],
      [0, 0, 0],
      [50, 50, 50],
      this,
      false,
      false,
    );
  }
  

  loadWall(){
    const gltfLoader = new GLTFLoader();
    let wall = new GLTFObject(
      "/wall_08.glb",
      [750, 0, 800],
      [0, Math.PI/2, 0],
      [10, 20, 20],
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
      scene.traverse((child) => {
        if (child.isMesh) {
          child.castShadow = true;
          child.receiveShadow = true;
        }
      });
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
      [-800, -10, -800],
      [0, Math.PI, 0],
      [15, 15, 15],
      this,
      false,
      false,
    );
  }

  loadbusstop(){
    const gltfLoader = new GLTFLoader();
    let bodybag = new GLTFObject(
      "/bus_stop.glb",
      [20, 0, -50],
      [0, Math.PI, 0],
      [15, 15, 15],
      this,
      false,
      false,
    );
  }

  loadambulance(){
    const gltfLoader = new GLTFLoader();
    let bodybag = new GLTFObject(
      "/gas_station.glb",
      [800, 0, -200],
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

  loadRain(){
    const rainGeometry = new THREE.CylinderGeometry(1,1,1,4,1,true);
    let oldRainGeometryScale = 1;

    const rainMaterial = extendMaterial(THREE.MeshLambertMaterial,{
      class: THREE.ShaderMaterial,
    })
  }
  // initSky() {
  //   this.sky = new Sky();
  //   this.sky.scale.setScalar(2000);
  //   this.sky.material.uniforms['turbidity'].value = 10;
  //   this.sky.material.uniforms['rayleigh'].value = 3;
  //   this.sky.material.uniforms['mieCoefficient'].value = 0.08;
  //   this.sky.material.uniforms['mieDirectionalG'].value = 0.8;
  
  //   this.sunPosition = new THREE.Vector3();
  //   this.sky.material.uniforms['sunPosition'].value.copy(this.sunPosition);
  //   this.scene.add(this.sky);
  //   this.directionalLight = new THREE.DirectionalLight(0xffffff, 1);
  //   this.directionalLight.castShadow = true;
  //   this.directionalLight.position.set(0, 10, 500); // Initial position for sunrise
  //   this.scene.add(this.directionalLight);
  //   // Begin the animation for sunrise to sunset
  //   this.createSunAnimation();
  // }
  
  // createSunAnimation() {
  //   const duration = 100000; // Duration for a full sunrise-to-sunset cycle in ms
  //   const radius = 2000; // Radius of sun path
  //   const height = 1000; // Height at which sun moves

  //   const animateSun = () => {
  //       const elapsed = (Date.now() % duration) / duration; // Cycle through 0 to 1
  //       const angle = Math.PI * elapsed; // Map to sunrise-to-sunset angle range

  //       // Calculate x, y, z positions for the sun’s arc
  //       const x = radius * Math.cos(angle);
  //       const z = radius * Math.sin(angle);
  //       const y = height * Math.sin(angle); // Adds a slight arc effect

  //       // Update directional light and sky sun position
  //       this.directionalLight.position.set(x, y, z);
  //       this.sky.material.uniforms['sunPosition'].value.copy(this.directionalLight.position);

  //       requestAnimationFrame(animateSun);
  //   };

  //   animateSun(); // Start the animation
  // } 
  generateTerrain() {
    const noise = new Noise(Math.random());
    const width = 2000;
    const depth = 2000;
    const widthSegments = 2000;
    const depthSegments = 2000;

    // //skybox
    // const textureLoader = new THREE.TextureLoader();
    // const skyboxGeometry = new THREE.BoxGeometry(width, depth, depth);
    // const skyboxMaterial = new THREE.MeshBasicMaterial({
    //   map: textureLoader.load("http://localhost:3000/skybox/WORK.png"),
    //   side: THREE.BackSide,
    //   transparent: true,
    // });
   

    // const skybox = new THREE.Mesh(skyboxGeometry, skyboxMaterial);
    // this.scene.add(skybox);

    //SkyDome
     const textureLoader = new THREE.TextureLoader();
  //   const cloudTexture = textureLoader.load("http://localhost:3000/skybox/overcast.png"); // Path to your cloud texture
    
  //   // Create a hemisphere geometry
  //   const skyDomeGeometry = new THREE.SphereGeometry(width, depth, depth, 0, Math.PI * 2, 0, Math.PI / 2);
  //   const skyDomeMaterial = new THREE.MeshBasicMaterial({
  //       map: cloudTexture,
  //       side: THREE.BackSide, // Render the inside of the dome
  //       transparent: true,
  //   });
    
  //   const skyDome = new THREE.Mesh(skyDomeGeometry, skyDomeMaterial);
  //  // skyDome.position.set(0, 2000, 0); // Position it high above the scene
    
  //   this.scene.add(skyDome);

  // Sky setup using Sky.js
  const sky = new Sky();
  sky.scale.setScalar(2000);
  sky.material.uniforms['turbidity'].value = 0.1;
    sky.material.uniforms['rayleigh'].value = 0.003;
    sky.material.uniforms['mieCoefficient'].value = 0.08;
    sky.material.uniforms['mieDirectionalG'].value = 0.8;

    const sun = new THREE.Vector3();
    sun.copy(this.directionalLight.position);
    sky.material.uniforms[ 'sunPosition' ].value.copy( sun );
    sky.visible = true;
this.scene.add(sky);

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
    //const textureLoader = new THREE.TextureLoader();
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
    this.groundMesh.receiveShadow = true;
    this.scene.add(this.groundMesh);

    
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
      
    // Load cloud texture and create clouds
    const loader = new THREE.TextureLoader();
    loader.load('/textures/smoke.png', (texture) => {
      const cloudGeo = new THREE.PlaneGeometry(500, 500);
      const cloudMaterial = new THREE.MeshLambertMaterial({
        map: texture,
        transparent: true,
        opacity: 0.4
      });

      this.cloudParticles = [];
      // Create multiple clouds
      for (let p = 0; p < 25; p++) {
        const cloud = new THREE.Mesh(cloudGeo, cloudMaterial);
        cloud.position.set(
          Math.random() * 1000 - 500,
          400,
          Math.random() * 1000 - 500
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

  updateRainAndLighting() {
    // Animate clouds
    this.cloudParticles.forEach(cloud => {
      cloud.rotation.z -= 0.001;
    });

    
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
    
    this.skybox.rotation.x += 0.005;
    this.skybox.rotation.y += 0.005;
    requestAnimationFrame(this.animate);
    // if (this.rain && this.flash) {
    //   this.updateRainAndLighting();
    // }
    this.updatePlayerMovement();

    const delta = this.clock.getDelta();
        
        // Update all zombies
        this.zombies.forEach(zombie => {
            zombie.update(delta);
        });
        
        this.renderer.render(this.scene, this.camera);

    //render objects
    this.loadMutableObjects();
   
    this.gameState.updateUI();
    this.renderer.render(this.scene, this.camera);
  };

  animate2 = () => {
    // if (this.gameState.isPaused()){
    //   return;} 
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
