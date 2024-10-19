import { GLTFLoader } from "https://cdn.jsdelivr.net/npm/three@0.169.0/examples/jsm/loaders/GLTFLoader.js";
import { nanoid } from "https://cdn.jsdelivr.net/npm/nanoid/nanoid.js";

export class GLTFObject {
  constructor(
    path,
    position,
    scale,
    world,
    mutable = false,
    followCamera = false,
  ) {
    this.id = nanoid();
    this.position = position;
    this.scale = scale;
    this.path = path;
    this.loader = new GLTFLoader();
    this.scene;
    this.world = world;

    this.followCamera = followCamera;
    this.loader.load(this.path, (gltf) => {
      let _ = gltf.scene;
      _.scale.set(this.scale[0], this.scale[1], this.scale[2]);

      if (this.followCamera) {
        _.position.set(
          this.world.camera.position.x + this.position[0],
          this.world.camera.position.y + this.position[1],
          this.world.camera.position.z + this.position[2],
        );
      } else {
        _.position.set(this.position[0], this.position[1], this.position[2]);
      }
      this.scene = _;
      this.world.addObject(this);
    });
    this.mutable = mutable;
    this.rerender = false;
  }

  setPosition() {}

  setRotation(rotation) {
    this.scene.rotation.set(rotation[0], rotation[1], rotation[2]);
  }

  render() {
    if (this.followCamera) {
      this.scene.position.set(
        //handle translation
        this.world.camera.position.x +
          Math.sin(this.world.camera.rotation.y + Math.PI / 6) * 3,
        this.world.camera.position.y - 2,
        this.world.camera.position.z -
          Math.cos(this.world.camera.rotation.y + Math.PI / 6) * 8,
      );

      //handle rotation
      console.log(this.scene);
      this.scene.rotation.set(
        this.world.camera.rotation.x,
        this.world.camera.rotation.y - Math.PI / 2,
        this.world.camera.rotation.z,
      );
    } else {
      this.scene.position.set(
        this.position[0],
        this.position[1],
        this.position[2],
      );
    }

    this.scene.scale.set(this.scale[0], this.scale[1], this.scale[2]);
  }
}
