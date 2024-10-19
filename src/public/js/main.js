import { GLTFObject } from "./scene/object/object.js";
import Scene from "./scene/scene.js";

document.addEventListener("DOMContentLoaded", function () {
  const world = new Scene();

  world.init();
  const gun = new GLTFObject(
    "/rovelver1.0.0.glb",
    [3, -3, -10],
    [1, 1, 1],
    world,
    true,
    true,
  );

  gun.setRotation([0, Math.PI / 2, 0]);

  world.animate();
});
