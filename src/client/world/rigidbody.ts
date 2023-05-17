import * as THREE from "three";
import { Collider, ObjFile, ObjectOption, vecPrint } from "../objs/obj";

export class RigidBodyObject implements Collider {
  vert: Float32Array;
  idx: Uint16Array;

  scene: THREE.Scene;
  mesh: THREE.Mesh;

  pos: THREE.Vector3;
  vel: THREE.Vector3;
  nextpos: THREE.Vector3;
  deltapos: THREE.Vector3;

  mass: number;
  radius: number;
  options: ObjectOption;
  translate: THREE.Vector3;

  dragIdx?: number;
  dragPos?: THREE.Vector3;
  collIndex: number;

  constructor(
    collIndex: number,
    scene: THREE.Scene,
    option: ObjectOption,
    radius: number,
    translate?: THREE.Vector3,
    color?: number
  ) {
    this.collIndex = collIndex;
    this.scene = scene;
    this.options = option;
    this.radius = radius;

    this.mass = radius * radius * 10;
    this.translate = translate ? translate : new THREE.Vector3(0, 0, 0);

    this.pos = new THREE.Vector3(0, 0, 0);
    this.vel = new THREE.Vector3(0, 0, 0);
    this.nextpos = new THREE.Vector3(0, 0, 0);
    this.deltapos = new THREE.Vector3(0, 0, 0);
    this.pos.copy(this.translate);

    const sphereGeo = new THREE.SphereGeometry(radius);
    const sphereMat = new THREE.MeshPhongMaterial({
      color: color,
    });
    this.mesh = new THREE.Mesh(sphereGeo, sphereMat);
    this.mesh.position.copy(this.pos);

    this.vert = new Float32Array();
    this.idx = new Uint16Array();
  }

  onStart() {
    this.scene.add(this.mesh);
  }

  render() {
    this.mesh.position.copy(this.pos);

    this.mesh.geometry.computeVertexNormals();
    this.mesh.geometry.attributes.position.needsUpdate = true;
    this.mesh.geometry.computeBoundingBox();
    this.mesh.geometry.computeBoundingSphere();
  }

  reset() {
    // Bunny Reset
    this.pos.copy(this.translate);
    this.vel.set(0, 0, 0);

    this.mesh.position.copy(this.pos);

    this.render();
  }

  setDrag(idx: number, pos?: THREE.Vector3) {
    this.dragIdx = idx;
    this.dragPos = pos;
  }

  bbox(): THREE.Box3 {
    return this.mesh.geometry.boundingBox!;
  }

  onFixedUpdate_init(delta: number) {
    // grav. accel.: 1 m/s^2
    const g = -3;
    let t0 = new THREE.Vector3();

    // add gravity + velocity
    if (this.dragIdx !== undefined && this.dragIdx >= 0) {
      const dragForce = this.dragPos!.clone().sub(this.pos);
      if (dragForce.length() > 5) {
        dragForce.normalize().multiplyScalar(5);
      }
      this.vel.add(dragForce);
      // this.vel[i].multiplyScalar(0);
    } else {
      this.vel.y += g * delta;
    }

    t0.copy(this.vel).multiplyScalar(delta);
    this.nextpos.copy(this.pos).add(t0);
    this.deltapos.set(0, 0, 0);
  }

  onFixedUpdate_apply(delta: number) {
    let t0 = new THREE.Vector3();

    // velocity update
    t0.copy(this.nextpos).sub(this.pos).divideScalar(delta);

    // clutch velocity
    this.vel.copy(t0);
    if (this.vel.length() > 5) {
      this.vel.normalize().multiplyScalar(5);
    }
    this.pos.add(t0.multiplyScalar(delta));
  }

  onUpdate(delta: number) {
    this.render();
  }
}
