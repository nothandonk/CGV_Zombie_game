import { GLTFObject } from "./scene/object/object.js";
import Scene from "./scene/scene.js";

document.addEventListener("DOMContentLoaded", function () {
  const world = new Scene();

  world.init();
  const gun = new GLTFObject(
    "/rovelver1.0.0.glb",
    [0, 0, -10],
    [1, 1, 1],
    world,
    true,
    true,
  );

  world.animate();
});
