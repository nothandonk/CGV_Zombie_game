import { OrbitControls } from "https://unpkg.com/three@0.112/examples/jsm/controls/OrbitControls.js";

class Scene {
  constructor() {
    this.scene = new THREE.Scene();
    this.width = window.innerWidth;
    this.height = window.innerHeight;

    // Player state
    this.moveSpeed = 1.0;
    this.playerHeight = 2;
    this.gravity = 0.1;
    this.verticalVelocity = 0;
    this.mouseSensitivity = 0.002;

    // Mouse state
    this.mouseButtons = { left: false, right: false };
    this.lastMousePosition = { x: 0, y: 0 };

    // Set up camera
    this.camera = new THREE.PerspectiveCamera(
      45,
      this.width / this.height,
      1,
      500,
    );
    this.camera.position.set(0, 100, 100);
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
  }

  setupControls() {
    // Keyboard controls
    this.keysPressed = {};
    window.addEventListener("keydown", (e) => (this.keysPressed[e.key] = true));
    window.addEventListener("keyup", (e) => (this.keysPressed[e.key] = false));

    // Mouse controls
    this.renderer.domElement.addEventListener("mousedown", (e) => {
      if (e.button === 0) this.mouseButtons.left = true;
      if (e.button === 2) this.mouseButtons.right = true;
      this.lastMousePosition.x = e.clientX;
      this.lastMousePosition.y = e.clientY;
    });

    this.renderer.domElement.addEventListener("mouseup", (e) => {
      if (e.button === 0) this.mouseButtons.left = false;
      if (e.button === 2) this.mouseButtons.right = false;
    });

    this.renderer.domElement.addEventListener("mousemove", (e) => {
      if (this.mouseButtons.left) {
        const deltaX = e.clientX - this.lastMousePosition.x;
        const deltaY = e.clientY - this.lastMousePosition.y;

        this.camera.rotation.y -= deltaX * this.mouseSensitivity;
        this.camera.rotation.x -= deltaY * this.mouseSensitivity;

        // Clamp vertical rotation to prevent over-rotation
        this.camera.rotation.x = Math.max(
          -Math.PI / 2,
          Math.min(Math.PI / 2, this.camera.rotation.x),
        );
      }

      this.lastMousePosition.x = e.clientX;
      this.lastMousePosition.y = e.clientY;
    });

    // Prevent context menu on right click
    this.renderer.domElement.addEventListener("contextmenu", (e) =>
      e.preventDefault(),
    );
  }

  init() {
    this.generateTerrain();
    this.positionCameraAboveTerrain();
    this.animate();
  }

  generateTerrain() {
    const noise = new Noise(Math.random());
    const width = 100;
    const depth = 100;
    const widthSegments = 100;
    const depthSegments = 100;
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
      const lambda = 100;
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

    const widthSegments = 100;
    const heightArray = this.groundMesh.geometry.attributes.position.array;

    const terrainX = x + 50;
    const terrainZ = z + 50;

    const gridX = Math.floor((terrainX / 100) * widthSegments);
    const gridZ = Math.floor((terrainZ / 100) * widthSegments);

    const clampedGridX = Math.max(0, Math.min(gridX, widthSegments));
    const clampedGridZ = Math.max(0, Math.min(gridZ, widthSegments));

    const index = (clampedGridX + clampedGridZ * (widthSegments + 1)) * 3 + 2;
    return heightArray[index] || 0;
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
    forward.applyQuaternion(this.camera.quaternion);
    forward.y = 0; // Keep movement horizontal
    forward.normalize();

    // Handle movement
    if (this.keysPressed["w"] || this.keysPressed["s"]) {
      const moveAmount = this.keysPressed["w"]
        ? this.moveSpeed
        : -this.moveSpeed;
      const movement = forward.clone().multiplyScalar(moveAmount);
      this.camera.position.add(movement);
    }

    // Handle rotation
    const rotationSpeed = 0.03;
    if (this.keysPressed["a"]) {
      this.camera.rotation.y += rotationSpeed;
    }
    if (this.keysPressed["d"]) {
      this.camera.rotation.y -= rotationSpeed;
    }

    // Apply gravity and terrain collision
    const terrainHeight = this.getTerrainHeight(
      this.camera.position.x,
      this.camera.position.z,
    );

    const targetHeight = terrainHeight + this.playerHeight;

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
