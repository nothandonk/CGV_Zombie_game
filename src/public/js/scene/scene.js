import Minimap from "../hud/minimap.js";
import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.169.0/build/three.module.js";
import { GLTFLoader } from "https://cdn.jsdelivr.net/npm/three@0.169.0/examples/jsm/loaders/GLTFLoader.js";
import { RGBELoader } from "https://cdn.jsdelivr.net/npm/three@0.169.0/examples/jsm/loaders/RGBELoader.js";



class Scene {
  constructor() {
    this.scene = new THREE.Scene();
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
    

    //minimap
    this.minimap = new Minimap();

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
    this.camera.position.set(0, 0, 0);
    this.camera.lookAt(0, 0, 0);
    this.camera.logarithmicDepthBuffer = true; // Enable logarithmic depth buffer

    // Set up renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(this.width, this.height);
    document.body.appendChild(this.renderer.domElement);

    // Set up lights
    //this.ambientLight = new THREE.AmbientLight(0x404040);
    //this.scene.add(this.ambientLight);

    this.ambient = new THREE.HemisphereLight(0xffffff, 0xbbbbff, 1);
		this.scene.add(this.ambient);

    this.directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);
    this.directionalLight.position.set(50, 50, 50);
    this.scene.add(this.directionalLight);

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
  }

  onMouseMove(event) {
    if (document.pointerLockElement === this.renderer.domElement) {
      this.mouseX += event.movementX * this.mouseSensitivity;
      this.mouseY += event.movementY * this.mouseSensitivity;

      // Clamp vertical rotation
      this.mouseY = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, this.mouseY));
    }
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
    this.generateTerrain();
    this.positionCameraAboveTerrain();
    this.loadPlayer();
    this.addWall();
    //this.loadBuildings();
    this.loadTower();
    //this.loadpath();
    //this.loadcar();
    this.animate();
  }

  loadBuildings() {
    const gltfLoader = new GLTFLoader();
    let scene;
    gltfLoader.load("/house.glb", (gltf) => {
      scene = gltf.scene;
      scene.scale.set(5, 5, 5); // Adjust scale if needed
      scene.position.set(10, 10, 0.); // Position th
      this.scene.add(scene);
    });
  }
  loadpath() {
    const gltfLoader = new GLTFLoader();
    let scene;
    gltfLoader.load("/way_path_blocks.glb", (gltf) => {
      scene = gltf.scene;
      scene.scale.set(600, 200, 20); // Adjust scale if needed
      scene.position.set(550, 10, 0); // Position th
      scene.rotation.x = Math.PI/2;
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
    });
  }

  loadTower(){
    const gltfLoader = new GLTFLoader();
    let tower;
    gltfLoader.load("/old_soviet_radio_tower..glb", (gltf) => {
      tower = gltf.scene;
      tower.scale.set(0.5, 0.5, 0.5);
      tower.position.set(800,0, 0);
      tower.rotation.y = Math.PI;
      this.scene.add(tower);

      const boundingBox = new THREE.Box3().setFromObject(tower);
      
      // Add the tower and its bounding box to the objects to check for collision
      this.objectsToCheck.push({ object: tower, boundingBox: boundingBox });
    });
  }

  loadPlayer() {
    // Load the 3D Gun Model using GLTFLoader
    const gltfLoader = new GLTFLoader();
    const gun = gltfLoader.load(
      "/rovelver1.0.0.glb",
      (gltf) => {
        const gunModel = gltf.scene;
        gunModel.scale.set(0.5, 0.5, 0.5); // Adjust scale if needed
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
    const wallGeometry = new THREE.BoxGeometry(wallWidth, wallHeight, wallDepth);
  
    // Load the texture
    const textureLoader = new THREE.TextureLoader();
    const wallTexture = textureLoader.load('worn_brick_floor_diff_2k.jpg'); // Replace with the path to your texture
  
    // Create the material with the texture
    const wallMaterial = new THREE.MeshStandardMaterial({ map: wallTexture });
  
    // Create the wall mesh
    const wallMesh = new THREE.Mesh(wallGeometry, wallMaterial);
  
    // Position the wall across the X-axis at y = 0
    wallMesh.position.set(0, 0, 0); // Center it vertically at y = 0
    wallMesh.rotation.x = Math.PI/2;
    // Add the wall to the scene
    this.scene.add(wallMesh);
  }

  generateTerrain() {
    const noise = new Noise(Math.random());
    const width = 2000;
    const depth = 2000;
    const widthSegments = 2000;
    const depthSegments = 2000;

    //skybox
    // const textureLoader = new THREE.TextureLoader();
    // const skyboxGeometry = new THREE.BoxGeometry(width, depth, depth);
    // const skyboxMaterial = new THREE.MeshBasicMaterial({
    //   map: textureLoader.load("http://localhost:3000/skybox/overcast.png"),
    //   side: THREE.BackSide,
    //   transparent: true,
    // });

    // const skybox = new THREE.Mesh(skyboxGeometry, skyboxMaterial);
    // this.scene.add(skybox);
    const rgbeLoader = new RGBELoader();
    rgbeLoader.load('/clarens_midday_4k.hdr', (hdrTexture) => {
      hdrTexture.mapping = THREE.EquirectangularReflectionMapping;
      this.scene.environment = hdrTexture;
      this.scene.environment.intensity = 0.05;
      this.scene.background = hdrTexture; // Set the HDR as the background

      //this.renderer.toneMappingExposure = 0.5;
    });


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

    const material = new THREE.MeshStandardMaterial();

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

  placeFencesAlongPerimeter(fence, borderWidth, height, numFences) {
    const spaceSize = 1900;
    const halfSpaceSize = spaceSize / 2;
    const fenceDisplacement = borderWidth / 2; // Displace fences by half their width

    // Calculate the spacing between each fence
    const fenceSpacing = spaceSize / (numFences - 1); // Subtract 1 to include corner fences

    // Loop through each side of the space
    for (let side = 0; side < 4; side++) {
      for (let i = 0; i < numFences; i++) {
        // Calculate the position of the current fence
        let x, z;
        switch (side) {
          case 0: // Top side
            x = fenceSpacing * i - halfSpaceSize;
            z = -halfSpaceSize - fenceDisplacement;
            break;
          case 1: // Right side
            x = halfSpaceSize + fenceDisplacement;
            z = fenceSpacing * i - halfSpaceSize;
            break;
          case 2: // Bottom side
            x = halfSpaceSize - fenceSpacing * i;
            z = halfSpaceSize + fenceDisplacement;
            break;
          case 3: // Left side
            x = -halfSpaceSize - fenceDisplacement;
            z = halfSpaceSize - fenceSpacing * i;
            break;
        }

        const fencePosition = new THREE.Vector3(x, height, z);

        // Clone the fence object to create a new instance
        const newFence = fence.clone();

        // Set the position of the new fence
        newFence.position.copy(fencePosition);

        // Rotate the fence based on the side
        newFence.rotation.y = (Math.PI / 2) * side;

        // Add the new fence to the scene
        this.scene.add(newFence);
      }
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
      new THREE.Vector3(this.playerRadius * 2, this.playerHeight, this.playerRadius * 2)
    );

    // Check for collisions and adjust position if necessary
    if (this.checkCollision()) {
      // If a collision occurred, revert to the previous position
      this.camera.position.copy(previousPosition);
      this.playerBoundingBox.setFromCenterAndSize(
        this.camera.position,
        new THREE.Vector3(this.playerRadius * 2, this.playerHeight, this.playerRadius * 2)
      );
    }
  }

  checkCollision() {
    for (const { boundingBox } of this.objectsToCheck) {
      if (this.playerBoundingBox.intersectsBox(boundingBox)) {
        console.log('Collision detected!');
        return true; // Collision detected
      }
    }
    return false; // No collision
  }
  animate = () => {
    requestAnimationFrame(this.animate);
    this.updatePlayerMovement();
    
    this.renderer.render(this.scene, this.camera);

    //draw minimap
    this.minimap.draw();
  };
}

export default Scene;
