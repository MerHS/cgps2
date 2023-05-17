import * as THREE from "three";
import { Collider, ObjFile, ObjectOption, vecPrint } from "../objs/obj";

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
  edgeRaw: number[];

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
  collIndex: number;

  constructor(
    collIndex: number,
    file: ObjFile,
    scene: THREE.Scene,
    stiffK: number,
    option: ObjectOption,
    translate?: THREE.Vector3,
    color?: number
  ) {
    this.collIndex = collIndex;
    this.scene = scene;
    this.initPos = file["verts"];
    this.pos = [];
    this.nextpos = [];
    this.deltapos = [];
    this.vel = [];
    this.edgeRaw = file.tetEdgeIds;

    this.translate = translate ? translate : new THREE.Vector3(0, 0, 0);

    this.vertLen = file.verts.length / 3;
    this.tetLen = file.tetIds.length / 4;
    this.stiffK = stiffK;
    this.options = option;

    this.mass = Array(this.vertLen).fill(0);
    let massNum = Array(this.vertLen).fill(0);
    this.invmass = Array(this.vertLen).fill(1);
    this.v0 = Array(this.tetLen).fill(0);
    this.l0 = Array(this.edgeRaw.length / 2).fill(0);

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

    const tl = new THREE.Vector3(0, 0, 0);
    for (let i = 0; i < this.l0.length; i++) {
      this.l0[i] = tl
        .copy(this.pos[this.edgeRaw[2 * i]])
        .sub(this.pos[this.edgeRaw[2 * i + 1]])
        .length();
    }

    this.geometry = new THREE.BufferGeometry();
    this.geometry.setIndex(new THREE.BufferAttribute(this.idx, 1));
    this.geometry.setAttribute(
      "position",
      new THREE.BufferAttribute(this.vert, 3)
    );

    const colorHex = color ? color : 0x00f00f;

    this.mesh = new THREE.Mesh(
      this.geometry,
      new THREE.MeshPhongMaterial({ color: colorHex, flatShading: true })
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

  bbox(): THREE.Box3 {
    return this.mesh.geometry.boundingBox!;
  }

  render() {
    for (let i = 0; i < this.pos.length; i++) {
      this.vert[i * 3] = this.pos[i].x;
      this.vert[i * 3 + 1] = this.pos[i].y;
      this.vert[i * 3 + 2] = this.pos[i].z;
    }

    this.mesh.geometry.computeVertexNormals();
    this.mesh.geometry.attributes.position.needsUpdate = true;
    this.mesh.geometry.computeBoundingBox();
    this.mesh.geometry.computeBoundingSphere();

    // this.mesh.geometry.boundingSphere!.radius;

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

  onFixedUpdate_init(delta: number) {
    // grav. accel.: 1 m/s^2
    const g = -3;
    let t0 = new THREE.Vector3();
    let t1 = new THREE.Vector3();

    // add gravity + velocity
    for (let i = 0; i < this.vertLen; i++) {
      if (i == this.dragIdx) {
        const dragForce = this.dragPos!.clone().sub(this.pos[i]);
        if (dragForce.length() > 5) {
          dragForce.normalize().multiplyScalar(5);
        }
        this.vel[i].add(dragForce);
        // this.vel[i].multiplyScalar(0);
      } else {
        this.vel[i].y += g * delta;
      }
      t0.copy(this.vel[i]).multiplyScalar(delta);
      this.nextpos[i].copy(this.pos[i]).add(t0);
      this.deltapos[i].set(0, 0, 0);

      if (i == this.dragIdx) {
        this.nextpos[i].copy(this.dragPos!);
      }
    }
  }

  onFixedUpdate_constr(delta: number) {
    let t0 = new THREE.Vector3();
    let t1 = new THREE.Vector3();

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
      const diff = new THREE.Vector3(0, 0, 0);
      for (let i = 0; i < this.edgeRaw.length / 2; i++) {
        const i0 = this.edgeRaw[2 * i];
        const i1 = this.edgeRaw[2 * i + 1];
        const x0 = this.nextpos[i0];
        const x1 = this.nextpos[i1];
        const w0 = this.invmass[i0];
        const w1 = this.invmass[i1];
        const l0 = this.l0[i];

        diff.copy(x0).sub(x1);
        const len = diff.length();
        diff.multiplyScalar((k * w0 * (len - l0)) / len / (w0 + w1));
        this.nextpos[i0].sub(diff);

        diff.multiplyScalar(w1 / w0);
        this.nextpos[i1].add(diff);
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

        this.nextpos[i0].add(d0c);
        this.nextpos[i1].add(d1c);
        this.nextpos[i2].add(d2c);
        this.nextpos[i3].add(d3c);
      }

      // collision
      const x0 = new THREE.Vector3(0, 0, 0);
      const x1 = new THREE.Vector3(0, 0, 0);
      const x2 = new THREE.Vector3(0, 0, 0);
      const p0 = new THREE.Vector3(0, 0, 0);

      for (let colIdx = 0; colIdx < this.options.colliders.length; colIdx++) {
        if (colIdx == this.collIndex) {
          continue;
        }
        const col = this.options.colliders[colIdx];
        const bbox = col.bbox();

        // static
        if (!bbox) {
          for (let pi = 0; pi < this.vertLen; pi++) {
            let x = this.pos[pi].clone();
            let l = this.nextpos[pi].clone().sub(x);

            let t0max = 1000000;
            let ns: THREE.Vector3 | undefined = undefined;

            for (let i = 0; i < col.idx.length / 3; i++) {
              const [i0, i1, i2] = [
                col.idx[3 * i],
                col.idx[3 * i + 1],
                col.idx[3 * i + 2],
              ];
              x0.set(
                col.vert[i0 * 3],
                col.vert[i0 * 3 + 1],
                col.vert[i0 * 3 + 2]
              );
              x1.set(
                col.vert[i1 * 3],
                col.vert[i1 * 3 + 1],
                col.vert[i1 * 3 + 2]
              );
              x2.set(
                col.vert[i2 * 3],
                col.vert[i2 * 3 + 1],
                col.vert[i2 * 3 + 2]
              );

              t0.copy(x1).sub(x0);
              t1.copy(x2).sub(x0);
              t0.cross(t1).normalize(); // n
              p0.copy(x0);

              const pxt = x0.sub(x).dot(t0);
              // other side
              if (pxt > 0 && t0max > pxt) {
                t0max = pxt;
                ns = t0.clone();
              }
            }

            if (ns) {
              if (t0max > 1) {
                t0max = 1;
              }
              this.nextpos[pi].add(ns.multiplyScalar(t0max));
            }
          }
        } else {
          for (let pi = 0; pi < this.vertLen; pi++) {
            let x = this.pos[pi].clone();
            let l = this.nextpos[pi].clone().sub(x);
            if (bbox.containsPoint(this.nextpos[pi])) {
              for (let i = 0; i < col.idx.length / 3; i++) {
                const [i0, i1, i2] = [
                  col.idx[3 * i],
                  col.idx[3 * i + 1],
                  col.idx[3 * i + 2],
                ];
                x0.set(
                  col.vert[i0 * 3],
                  col.vert[i0 * 3 + 1],
                  col.vert[i0 * 3 + 2]
                );
                x1.set(
                  col.vert[i1 * 3],
                  col.vert[i1 * 3 + 1],
                  col.vert[i1 * 3 + 2]
                );
                x2.set(
                  col.vert[i2 * 3],
                  col.vert[i2 * 3 + 1],
                  col.vert[i2 * 3 + 2]
                );

                t0.copy(x1).sub(x0);
                t1.copy(x2).sub(x0);
                t0.cross(t1).normalize(); // n
                p0.copy(x0);

                const t = p0.sub(x).dot(t0) / l.dot(t0);
                if (1 > t && t > 0) {
                  let xa = x.clone().add(l.multiplyScalar(t));
                  let cp = this.nextpos[pi].clone().sub(xa).dot(t0);
                  if (cp > 0.3) {
                    cp = 0.3;
                  }
                  t1.copy(x1).sub(x0);
                  let pa = t1.cross(xa).dot(t0);
                  t1.copy(x2).sub(x0);
                  let pb = xa.cross(t1).dot(t0);
                  // in triangle
                  if (pa > 0 && pb > 0) {
                    // bound constriant
                    this.nextpos[pi].add(t0.clone().multiplyScalar(cp));
                    break;
                  }
                }
              }
            }
          }
        }
      }
    }
  }

  onFixedUpdate_apply(delta: number) {
    let t0 = new THREE.Vector3();

    // velocity update
    for (let i = 0; i < this.vertLen; i++) {
      t0.copy(this.nextpos[i]).sub(this.pos[i]).divideScalar(delta);

      // clutch velocity
      this.vel[i].copy(t0);
      if (this.vel[i].length() > 5) {
        this.vel[i].normalize().multiplyScalar(5);
      }
      this.pos[i].add(t0.multiplyScalar(delta));
    }
  }

  onUpdate(delta: number) {
    this.render();
  }
}
