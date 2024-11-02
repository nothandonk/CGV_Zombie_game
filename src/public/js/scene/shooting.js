import * as THREE from "three";

export class ShootingMechanism {
  constructor(world) {
    this.camera = world.camera;
    this.scene = world.scene;
    this.raycaster = new THREE.Raycaster();
    this.targets = [];
    this.crosshair = this.createCrosshair();
    this.projectiles = [];
    this.gameState = world.gameState;

    // Gun position relative to camera
    this.gunOffset = new THREE.Vector3(3, -3.2, -10);
    // this.flashOffset = new THREE.Vector3(3, 0, -10);

    //Flashlight
    this.flashlight = new THREE.SpotLight(0xffffff, 10, 100, Math.PI*0.2, 0,0);
    this.camera.add(this.flashlight);
    this.camera.add(this.flashlight.target);
    // this.flashlight.target.position.z = -15;

    const crosshairWorldPos = new THREE.Vector3();
    this.crosshair.getWorldPosition(crosshairWorldPos);
    this.flashlight.target.position.copy(crosshairWorldPos);

    // Add crosshair to camera
    this.camera.add(this.crosshair);
    // Add audio listener to the camera
    this.listener = new THREE.AudioListener();
    this.camera.add(this.listener);

    // Gunshot sound setup
    this.gunshotSound = new THREE.Audio(this.listener);
    this.audioLoader = new THREE.AudioLoader();
    this.audioLoader.load('/audio/pewpew.mp3', (buffer) => {
      this.gunshotSound.setBuffer(buffer);
      this.gunshotSound.setVolume(0.5); // Adjust volume as needed
    });

    // Shooting cooldown
    this.lastShot = 0;
    this.shootingCooldown = 250; // milliseconds

    
    // Animation properties
    this.bulletSpeed = 120; // Units per frame
    this.bulletSize = 0.3; // Size of the bullet block

    // Bind methods
    this.shoot = this.shoot.bind(this);
    this.animate = this.animate.bind(this);

    // Add event listener for shooting
    document.addEventListener("click", this.shoot);

    // Start animation loop
    this.animate();
  }
  

  getGunWorldPosition() {
    // Create a vector for the gun's position
    const gunPos = this.gunOffset.clone();
    // Transform it by the camera's matrix to get world position
    gunPos.applyMatrix4(this.camera.matrixWorld);
    return gunPos;
  }
  // getflashWorldPosition() {
  //   // Create a vector for the gun's position
  //   const gunPos = this.flashOffset.clone();
  //   // Transform it by the camera's matrix to get world position
  //   gunPos.applyMatrix4(this.camera.matrixWorld);
  //   return gunPos;
  // }

  createCrosshair() {
    const crosshairGroup = new THREE.Group();
  
    const length = 0.01;
    const thickness = 0.003;
    const gap = 0.01;
  
    const createLine = (x, y, width, height) => {
      const geometry = new THREE.PlaneGeometry(width, height);
      const material = new THREE.MeshBasicMaterial({
        color: 0xffffff, // Blue color
        emissive: 0xffffff, // Emissive color for glow effect
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.8,
      });
      const line = new THREE.Mesh(geometry, material);
      line.position.set(x, y, 0);
      return line;
    };
  
    const leftLine = createLine(
      -length / 2 - gap / 2 + 0.0275,
      -0.03,
      length,
      thickness
    );
    const rightLine = createLine(
      length / 2 + gap / 2 + 0.0275,
      -0.03,
      length,
      thickness
    );
    const topLine = createLine(
      0.0275,
      length / 2 + gap / 2 - 0.03,
      thickness,
      length
    );
    const bottomLine = createLine(
      0.0275,
      -length / 2 - gap / 2 - 0.03,
      thickness,
      length
    );
  
    crosshairGroup.add(leftLine);
    crosshairGroup.add(rightLine);
    crosshairGroup.add(topLine);
    crosshairGroup.add(bottomLine);
  
    crosshairGroup.position.z = -1;
  
    return crosshairGroup;
  }

  createBullet(startPosition, targetPosition) {
    const geometry = new THREE.BoxGeometry(
      this.bulletSize,
      this.bulletSize,
      this.bulletSize,
    );
    const material = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const bullet = new THREE.Mesh(geometry, material);

    // Set initial position at gun location
    bullet.position.copy(startPosition);

    // Calculate direction vector from gun to target
    const direction = new THREE.Vector3();
    direction.subVectors(targetPosition, startPosition).normalize();

    // Store bullet data with its unique trajectory
    this.projectiles.push({
      mesh: bullet,
      startPosition: startPosition.clone(),
      targetPosition: targetPosition.clone(),
      direction: direction,
      distance: startPosition.distanceTo(targetPosition),
      distanceTraveled: 0,
      initialTime: Date.now(),
    });

    this.scene.add(bullet);
    return bullet;
  }

  animate() {
      //   if (this.gameState.isPaused()){
      // return;} // Stop the loop if paused

    requestAnimationFrame(this.animate);
    // this.updateFlashlight();
    const currentTime = Date.now();


    // Update each projectile independently
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const projectile = this.projectiles[i];

      // Calculate new position using the projectile's unique direction
      projectile.mesh.position.add(
        projectile.direction.clone().multiplyScalar(this.bulletSpeed),
      );

      // Update distance traveled
      projectile.distanceTraveled += this.bulletSpeed;

      // Check if bullet reached target
      if (projectile.distanceTraveled >= projectile.distance) {
        // Create impact effect at target position
        this.createImpactEffect(projectile.targetPosition);

        // Remove bullet
        this.scene.remove(projectile.mesh);
        projectile.mesh.geometry.dispose();
        projectile.mesh.material.dispose();
        this.projectiles.splice(i, 1);
      }
    }
  }

  createImpactEffect(position) {
    const impactGeometry = new THREE.SphereGeometry(this.bulletSize * 2, 8, 8);
    const impactMaterial = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.8,
    });
    const impact = new THREE.Mesh(impactGeometry, impactMaterial);
    impact.position.copy(position);

    this.scene.add(impact);

    const fadeStart = Date.now();
    const fadeDuration = 100;

    const fadeImpact = () => {
      const elapsed = Date.now() - fadeStart;
      const opacity = 0.8 * (1 - elapsed / fadeDuration);

      if (opacity <= 0) {
        this.scene.remove(impact);
        impact.geometry.dispose();
        impact.material.dispose();
        return;
      }

      impact.material.opacity = opacity;
      requestAnimationFrame(fadeImpact);
    };

    fadeImpact();
  }

  addTarget(target) {
    this.targets.push(target);
  }

  getTargets() {
    return this.targets;
  }

  removeTarget(target) {
    const index = this.targets.indexOf(target);
    if (index > -1) {
      this.targets.splice(index, 1);
    }
  }

  shoot(event) {
    const now = Date.now();
    if (now - this.lastShot < this.shootingCooldown) {
      return; // Still in cooldown
    }
    this.lastShot = now;
      // Play gunshot sound
      if (this.gunshotSound.isPlaying) {
        this.gunshotSound.stop();
      }
      this.gunshotSound.play();

    // const originalPosition = this.crosshair.position.clone();
    // // const originalGunPosition = this.gun.position.clone();

    // this.crosshair.position.y += 5;
    // // this.gun.position.y += 5;
 // Save the original position of the camera
 const originalCameraPosition = this.camera.position.clone();

 // Move the camera 5 units down on the Y-axis
 this.camera.position.y -= 5;

    // Calculate shooting direction from camera center
    this.raycaster.setFromCamera(new THREE.Vector2(0, 0), this.camera);

    // Get the gun's world position
    const gunPos = this.getGunWorldPosition();


    // Check for intersections with targets
    const intersects = this.raycaster.intersectObjects(this.targets);

    if (intersects.length > 0) {
      const hitObject = intersects[0].object;
      this.createBullet(gunPos, intersects[0].point);
      this.handleHit(hitObject);
    } else {
      // If no hit, shoot into the distance along the ray
      const targetPos = gunPos
        .clone()
        .add(this.raycaster.ray.direction.clone().multiplyScalar(100));
      this.createBullet(gunPos, targetPos);
    }

    // Set a timeout to move the crosshair back to the original position after 0.1 seconds
    setTimeout(() => {
      // this.crosshair.position.copy(originalPosition);
      // this.gun.position.copy(originalGunPosition);
      this.camera.position.copy(originalCameraPosition);
    }, 100);
  }

  handleHit(target) {
    const originalMaterial = target.material.clone();
    target.material.color.setHex(0xff0000);

    setTimeout(() => {
      target.material.copy(originalMaterial);
    }, 200);

    const hitEvent = new CustomEvent("targetHit", {
      detail: { target },
    });
    document.dispatchEvent(hitEvent);
  }

  dispose() {
    document.removeEventListener("click", this.shoot);

    this.camera.remove(this.crosshair);
    this.crosshair.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose();
        child.material.dispose();
      }
    });

    this.projectiles.forEach((projectile) => {
      this.scene.remove(projectile.mesh);
      projectile.mesh.geometry.dispose();
      projectile.mesh.material.dispose();
    });
    this.projectiles = [];
  }
}




