import { GLTFLoader } from "https://cdn.jsdelivr.net/npm/three@0.169.0/examples/jsm/loaders/GLTFLoader.js";
import { FBXLoader } from "https://cdn.jsdelivr.net/npm/three@0.169.0/examples/jsm/loaders/FBXLoader.js";
import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.169.0/build/three.module.js";
import * as SkeletonUtils from 'https://cdn.jsdelivr.net/npm/three@0.169.0/examples/jsm/utils/SkeletonUtils.js';

// Create a cache for loaded models
const modelCache = new Map();

class Zombie {
    constructor(world, position = { x: 0, y: 0, z: 0 }, type = 'normal') {

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
            loader.load(modelPath, 
                (gltf) => resolve(gltf),
                undefined,
                (error) => reject(error)
            );
        });

        // Add to cache as pending
        modelCache.set(modelPath, {
            pending: true,
            promise: modelPromise
        });

        // Load the model
        modelPromise
            .then((gltf) => {
                // Update cache with loaded model
                modelCache.set(modelPath, {
                    pending: false,
                    data: gltf
                });
                
                // Setup this zombie's cloned model
                this.setupModel(SkeletonUtils.clone(gltf.scene), gltf.animations);
            })
            .catch((error) => {
                console.error('Error loading zombie model:', error);
                modelCache.delete(modelPath); // Remove failed model from cache
            });
    }

    setupModel(modelScene, animations) {
        this.model = modelScene;
        this.model.position.set(
            this.position.x,
            this.position.y,
            this.position.z
        );
        
        this.model.scale.set(20, 20, 20);

        // Associate this zombie instance with the model
        this.model.userData.zombieInstance = this;

        // Create a bounding box for the zombie
        this.boundingBox = new THREE.Box3().setFromObject(this.model);
        
        // Setup animations
        if (animations && animations.length) {
            this.mixer = new THREE.AnimationMixer(this.model);
            
            animations.forEach((clip) => {
                this.animations[clip.name] = this.mixer.clipAction(clip);
            });

            if (this.animations["walking"]){
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

        // Add zombie to shooting targets
        this.shooter.addTarget(this.model);
        
        // Add only the cloned model to the scene
        this.scene.add(this.model);
        console.log("Cloned zombie model added to scene");
    }

    setAttributesBasedOnType() {
        switch (this.type) {
            case 'normal':
                this.speed = 0.5;
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
                this.loadModel('zombie1.glb');
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
        const nextBoundingBox = this.boundingBox.clone().translate(nextPosition.sub(this.model.position));

        for (const object of this.world.objectsToCheck) {
            if (object !== this.model && object.geometry) {  // Ignore self
                const objectBoundingBox = new THREE.Box3().setFromObject(object);
                if (nextBoundingBox.intersectsBox(objectBoundingBox)) {
                    return true;  // Collision detected
                }
            }
        }
        return false;  // No collisions
    }

    update(delta) {
        if (this.mixer) {
            this.mixer.update(delta);
        }

        if (this.model) {

            const terrainHeight = this.world.getTerrainHeight(
                this.model.position.x,
                this.model.position.z,
            );
            this.model.position.y = terrainHeight;

           // Calculate direction to camera
           const direction = new THREE.Vector3();
           direction.subVectors(this.camera.position, this.model.position).normalize();

           const distanceToCamera = this.camera.position.distanceTo(this.model.position);
           const stoppingDistance = 70;

           const nextPosition = this.model.position.clone().addScaledVector(direction, this.speed);

            // Move the zombie towards the camera if it's beyond the stopping distance and not colliding
            if (distanceToCamera > stoppingDistance /* && !this.checkCollisions(nextPosition) */) {
                this.model.position.copy(nextPosition);
                if (this.animations['walking']) {
                    if (this.currentAction !== this.animations['walking']) {
                        this.playAnimation('walking');
                    }
                } else {
                    if (this.currentAction !== this.animations['running']) {
                        this.playAnimation('running');
                    }
                }
            } else {
                // Ensure the zombie's position is set directly at the stopping distance
                this.model.position.copy(this.camera.position).sub(direction.multiplyScalar(stoppingDistance));

                if (distanceToCamera <= stoppingDistance && this.currentAction !== this.animations['punching']) {
                    this.playAnimation('punching');
                    this.world.gameState.damagePlayer(5)
                    this.world.gameState.updateUI()
                }

            }

            // Update the bounding box to the new position
            this.boundingBox.setFromObject(this.model);

             // Make the zombie look at the camera but only around the Y-axis
             const angle = Math.atan2(direction.x, direction.z);
             this.model.rotation.y = angle;
        }
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
        this.world.gameState.killZombie()
        this.isDead = true;

        /* if (this.zombieSound && this.zombieSound.isPlaying) {
            this.zombieSound.stop();
        }  */   

        //this.playAnimation('dying');
        console.log("Zombie is dead!");

        // Stop further updates
        setTimeout(() => {

            if (this.model){
                this.shooter.removeTarget(this.model);
                this.scene.remove(this.model);
    
                // Optionally dispose of resources
                this.model.traverse((child) => {
                    if (child instanceof THREE.Mesh) {
                        child.geometry.dispose();
                        child.material.dispose();
                    }
                });
            }
            if (this.mixer) {
                this.mixer.stopAllAction();
            }
        }, 1000);
    }

    

}

export default Zombie;
