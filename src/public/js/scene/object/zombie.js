import { GLTFLoader } from "https://cdn.jsdelivr.net/npm/three@0.169.0/examples/jsm/loaders/GLTFLoader.js";
import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.169.0/build/three.module.js";

class Zombie {
  constructor(scene, camera, otherObjects, world) {
    this.scene = scene;
    this.world = world;
    this.camera = camera;
    this.otherObjects = otherObjects;
    this.loader = new GLTFLoader();
    this.model = null;
    this.speed = 1;
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
      if (this.listener.context.state === "suspended") {
        this.listener.context.resume().then(() => {
          console.log("AudioContext resumed automatically");
          this.zombieSound.play(); // Play the sound as soon as context resumes
        });
      }

      // Remove the event listeners after resuming
      window.removeEventListener("click", resumeAudioContext);
      window.removeEventListener("keydown", resumeAudioContext);
    };

    // Listen for a user interaction (click or keydown)
    window.addEventListener("click", resumeAudioContext);
    window.addEventListener("keydown", resumeAudioContext);

    this.animate();
  }

  loadModel() {
    this.loader.load(
      "/zombie1.glb",
      (gltf) => {
        this.model = gltf.scene;
        this.model.position.set(0, 0, -50);
        this.model.scale.set(20, 20, 20);
        this.scene.add(this.model);
        this.boundingBox = new THREE.Box3().setFromObject(this.model);
        this.otherObjects.push({
          object: this.model,
          boundingBox: this.boundingBox,
        });

        // Attach sound to zombie model
        this.model.add(this.zombieSound);

        //add as target
        this.world.shooter.addTarget(this.model)

        // Set up animation mixer
        this.mixer = new THREE.AnimationMixer(this.model);

        this.actions["walking"] = this.mixer.clipAction(
          gltf.animations.find((anim) => anim.name === "walking"),
        );
        this.actions["punching"] = this.mixer.clipAction(
          gltf.animations.find((anim) => anim.name === "punching"),
        );
        this.actions["idle"] = this.mixer.clipAction(
          gltf.animations.find((anim) => anim.name === "idle"),
        );

        this.setAction("walking");

        console.log("Zombie model loaded successfully");
      },
      undefined,
      (error) => {
        console.error("Error loading zombie model", error);
      },
    );
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
    audioLoader.load(
      "audio/157044_slave2thelight_solo-kyma-zombie-3 (online-audio-converter.com).mp3",
      (buffer) => {
        this.zombieSound.setBuffer(buffer);
        this.zombieSound.setRefDistance(100); // Distance over which the sound is audible
        this.zombieSound.setLoop(true);
        this.zombieSound.setVolume(0.4);
        this.zombieSound.play(); // Play the sound when loaded
        console.log("Zombie sound loaded and playing");
      },
      undefined,
      (error) => {
        console.error("Error loading zombie sound", error);
      },
    );
  }

  checkCollision() {
    if (!this.boundingBox || !this.world.playerBoundingBox) return false;

    // Check for collision with the player's bounding box
    if (this.world.playerBoundingBox.intersectsBox(this.boundingBox)) {
      return true; // Collision detected with player
    }

    // Check for collision with other objects
    // for (const obj of this.otherObjects) {
    //   if (this.boundingBox.intersectsBox(obj.boundingBox)) {
    //     return true;
    //   }
    // }

    return false;
  }

  update() {
    if (this.model) {
      const terrainHeight = this.world.getTerrainHeight(
        this.model.position.x,
        this.model.position.z,
      );
      this.model.position.y = terrainHeight;

      // Calculate direction to camera
      const direction = new THREE.Vector3();
      direction
        .subVectors(this.camera.position, this.model.position)
        .normalize();

      const distanceToCamera = this.camera.position.distanceTo(
        this.model.position,
      );
      const stoppingDistance = 70;

      const nextPosition = this.model.position
        .clone()
        .addScaledVector(direction, this.speed);

      // Update the bounding box for the current position
      this.boundingBox.setFromObject(this.model);

      // Update the bounding box for the next position
      const nextBoundingBox = this.boundingBox.clone();
      nextBoundingBox.setFromCenterAndSize(
        nextPosition,
        new THREE.Vector3(
          this.boundingBox.getSize(new THREE.Vector3()).x,
          this.boundingBox.getSize(new THREE.Vector3()).y,
          this.boundingBox.getSize(new THREE.Vector3()).z,
        ),
      );

      console.log("Zombie position:", this.model.position);
      console.log("Distance to camera:", distanceToCamera);

      // Move the zombie towards the camera if it's beyond the stopping distance and not colliding
      if (distanceToCamera > stoppingDistance && !this.checkCollision()) {
        this.model.position.copy(nextPosition);
        this.boundingBox.setFromObject(this.model); // Update the bounding box
        if (this.currentAction !== this.actions["walking"]) {
          this.setAction("walking");
        }
      } else {
        console.log(
          "Zombie reached stopping distance from player or collision detected.",
        );
        // Ensure the zombie's position is set directly at the stopping distance
        // this.model.position
        //   .copy(this.camera.position)
        //   .sub(direction.multiplyScalar(stoppingDistance));

        if (
          distanceToCamera <= stoppingDistance &&
          this.currentAction !== this.actions["punching"]
        ) {
          this.setAction("punching");
        }
      }

      // Make the zombie look at the camera but only around the Y-axis
      const angle = Math.atan2(direction.x, direction.z);
      this.model.rotation.y = angle;

      if (this.checkCollision()) {
        console.log("Collision detected with player!");
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
