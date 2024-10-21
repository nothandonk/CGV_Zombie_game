import { GLTFLoader } from "https://cdn.jsdelivr.net/npm/three@0.169.0/examples/jsm/loaders/GLTFLoader.js";
import { nanoid } from "https://cdn.jsdelivr.net/npm/nanoid/nanoid.js";
import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.169.0/build/three.module.js";

export class GLTFObject {
  constructor(
    path,
    position,
    rotation = [0, 0, 0],
    scale,
    world,
    mutable = false,
    followCamera = false,
  ) {
    this.id = nanoid();
    this.position = position;
    this.rotation = rotation;
    this.scale = scale;
    this.path = path;
    this.loader = new GLTFLoader();
    this.scene;
    this.world = world;

    this.followCamera = followCamera;
    this.loader.load(this.path, (gltf) => {
      let _ = gltf.scene;
      _.position.set(this.position[0], this.position[1], this.position[2]);
      _.rotation.set(this.rotation[0], this.rotation[1], this.rotation[2]);
      _.scale.set(this.scale[0], this.scale[1], this.scale[2]);
      if (this.followCamera) {
        this.world.camera.add(_);
      } else {
        this.world.scene.add(_);
        const boundingBox = new THREE.Box3().setFromObject(_);
        this.world.objectsToCheck.push({
          object: _,
          boundingBox: boundingBox,
        });
      }
      this.scene = _;
    });

    this.mutable = mutable;
    this.rerender = false;
  }

  setPosition() {}

  setRotation(rotation) {
    if (this.scene) {
      this.scene.rotation.set(rotation[0], rotation[1], rotation[2]);
    }
  }

  render() {
    if (this.followCamera) {
      // this.scene.position.set(
      //   //handle translation
      //   this.world.camera.position.x +
      //     Math.sin(this.world.camera.rotation.y + Math.PI / 6) * 3,
      //   this.world.camera.position.y - 2,
      //   this.world.camera.position.z -
      //     Math.cos(this.world.camera.rotation.y + Math.PI / 6) * 8,
      // );
      // //handle rotation
      // console.log(this.scene);
      // this.scene.rotation.set(
      //   this.world.camera.rotation.x,
      //   this.world.camera.rotation.y - Math.PI / 2,
      //   this.world.camera.rotation.z,
      // );
    }
  }
}
