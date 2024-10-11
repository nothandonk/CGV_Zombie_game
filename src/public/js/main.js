import Scene from "./scene/scene.js";

document.addEventListener("DOMContentLoaded", function () {
  const scene = new Scene();
  scene.init();
  scene.animate();
});
