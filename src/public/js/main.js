import { GLTFObject } from "./scene/object/object.js";
import Scene from "./scene/scene.js";

document.addEventListener("DOMContentLoaded", async function () {
  const world = new Scene();

  world.init();

  //game loop

  // const gun = new GLTFObject(
  //   "/rovelver1.0.0.glb",
  //   [3, -3.2, -10],
  //   [0, -Math.PI / 2, 0],
  //   [1, 1, 1],
  //   world,
  //   true,
  //   true,
  // );

  const gun = new GLTFObject(
    "/remington1100.glb",
    [3, -3.2, -11],
    [0, Math.PI/2, 0],
    [5, 5, 5],
    world,
    true,
    true,
  );

  world.animate();
});
