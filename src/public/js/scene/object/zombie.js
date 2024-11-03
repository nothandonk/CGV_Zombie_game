import { GLTFLoader } from "https://cdn.jsdelivr.net/npm/three@0.169.0/examples/jsm/loaders/GLTFLoader.js";
import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.169.0/build/three.module.js";
import * as SkeletonUtils from "https://cdn.jsdelivr.net/npm/three@0.169.0/examples/jsm/utils/SkeletonUtils.js";

// Create a cache for loaded models
const modelCache = new Map();

class Zombie {
  constructor(world, position = { x: 0, y: 0, z: 0 }, type = "normal") {
    // world properties
    this.world = world;
    this.scene = world.scene;
    this.camera = world.camera;
    this.playerHeight = 30;
    this.playerRadius = 0.5;
    this.shooter = world.shooter;

    // zombie properties
    this.type = type;
    this.position = position;
    this.model = null;
    this.speed = null;
    this.health = null;
    this.isDead = false;
    this.boundingBox = null;

    // animation properties
    this.mixer = null;
    this.animations = {};
    this.currentAction = null;

    //path finding details
    this.path = null;
    this.currentPathIndex = 0;
    this.pathUpdateInterval = 2000;
    this.lastPathUpdate = 0;
    this.pathVisualization = null;
        
    this.setAttributesBasedOnType();
    }

  loadModel(modelPath) {
    // Check if model is already in cache
    if (modelCache.has(modelPath)) {
      const cachedModel = modelCache.get(modelPath);
      if (cachedModel.pending) {
        // If model is still loading, wait for it
        cachedModel.promise.then((gltf) => {
          this.setupModel(SkeletonUtils.clone(gltf.scene), gltf.animations);
        });
      } else {
        // If model is already loaded, use the clone immediately
        const gltf = cachedModel.data;
        this.setupModel(SkeletonUtils.clone(gltf.scene), gltf.animations);
      }
      return;
    }

    // If model isn't cached, load it
    const loader = new GLTFLoader();

    // Create a promise for the model load
    const modelPromise = new Promise((resolve, reject) => {
      return loader.load(
        modelPath,
        (gltf) => resolve(gltf),
        undefined,
        (error) => reject(error),
      );
    });

    // Add to cache as pending
    modelCache.set(modelPath, {
      pending: true,
      promise: modelPromise,
    });

    // Load the model
    modelPromise
      .then((gltf) => {
        // Update cache with loaded model
        modelCache.set(modelPath, {
          pending: false,
          data: gltf,
        });

        // Setup this zombie's cloned model
        this.setupModel(SkeletonUtils.clone(gltf.scene), gltf.animations);
      })
      .catch((error) => {
        console.error("Error loading zombie model:", error);
        modelCache.delete(modelPath); // Remove failed model from cache
      });
  }

  setupModel(modelScene, animations) {
    this.model = modelScene;
    this.model.position.set(this.position.x, this.position.y, this.position.z);
    this.model.scale.set(20, 20, 20);
    
    // Clone materials for each zombie instance
    this.model.traverse((child) => {
        if (child.isMesh) {
            // Create a unique material clone for each mesh
            child.material = child.material.clone();
            child.userData.zombieInstance = this;
            // Add each mesh as a target for shooting
            this.shooter.addTarget(child);
          }
        });
    this.shooter.addToMinimap(this.model)

    this.boundingBox = new THREE.Box3().setFromObject(this.model);
        
    if (animations && animations.length) {
        this.mixer = new THREE.AnimationMixer(this.model);
            
        animations.forEach((clip) => {
            this.animations[clip.name] = this.mixer.clipAction(clip);
        });

        if (this.animations["walking"]) {
            this.playAnimation("walking");
        } else {
            this.playAnimation("running");
        }
    }

    // Enable shadows
    this.model.traverse((child) => {
        if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
        }
    });

    this.scene.add(this.model);
    console.log("Cloned zombie model added to scene");
}

    setAttributesBasedOnType() {
        switch (this.type) {
            case 'normal':
                this.speed = 0.4;
                this.health = 100;
                this.loadModel('zombie1.glb');
                break;
            case 'fast':
                this.speed = 0.6;
                this.health = 150;
                this.loadModel('zombie2.glb');
                break;
            case 'crawling':
                this.speed = 0.5;
                this.health = 200;
                this.loadModel('zombie3.glb');
                break;

      default:
        this.speed = 0.4;
        this.health = 100;
        this.loadModel("zombie1.glb");
        break;
    }
  }

  playAnimation(name, speed = 0.6) {
    if (this.currentAction && this.currentAction !== this.animations[name]) {
      // Only fade out if it's a different action
      this.currentAction.crossFadeTo(this.animations[name], 0.5, false);
    }

    this.currentAction = this.animations[name];

    if (this.currentAction) {
      this.currentAction.reset().fadeIn(0.5).play(); // Fade in the new action
      this.currentAction.timeScale = speed;
    }
  }

    checkCollisions(nextPosition) {
    const graceDistance = 0.2;

    const displacement = new THREE.Vector3();
    displacement.subVectors(nextPosition, this.model.position);
    
    const predictedBox = this.boundingBox.clone();
    predictedBox.translate(displacement);
    predictedBox.expandByScalar(graceDistance);
    
    for (const object of this.world.objectsToCheck) {
        if (predictedBox.intersectsBox(object.boundingBox)) {
            // Calculate push-back direction
            const currentCenter = new THREE.Vector3();
            const objectCenter = new THREE.Vector3();
            
            this.boundingBox.getCenter(currentCenter);
            object.boundingBox.getCenter(objectCenter);
            
            const pushDirection = new THREE.Vector3()
                .subVectors(currentCenter, objectCenter)
                .normalize();
            
            // Apply minimal push-back to avoid overlap
            return {
                collision: true,
                adjustedPosition: new THREE.Vector3()
                    .addVectors(this.model.position, pushDirection.multiplyScalar(0.1))
            };
        }
    }

    return { collision: false, adjustedPosition: nextPosition };
}



update(delta) {
    
    if (this.isDead) return;

    if (this.mixer) {
        this.mixer.update(delta);
    }

    if (this.model) {
        // Get terrain height at current position
        const terrainHeight = this.world.getTerrainHeight(
            this.model.position.x,
            this.model.position.z
        );
        this.model.position.y = terrainHeight;

        // Get current position and target (camera) position
        const currentPos = this.model.position.clone();
        const targetPos = this.camera.position.clone();
        
        // Calculate direction to camera and distance
        const direction = new THREE.Vector3();
        direction.subVectors(targetPos, currentPos).normalize();
        const distanceToCamera = currentPos.distanceTo(targetPos);
        const stoppingDistance = 70;

        // Store current rotation for smooth interpolation
        const currentRotation = this.model.rotation.y;
        
        if (distanceToCamera > stoppingDistance) {
            // Calculate next position
            const nextPosition = currentPos.clone().addScaledVector(direction, this.speed);
            const { collision, adjustedPosition } = this.checkCollisions(nextPosition);

            let finalPosition;
            let movementDirection;

            if (collision) {
                // Try alternative paths if there's a collision
                const leftPath = this.tryAlternativePath(direction, -Math.PI / 4);
                const rightPath = this.tryAlternativePath(direction, Math.PI / 4);
                
                if (leftPath || rightPath) {
                    finalPosition = leftPath || rightPath;
                } else {
                    finalPosition = adjustedPosition;
                }
            } else {
                finalPosition = adjustedPosition;
            }

            // Calculate actual movement direction based on where we're going
            movementDirection = new THREE.Vector3();
            movementDirection.subVectors(finalPosition, currentPos).normalize();

            // Update position
            this.model.position.copy(finalPosition);

            // Calculate target rotation based on movement direction
            const targetAngle = Math.atan2(movementDirection.x, movementDirection.z);
            
            // Smoothly interpolate rotation (lerp)
            const rotationSpeed = 0.1;
            let newRotation = currentRotation;
            
            // Handle rotation wrapping
            const PI2 = Math.PI * 2;
            while (targetAngle - newRotation > Math.PI) newRotation += PI2;
            while (targetAngle - newRotation < -Math.PI) newRotation -= PI2;
            
            // Smoothly interpolate to target rotation
            newRotation = THREE.MathUtils.lerp(newRotation, targetAngle, rotationSpeed);
            this.model.rotation.y = newRotation;

            // Play walking/running animation
            if (this.animations['walking']) {
                if (this.currentAction !== this.animations['walking']) {
                    this.playAnimation('walking');
                }
            } else if (this.animations['running']) {
                if (this.currentAction !== this.animations['running']) {
                    this.playAnimation('running');
                }
            }
        } else {
            // At stopping distance, face the player directly for attack
            const targetAngle = Math.atan2(direction.x, direction.z);
            
            // Smooth rotation interpolation for attack stance
            const rotationSpeed = 0.15;
            let newRotation = currentRotation;
            
            // Handle rotation wrapping
            const PI2 = Math.PI * 2;
            while (targetAngle - newRotation > Math.PI) newRotation += PI2;
            while (targetAngle - newRotation < -Math.PI) newRotation -= PI2;
            
            // Smoothly interpolate to target rotation
            newRotation = THREE.MathUtils.lerp(newRotation, targetAngle, rotationSpeed);
            this.model.rotation.y = newRotation;

            // Update position to maintain stopping distance
            this.model.position.copy(targetPos).sub(direction.multiplyScalar(stoppingDistance));

            // Play attack animation
            if (distanceToCamera <= stoppingDistance && this.currentAction !== this.animations['punching'] && !this.isDead) {
                this.playAnimation('punching');
                this.world.gameState.damagePlayer(5);
                this.world.gameState.updateUI();
            }
        }

        // Update the bounding box to the new position
        this.boundingBox.setFromObject(this.model);
    }
}

    tryAlternativePath(direction, angleOffset) {
        // Try an alternative direction when the zombie is stuck
        const alternativeDirection = direction.clone();
        alternativeDirection.applyAxisAngle(new THREE.Vector3(0, 1, 0), angleOffset);
        
        const alternativePosition = this.model.position.clone()
            .addScaledVector(alternativeDirection, this.speed);
        
        const { collision, adjustedPosition } = this.checkCollisions(alternativePosition);
        
        if (!collision) {
            return adjustedPosition;
        }
        return null;
    }

  takeDamage(damage) {
    this.health -= damage;
    console.log(`Zombie hit! Current health: ${this.health}`);

    if (this.health > 0) {
      // Play taking damage animation
      //this.playTakingDamageAnimation();
    } else {
      // If health reaches 0 or below, trigger death
      this.die();
    }
  }

  die() {
    if (this.isDead) return;
    
    this.isDead = true;
    this.world.gameState.killZombie();
    
    this.speed = 0;
    
    if (this.model) {
        this.model.traverse((child) => {
            if (child.isMesh) {
                this.shooter.removeTarget(child);
            }
        });
        this.shooter.removeFromMinimap(this.model)
    }

    if (this.animations['dying']) {
        this.playAnimation('dying');
        
        setTimeout(() => {
            this.removeFromScene();
        }, 1000);
    } else {
        this.removeFromScene();
    }
}

removeFromScene() {
    if (this.model) {
        this.scene.remove(this.model);
        
        this.model.traverse((child) => {
            if (child instanceof THREE.Mesh) {
                child.geometry.dispose();
                child.material.dispose();
            }
        });
        
        this.model = null;
    }
    
    if (this.mixer) {
        this.mixer.stopAllAction();
        this.mixer = null;
    }
    
    this.boundingBox = null;
    
    if (this.world.zombies) {
        const index = this.world.zombies.indexOf(this);
        if (index > -1) {
            this.world.zombies.splice(index, 1);
        }
    }
}
}

export default Zombie;
