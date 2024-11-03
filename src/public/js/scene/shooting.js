import * as THREE from "three";
import Zombie from "./object/zombie.js";

export class ShootingMechanism {
  constructor(world) {
    this.camera = world.camera;
    this.scene = world.scene;
    this.raycaster = new THREE.Raycaster();
    this.targets = [];
    this.crosshair = this.createCrosshair();
    this.projectiles = [];
    this.gameState = world.gameState;
    this.markedTargets = []

    // Gun position relative to camera
    this.gunOffset = new THREE.Vector3(3, -3.2, -10);

   //Flashlight
   this.flashlight = new THREE.SpotLight(0xffffff, 10, 150, Math.PI/2, 0,0);
   this.camera.add(this.flashlight);
   this.camera.add(this.flashlight.target);
   
   
   this.camera.add(this.crosshair);
       // Add audio listener to the camera
   this.listener = new THREE.AudioListener();
   this.camera.add(this.listener);
   
   // Gunshot sound setup
   this.gunshotSound = new THREE.Audio(this.listener);
   this.audioLoader = new THREE.AudioLoader();
   this.audioLoader.load('/public/audio/pewpew.mp3', (buffer) => {
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
    document.addEventListener("keydown", (e) => {
      if (e.key == " ") {
        this.shoot();
      }
    });

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

  createCrosshair() {
    const crosshairGroup = new THREE.Group();

    const length = 0.01;
    const thickness = 0.003;
    const gap = 0.01;

    const createLine = (x, y, width, height) => {
      const geometry = new THREE.PlaneGeometry(width, height);
      const material = new THREE.MeshBasicMaterial({
        color: 0xffffff,
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
      thickness,
    );
    const rightLine = createLine(
      length / 2 + gap / 2 + 0.0275,
      -0.03,
      length,
      thickness,
    );
    const topLine = createLine(
      0.0275,
      length / 2 + gap / 2 - 0.03,
      thickness,
      length,
    );
    const bottomLine = createLine(
      0.0275,
      -length / 2 - gap / 2 - 0.03,
      thickness,
      length,
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
    requestAnimationFrame(this.animate);

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
    if (target.geometry) {
      // Update the target's matrixWorld
      target.updateMatrixWorld(true);
      this.targets.push(target);
    }
  }

  addToMinimap(target) {
      this.markedTargets.push(target);
  }

  removeFromMinimap(target) {
    const index = this.markedTargets.indexOf(target);
    if (index > -1) {
      this.markedTargets.splice(index, 1);
    }
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
      return;
    }
    this.lastShot = now;
    if (this.gunshotSound.isPlaying) {
      this.gunshotSound.stop();
    }
    this.gunshotSound.play();
    // Get camera direction and position
    const cameraPosition = this.camera.position.clone();
    const cameraDirection = new THREE.Vector3(0, 0, -1);
    cameraDirection.unproject(this.camera).sub(cameraPosition).normalize();

    // Update raycaster
    this.raycaster.set(cameraPosition, cameraDirection);

    const intersects = this.raycaster.intersectObjects(this.targets, false);

    if (intersects.length > 0) {
      const hitObject = intersects[0].object;
      const hitPoint = intersects[0].point;
      
      this.createBullet(this.getGunWorldPosition(), hitPoint);
      this.handleHit(hitObject);
    } else {
      const gunPos = this.getGunWorldPosition();
      const targetPos = gunPos.clone().add(cameraDirection.multiplyScalar(300));
      this.createBullet(gunPos, targetPos);
    }
  }

  handleHit(target) {
    let zombieInstance = null;

    let obj = target;
    while (obj && !obj.userData.zombieInstance) {
        obj = obj.parent;
    }

    if (obj && obj.userData.zombieInstance) {
        zombieInstance = obj.userData.zombieInstance;
        
        // Since each zombie now has its own material, this will only affect the hit zombie
        const originalColor = target.material.color.clone();
        target.material.color.setHex(0xff0000);

        setTimeout(() => {
            target.material.color.copy(originalColor);
        }, 100);

        console.log("Hit a zombie!");
        zombieInstance.takeDamage(10);
    }

    const hitEvent = new CustomEvent("targetHit", {
        detail: { target }
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