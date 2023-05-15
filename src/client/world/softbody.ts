import * as THREE from "three";
import { Collider, ObjFile, ObjectOption } from "../objs/obj";

export class SoftBodyObject implements Collider {
  initPos: number[];
  pos: THREE.Vector3[];
  vel: THREE.Vector3[];

  nextpos: THREE.Vector3[];
  deltapos: THREE.Vector3[];
  mass: number[];
  invmass: number[];
  v0: number[];
  l0: number[];
  stiffK: number;
  translate: THREE.Vector3;

  vertLen: number;
  tetLen: number;
  options: ObjectOption;

  vert: Float32Array;
  tetIdx: Uint32Array;
  idx: Uint16Array;
  edgeIdx: Uint16Array;

  geometry: THREE.BufferGeometry;
  mesh: THREE.Mesh;
  edgeGeo: THREE.BufferGeometry;
  edges: THREE.LineSegments;
  scene: THREE.Scene;

  dragIdx?: number;
  dragPos?: THREE.Vector3;

  constructor(
    file: ObjFile,
    scene: THREE.Scene,
    stiffK: number,
    option: ObjectOption,
    translate?: THREE.Vector3
  ) {
    this.scene = scene;
    this.initPos = file["verts"];
    this.pos = [];
    this.nextpos = [];
    this.deltapos = [];
    this.vel = [];

    this.translate = translate ? translate : new THREE.Vector3(0, 0, 0);

    this.vertLen = file.verts.length / 3;
    this.tetLen = file.tetIds.length / 4;
    this.stiffK = stiffK;
    this.options = option;

    this.mass = Array(this.vertLen).fill(0);
    let massNum = Array(this.vertLen).fill(0);
    this.invmass = Array(this.vertLen).fill(1);
    this.v0 = Array(this.tetLen).fill(0);
    this.l0 = Array(file.tetEdgeIds.length / 2).fill(0);

    for (let i = 0; i < this.initPos.length / 3; i++) {
      this.pos.push(
        new THREE.Vector3(
          this.initPos[3 * i] + this.translate.x,
          this.initPos[3 * i + 1] + this.translate.y,
          this.initPos[3 * i + 2] + this.translate.z
        )
      );
      this.nextpos.push(this.pos[i].clone());
      this.deltapos.push(new THREE.Vector3(0, 0, 0));
      this.vel.push(new THREE.Vector3(0, 0, 0));
    }

    this.vert = new Float32Array(this.initPos);
    this.tetIdx = new Uint32Array(file["tetIds"]);
    this.idx = new Uint16Array(file["tetSurfaceTriIds"]);
    this.edgeIdx = new Uint16Array(file["tetEdgeIds"]);

    // const tl = new THREE.Vector3(0, 0, 0);
    // for (let i = 0; i < this.l0.length; i++) {
    //   this.l0[i] = tl
    //     .copy(this.pos[this.edgeIdx[2 * i]])
    //     .sub(this.pos[this.edgeIdx[2 * i + 1]])
    //     .length();
    // }

    this.geometry = new THREE.BufferGeometry();
    this.geometry.setIndex(new THREE.BufferAttribute(this.idx, 1));
    this.geometry.setAttribute(
      "position",
      new THREE.BufferAttribute(this.vert, 3)
    );

    this.mesh = new THREE.Mesh(
      this.geometry,
      new THREE.MeshPhongMaterial({ color: 0x00f00f, flatShading: true })
    );
    this.mesh.geometry.computeVertexNormals();

    this.edgeGeo = new THREE.BufferGeometry();
    this.edgeGeo.setIndex(new THREE.BufferAttribute(this.edgeIdx, 1));
    this.edgeGeo.setAttribute(
      "position",
      new THREE.BufferAttribute(this.vert, 3)
    );

    this.edges = new THREE.LineSegments(
      this.edgeGeo,
      new THREE.LineBasicMaterial({ color: 0xffffff })
    );

    // add tet volumes
    let t0 = new THREE.Vector3(0, 0, 0);
    let t1 = new THREE.Vector3(0, 0, 0);
    for (let i = 0; i < this.tetLen; i++) {
      const [i0, i1, i2, i3] = [
        this.tetIdx[4 * i],
        this.tetIdx[4 * i + 1],
        this.tetIdx[4 * i + 2],
        this.tetIdx[4 * i + 3],
      ];

      const [x0, x1, x2, x3] = [
        this.pos[i0],
        this.pos[i1],
        this.pos[i2],
        this.pos[i3],
      ];
      t0.copy(x1).sub(x0);
      t1.copy(x2).sub(x0);
      t0.cross(t1);
      t1.copy(x3).sub(x0);

      const v0 = t0.dot(t1);
      this.v0[i] = v0; // 6 * v0
      this.mass[i0] += v0;
      this.mass[i1] += v0;
      this.mass[i2] += v0;
      this.mass[i3] += v0;
      massNum[i0] += 1;
      massNum[i1] += 1;
      massNum[i2] += 1;
      massNum[i3] += 1;
    }

    for (let i = 0; i < this.vertLen; i++) {
      if (massNum[i]) {
        this.mass[i] = (this.mass[i] * 100) / massNum[i];
        this.invmass[i] = 1 / this.mass[i];
      }
    }
  }

  bsphere(): THREE.Sphere {
    return this.mesh.geometry.boundingSphere!;
  }

  render() {
    for (let i = 0; i < this.pos.length; i++) {
      this.vert[i * 3] = this.pos[i].x;
      this.vert[i * 3 + 1] = this.pos[i].y;
      this.vert[i * 3 + 2] = this.pos[i].z;
    }

    this.mesh.geometry.computeVertexNormals();
    this.mesh.geometry.attributes.position.needsUpdate = true;
    this.mesh.geometry.computeBoundingSphere();

    this.mesh.geometry.boundingSphere!.radius;

    this.edges.geometry.computeVertexNormals();
    this.edges.geometry.attributes.position.needsUpdate = true;
    this.edges.geometry.computeBoundingSphere();
  }

  setDrag(idx: number, pos?: THREE.Vector3) {
    this.dragIdx = idx;
    this.dragPos = pos;
  }

  reset() {
    // Bunny Reset
    this.pos = [];
    this.vel = [];

    for (let i = 0; i < this.vert.length / 3; i++) {
      this.pos.push(
        new THREE.Vector3(
          this.initPos[3 * i] + this.translate.x,
          this.initPos[3 * i + 1] + this.translate.y,
          this.initPos[3 * i + 2] + this.translate.z
        )
      );
      this.vel.push(new THREE.Vector3(0, 0, 0));
    }

    this.render();
  }

  onStart() {
    this.scene.add(this.mesh);
    this.scene.add(this.edges);
  }

  position(idx: number) {
    return this.pos[idx].clone();
  }

  onFixedUpdate(delta: number) {
    // grav. accel.: 1 m/s^2
    const g = -1;
    let t0 = new THREE.Vector3();
    let t1 = new THREE.Vector3();

    // add gravity + velocity
    for (let i = 0; i < this.vertLen; i++) {
      if (i == this.dragIdx) {
        const dragForce = this.dragPos!.clone().sub(this.pos[i]);
        this.vel[i].add(dragForce.multiplyScalar(delta * 5));
      } else {
        // this.vel[i].y += g * delta;
      }
      t0.copy(this.vel[i]).multiplyScalar(delta);
      this.nextpos[i].copy(this.pos[i]).add(t0);
      this.deltapos[i].set(0, 0, 0);
    }

    // compute volume constraint
    const x31 = new THREE.Vector3();
    const x21 = new THREE.Vector3();
    const x30 = new THREE.Vector3();
    const x20 = new THREE.Vector3();
    const x10 = new THREE.Vector3();
    const d0c = new THREE.Vector3();
    const d1c = new THREE.Vector3();
    const d2c = new THREE.Vector3();
    const d3c = new THREE.Vector3();

    const numSubsteps = this.options.numSubsteps;
    const k = 1 - Math.pow(1 - this.stiffK, numSubsteps);

    for (let n = 0; n < numSubsteps; n++) {
      // distance constraint
      for (let i = 0; this.edgeIdx.length / 2; i++) {
        const i0 = this.edgeIdx[2 * i];
        const i1 = this.edgeIdx[2 * i + 1];
        const x0 = this.nextpos[i0];
        const x1 = this.nextpos[i1];
      }

      // volume constraint
      for (let i = 0; i < this.tetLen; i++) {
        const [i0, i1, i2, i3] = [
          this.tetIdx[4 * i],
          this.tetIdx[4 * i + 1],
          this.tetIdx[4 * i + 2],
          this.tetIdx[4 * i + 3],
        ];

        const [x0, x1, x2, x3] = [
          this.nextpos[i0],
          this.nextpos[i1],
          this.nextpos[i2],
          this.nextpos[i3],
        ];
        x31.copy(x3).sub(x1);
        x21.copy(x2).sub(x1);
        x30.copy(x3).sub(x0);
        x20.copy(x2).sub(x0);
        x10.copy(x1).sub(x0);

        d0c.copy(x31).cross(x21);
        d1c.copy(x20).cross(x30);
        d2c.copy(x30).cross(x10);
        d3c.copy(x10).cross(x20);

        const v = t0.copy(d3c).dot(x30);
        const vdiff = this.v0[i] - v;

        let ccumul = 0;
        ccumul += this.invmass[i0] * d0c.lengthSq();
        ccumul += this.invmass[i1] * d1c.lengthSq();
        ccumul += this.invmass[i2] * d2c.lengthSq();
        ccumul += this.invmass[i3] * d3c.lengthSq();

        const lambda = (k * vdiff) / ccumul;
        d0c.multiplyScalar(this.invmass[i0] * lambda);
        d1c.multiplyScalar(this.invmass[i1] * lambda);
        d2c.multiplyScalar(this.invmass[i2] * lambda);
        d3c.multiplyScalar(this.invmass[i3] * lambda);

        // this.deltapos[i0].add(d0c);
        // this.deltapos[i1].add(d1c);
        // this.deltapos[i2].add(d2c);
        // this.deltapos[i3].add(d3c);

        if (this.dragIdx !== undefined && this.dragIdx >= 0) {
          const d = this.dragIdx;
          if (d == i0 || d == i1 || d == i2 || d == i3) {
            console.log(`${k} ${i} ${lambda} ${this.v0[i]} ${v} ${vdiff}`);
          }
        }

        this.nextpos[i0].add(d0c);
        this.nextpos[i1].add(d1c);
        this.nextpos[i2].add(d2c);
        this.nextpos[i3].add(d3c);
      }

      // for (let i = 0; i < this.vertLen; i++) {
      //   this.nextpos[i].add(this.deltapos[i]);
      // }
    }

    // velocity update
    for (let i = 0; i < this.vertLen; i++) {
      t0.copy(this.nextpos[i]).sub(this.pos[i]).divideScalar(delta);
      this.vel[i].copy(t0);
      this.pos[i].copy(this.nextpos[i]);
    }
  }

  onUpdate(delta: number) {
    this.render();
  }
}
