import { OrbitControls } from "https://unpkg.com/three@0.112/examples/jsm/controls/OrbitControls.js";

class Scene {
  constructor() {
    this.scene = new THREE.Scene();
    this.width = window.innerWidth;
    this.height = window.innerHeight;
    this.mouseSensitivity = 0.002;
    this.mouseX = 0;
    this.mouseY = 0;
   

    // Player state
    this.moveSpeed = 0.5;
    this.playerHeight = 2;
    this.gravity = 0.05;
    this.jumpForce = 2;
    this.verticalVelocity = 0;

    // Mouse state
    this.mouseButtons = { left: false, right: false };
    this.lastMousePosition = { x: 0, y: 0 };

    // Set up camera
    this.camera = new THREE.PerspectiveCamera(
      45,
      this.width / this.height,
      1,
      500
    );
    this.camera.position.set(0, 0, 0);
    this.camera.lookAt(0, 0, 0);

    // Set up renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(this.width, this.height);
    document.body.appendChild(this.renderer.domElement);

    // Set up lights
    this.ambientLight = new THREE.AmbientLight(0x404040);
    this.scene.add(this.ambientLight);

    this.directionalLight = new THREE.DirectionalLight(0xffffff, 1);
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
      if (event.key === "Escape") { // Check for Escape key
          // Unlock the pointer
          if (document.pointerLockElement) {
              document.exitPointerLock(); // Exit pointer lock
              this.mouseControls = false; // Disable mouse controls
          }
      }
  });
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
    window.addEventListener("keydown", (e) => (this.keysPressed[e.key] = true));
    window.addEventListener("keyup", (e) => (this.keysPressed[e.key] = false));

    // Prevent context menu on right click
    // this.renderer.domElement.addEventListener("contextmenu", (e) =>
    //   e.preventDefault(),
    // );
  }

  init() {
    this.generateTerrain();
    this.positionCameraAboveTerrain();
    this.animate();
  }

  generateTerrain() {
    const noise = new Noise(Math.random());
    const width = 600;
    const depth = 600;
    const widthSegments = 600;
    const depthSegments = 600;
    const geometry = new THREE.PlaneGeometry(
      width,
      depth,
      widthSegments,
      depthSegments
    );

    const vertices = geometry.attributes.position.array;

    for (let i = 0; i < vertices.length; i += 3) {
      const x = vertices[i];
      const y = vertices[i + 1];
      const lambda = 50;
      const height = noise.perlin2(x / lambda, y / lambda);
      vertices[i + 2] = height * 10;
    }

    geometry.computeVertexNormals();

    const material = new THREE.MeshStandardMaterial({
      color: 0x88cc88,
      wireframe: true,
    });

    this.groundMesh = new THREE.Mesh(geometry, material);
    this.groundMesh.rotation.x = -Math.PI / 2;
    this.scene.add(this.groundMesh);
  }

  getTerrainHeight(x, z) {
    if (!this.groundMesh) return 0;

    const width = 600; // Same as the terrain size
    const widthSegments = 600;
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

  positionCameraAboveTerrain() {
    const terrainHeight = this.getTerrainHeight(
      this.camera.position.x,
      this.camera.position.z
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

    // Handle movement
    if (this.keysPressed["w"]) {
      const moveAmount = this.moveSpeed;
      const movement = forward.clone().multiplyScalar(moveAmount);
      this.camera.position.add(movement);
    }

    if (this.keysPressed["s"]) {
      const moveAmount = -this.moveSpeed;
      const movement = forward.clone().multiplyScalar(moveAmount);
      this.camera.position.add(movement);
    }

    if (this.keysPressed["d"]) {
      const moveAmount = this.moveSpeed;
      const movement = right.clone().multiplyScalar(moveAmount);
      this.camera.position.add(movement);
    }

    if (this.keysPressed["a"]) {
      const moveAmount = -this.moveSpeed;
      const movement = right.clone().multiplyScalar(moveAmount);
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
        "YXZ"
      );

      // Yaw (rotate around the world y-axis)
      if (this.keysPressed["ArrowLeft"]) {
        rotation.y += rotationSpeed;
      }
      if (this.keysPressed["ArrowRight"]) {
        rotation.y -= rotationSpeed;
      }

      // Pitch (rotate around the world x-axis)
      if (this.keysPressed["ArrowUp"]) {
        rotation.x += rotationSpeed;
      }
      if (this.keysPressed["ArrowDown"]) {
        rotation.x -= rotationSpeed;
      }

      // Clamp the pitch to prevent over-rotation
      rotation.x = Math.max(
        -Math.PI / 2 + 0.01,
        Math.min(Math.PI / 2 - 0.01, rotation.x)
      );

      // Update the camera's quaternion from the adjusted Euler angles
      this.camera.quaternion.setFromEuler(rotation);
    }

    // Apply gravity and terrain collision
    const terrainHeight = this.getTerrainHeight(
      this.camera.position.x,
      this.camera.position.z
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
  }

  animate = () => {
    requestAnimationFrame(this.animate);
    this.updatePlayerMovement();
    this.renderer.render(this.scene, this.camera);
  };
}

export default Scene;
