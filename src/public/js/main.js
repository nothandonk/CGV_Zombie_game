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

  // const gun = new GLTFObject(
  //   "/new_gun.glb",
  //   [3, -3.2, -8.5],
  //   [0, Math.PI, 0],
  //   [0.1, 0.1, 0.1],
  //   world,
  //   true,
  //   true,
  // );

  const gun = new GLTFObject(
    "/m4.glb",
    [2, -3.2, -6],
    [0, Math.PI, 0],
    [2.5, 2.5, 2.5],
    world,
    true,
    true,
  );


  world.animate();
});
