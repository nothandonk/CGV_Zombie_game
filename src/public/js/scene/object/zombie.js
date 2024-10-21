import { GLTFLoader } from "https://cdn.jsdelivr.net/npm/three@0.169.0/examples/jsm/loaders/GLTFLoader.js";
import { FBXLoader } from "https://cdn.jsdelivr.net/npm/three@0.169.0/examples/jsm/loaders/FBXLoader.js";
import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.169.0/build/three.module.js";

class Zombie {
    constructor(scene, camera, otherObjects, shooter) {
        this.isDead = false;
        this.scene = scene;
        this.camera = camera;
        this.otherObjects = otherObjects;
        this.shooter = shooter;
        this.loader = new GLTFLoader();
        this.fbxLoader = new FBXLoader();
        this.model = null;
        this.speed = 0.3;
        this.isAttacking = false;
        this.boundingBox = null;
        this.health = 100;
        this.playerHeight = 30;
        this.playerRadius = 0.5;
        this.playerBoundingBox = new THREE.Box3();
        this.mixer = null;
        this.actions = {}; 
        this.currentAction = null;

        this.walkingAction = null;
        this.punchingAction = null;
        this.idleAction = null;

        // Add audio listener to the camera
        this.listener = new THREE.AudioListener();
        this.camera.add(this.listener);

        // Set up positional audio for zombie
        this.zombieSound = new THREE.PositionalAudio(this.listener);

        this.init();
    }

    init() {
        this.loadModel();
        this.loadZombieSound();
        
        // Wait for any user interaction to start the audio context
        const resumeAudioContext = () => {
            if (this.listener.context.state === 'suspended') {
                this.listener.context.resume().then(() => {
                    console.log('AudioContext resumed automatically');
                    this.zombieSound.play(); // Play the sound as soon as context resumes
                });
            }

            // Remove the event listeners after resuming
            window.removeEventListener('click', resumeAudioContext);
            window.removeEventListener('keydown', resumeAudioContext);
        };

        // Listen for a user interaction (click or keydown)
        window.addEventListener('click', resumeAudioContext);
        window.addEventListener('keydown', resumeAudioContext);

        this.animate();
    }

    loadModel() {
        this.loader.load('/zombie1.glb', (gltf) => {
            this.model = gltf.scene;
            this.model.position.set(0, 0, -50);
            this.model.scale.set(20, 20, 20);

            // Associate this zombie instance with the model
            this.model.userData.zombieInstance = this;

            this.scene.add(this.model);
            this.boundingBox = new THREE.Box3().setFromObject(this.model);

            // Attach sound to zombie model
            this.model.add(this.zombieSound);

            // Set up animation mixer
            this.mixer = new THREE.AnimationMixer(this.model);

            // Add zombie to shooting targets
            this.shooter.addTarget(this.model);

            this.actions['walking'] = this.mixer.clipAction(gltf.animations.find(anim => anim.name === 'walking'));
            this.actions['punching'] = this.mixer.clipAction(gltf.animations.find(anim => anim.name === 'punching'));
            this.actions['idle'] = this.mixer.clipAction(gltf.animations.find(anim => anim.name === 'idle'));

            this.loadAnimation('ZombieHit.fbx', "hit");
            this.loadAnimation('ZombieDying.fbx', "dying");

            this.setAction('walking');

            console.log('Zombie model loaded successfully');
        }, undefined, (error) => {
            console.error('Error loading zombie model', error);
        });
    }

    takeDamage(damage) {
        this.health -= damage;
        console.log(`Zombie hit! Current health: ${this.health}`);
    
        if (this.health > 0) {
            // Play taking damage animation
            this.playTakingDamageAnimation();
        } else {
            // If health reaches 0 or below, trigger death
            this.die();
        }
    }

    playTakingDamageAnimation() {
        if (this.isDead) return; // Prevent playing if already dead
    
        const previousAction = this.currentAction; // Save the current action
        this.setAction('hit'); // Play damage animation
    
        // Set the action to play once and not loop
        this.currentAction.clampWhenFinished = true;
        this.currentAction.setLoop(THREE.LoopOnce);
        this.currentAction.play(); // Start playing the hit animation
    
        // Get the duration of the hit animation for timing
        const damageDuration = this.actions['hit'] ? this.actions['hit'].getClip().duration : 1;
    
        // After the damage animation finishes, return to the previous action
        setTimeout(() => {
            if (!this.isDead && previousAction) {
                this.setAction(previousAction._clip.name); // Return to previous animation
            }
        }, damageDuration * 1000); // Duration of damage animation
    }
    
    

    die() {
        if (this.isDead) return; // Prevent double death logic
        this.isDead = true;

        if (this.zombieSound && this.zombieSound.isPlaying) {
            this.zombieSound.stop();
        }    

        this.setAction('dying'); // Play the dying animation
        console.log("Zombie is dead!");

        // Stop further updates
        setTimeout(() => {
            this.shooter.removeTarget(this.model); // Remove zombie from shooting targets
            this.scene.remove(this.model); // Optionally remove from the scene

            // Optionally dispose of resources
            this.model.traverse((child) => {
                if (child instanceof THREE.Mesh) {
                    child.geometry.dispose();
                    child.material.dispose();
                }
            });
        }, 1000); // Wait 2 seconds to remove the zombie after the death animation
    }

    loadAnimation(animationPath, name) {
        this.fbxLoader.load(animationPath, (fbx) => {
            const animation = fbx.animations[0]; // Assuming there's one animation
            this.actions[name] = this.mixer.clipAction(animation);
            console.log('FBX Animation loaded successfully');
            console.log(this.actions)
        }, undefined, (error) => {
            console.error('Error loading FBX animation', error);
        });
    }

    setAction(actionName) {
        if (this.currentAction) {
            this.currentAction.fadeOut(0.5); // Fade out the current action
        }
        
        this.currentAction = this.actions[actionName];
        
        if (this.currentAction) {
            this.currentAction.reset().fadeIn(0.5).play(); // Fade in the new action
        }
    }

    loadZombieSound() {
        const audioLoader = new THREE.AudioLoader();
        audioLoader.load('audio/157044_slave2thelight_solo-kyma-zombie-3 (online-audio-converter.com).mp3', (buffer) => {
            this.zombieSound.setBuffer(buffer);
            this.zombieSound.setRefDistance(100); // Distance over which the sound is audible
            this.zombieSound.setLoop(true);
            this.zombieSound.setVolume(0.4);
            this.zombieSound.play(); // Play the sound when loaded
            console.log('Zombie sound loaded and playing');
        }, undefined, (error) => {
            console.error('Error loading zombie sound', error);
        });
    }

    checkCollision() {
        if (!this.boundingBox || !this.playerBoundingBox) return false;

        // Check for collision with the player's bounding box
        if (this.playerBoundingBox.intersectsBox(this.boundingBox)) {
            return true; // Collision detected with player
        }

        // Check for collision with other objects
        for (const obj of this.otherObjects) {
            if (this.boundingBox.intersectsBox(obj.boundingBox)) {
                return true;
            }
        }

        return false;
    }

    update() {
        if (this.model) {
            this.model.position.y = 0;
    
            // Calculate direction to camera
            const direction = new THREE.Vector3();
            direction.subVectors(this.camera.position, this.model.position).normalize();
    
            const distanceToCamera = this.camera.position.distanceTo(this.model.position);
            const stoppingDistance = 70;

            const nextPosition = this.model.position.clone().addScaledVector(direction, this.speed);

            // Update the bounding box for the current position
            this.boundingBox.setFromObject(this.model);

            // Update the bounding box for the next position
            const nextBoundingBox = this.boundingBox.clone();
            nextBoundingBox.setFromCenterAndSize(
                nextPosition,
                new THREE.Vector3(this.boundingBox.getSize(new THREE.Vector3()).x, this.boundingBox.getSize(new THREE.Vector3()).y, this.boundingBox.getSize(new THREE.Vector3()).z)
            );
    
            //console.log("Zombie position:", this.model.position);
            //console.log("Distance to camera:", distanceToCamera);
    
            // Move the zombie towards the camera if it's beyond the stopping distance and not colliding
            if (distanceToCamera > stoppingDistance && !this.checkCollision()) {
                this.model.position.copy(nextPosition);
                this.boundingBox.setFromObject(this.model); // Update the bounding box
                if (this.currentAction !== this.actions['walking']) {
                    this.setAction('walking');
                }
                
            } else {
                //console.log("Zombie reached stopping distance from player or collision detected.");
                // Ensure the zombie's position is set directly at the stopping distance
                this.model.position.copy(this.camera.position).sub(direction.multiplyScalar(stoppingDistance));

                if (distanceToCamera <= stoppingDistance && this.currentAction !== this.actions['punching']) {
                    this.setAction('punching');
                }

            }

            // Make the zombie look at the camera but only around the Y-axis
            const angle = Math.atan2(direction.x, direction.z);
            this.model.rotation.y = angle;
        
            // Update player bounding box based on the camera's position
            this.playerBoundingBox.setFromCenterAndSize(
                this.camera.position,
                new THREE.Vector3(
                    this.playerRadius * 2,
                    this.playerHeight,
                    this.playerRadius * 2
                )
            );
    
            if (this.checkCollision()) {
                //console.log("Collision detected with player!");
            }

            // Update animation mixer
            if (this.mixer) {
                this.mixer.update(0.01);
            }

        }
    }
    
    animate() {
        requestAnimationFrame(() => this.animate());
        this.update();
    }
}

export default Zombie;
