import * as THREE from "three";
import Stats from "three/examples/jsm/libs/stats.module";

import { World } from "./world/world";

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xbbbbbb);
scene.add(new THREE.AxesHelper(3));

const camera = new THREE.PerspectiveCamera(
  75,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);
camera.position.set(5, 5, 5);
camera.lookAt(0, 0, 0);

const renderer = new THREE.WebGLRenderer({
  antialias: true,
});
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

let mouse = { x: 0, y: 0 };
const stats = Stats();
document.body.appendChild(stats.dom);

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  render();
}

function onWindowMoseMove(e: MouseEvent) {
  mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
}

window.addEventListener("mousemove", onWindowMoseMove, false);
window.addEventListener("resize", onWindowResize, false);

var dirLight = new THREE.DirectionalLight(0xffffff);
dirLight.position.set(1, 1, 1);
dirLight.castShadow = true;
scene.add(dirLight);

var lightBack = new THREE.PointLight(0x0fffff, 1);
lightBack.position.set(0, -3, -1);
scene.add(lightBack);

var ground = new THREE.Mesh(
  new THREE.PlaneGeometry(20, 20, 1, 1),
  new THREE.MeshPhongMaterial({ color: 0xa0adaf, shininess: 155 })
);
ground.rotation.x = -Math.PI * 0.5;
var grid = new THREE.GridHelper(20, 20);
(grid.material as THREE.Material).opacity = 1.0;
(grid.material as THREE.Material).transparent = true;
grid.position.set(0, 0.002, 0);

scene.add(grid);
scene.add(ground);

let clock = new THREE.Clock();
clock.start();

let world = new World(scene, camera, renderer);

function animate() {
  requestAnimationFrame(animate);

  let delta = clock.getDelta();
  // cap delta because of focus out
  if (delta > 0.1) {
    delta = 0.1;
  }

  world.onUpdate(mouse, delta);
  stats.update();
  render();
}

function render() {
  renderer.render(scene, camera);
}

world.onStart();
animate();
