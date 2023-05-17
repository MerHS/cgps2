import * as THREE from "three";
import { GUI } from "dat.gui";

import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import { SoftBodyObject } from "./softbody";
import { bunnyData } from "../objs/bunny";
import { Collider, ObjFile, ObjectOption, vecPrint } from "../objs/obj";
import { RigidBodyObject } from "./rigidbody";

const boxGeo = new THREE.BoxGeometry(1, 1, 1);
const basicMat = new THREE.MeshNormalMaterial({
  transparent: true,
  side: THREE.BackSide,
  opacity: 0.3,
});

export class World {
  scene: THREE.Scene;
  camera: THREE.Camera;
  renderer: THREE.Renderer;
  gui: GUI;
  control: OrbitControls;

  boundary: number;
  boundingBox: THREE.Mesh;
  paused: boolean;

  timeStep: number;
  timeAccum: number;
  numSubSteps: number;

  raycaster: THREE.Raycaster;
  softBodies: SoftBodyObject[];
  rigidBodies: RigidBodyObject[];
  sharedOptions: ObjectOption;
  hoverObj?: SoftBodyObject;
  hoverFace?: THREE.Face;

  constructor(
    scene: THREE.Scene,
    camera: THREE.Camera,
    renderer: THREE.Renderer
  ) {
    this.scene = scene;
    this.camera = camera;
    this.renderer = renderer;
    this.gui = new GUI();
    this.control = new OrbitControls(camera, renderer.domElement);

    this.boundary = 10;
    this.boundingBox = new THREE.Mesh(boxGeo, basicMat);
    this.boundingBox.scale.set(this.boundary, this.boundary, this.boundary);
    this.boundingBox.position.set(0, this.boundary / 2 + 0.001, 0);

    this.paused = false;
    this.timeStep = 0.03; // 30 fps
    this.numSubSteps = 5;
    this.hoverObj = undefined;

    this.sharedOptions = {
      numSubsteps: this.numSubSteps,
      colliders: [],
    };
    this.timeAccum = 0;

    this.raycaster = new THREE.Raycaster();
    this.softBodies = [];
    this.rigidBodies = [];

    const bunny = new SoftBodyObject(
      0,
      bunnyData,
      this.scene,
      0.7,
      this.sharedOptions,
      new THREE.Vector3(0, 2, 0)
    );

    const backColl: Collider = {
      vert: new Float32Array([
        -5, 0, -5, 5, 0, -5, 5, 0, 5, -5, 0, 5, -5, 10, -5, 5, 10, -5, 5, 10, 5,
        -5, 10, 5,
      ]),
      idx: new Uint16Array([
        0, 3, 1, 1, 3, 2, 6, 2, 7, 7, 2, 3, 6, 5, 2, 5, 1, 2, 4, 1, 5, 4, 0, 1,
        4, 7, 3, 4, 3, 0, 4, 5, 7, 7, 5, 6,
      ]),
      bbox: function () {
        return undefined;
      },
    };

    const cubeObj: ObjFile = {
      name: "cube",
      verts: [
        1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 1, 2, 1, 2, 1, 2, 2, 1, 2, 2, 2, 1, 2, 2,
      ],
      tetIds: [0, 3, 2, 7, 0, 2, 1, 5, 4, 5, 7, 0, 5, 6, 7, 2, 5, 2, 7, 0],
      tetEdgeIds: [
        0, 1, 1, 2, 2, 3, 3, 0, 0, 2, 0, 4, 1, 5, 2, 6, 3, 7, 0, 7, 2, 7, 2, 5,
        0, 5, 4, 5, 5, 6, 6, 7, 7, 4, 5, 7,
      ],
      tetSurfaceTriIds: [
        0, 1, 2, 0, 2, 3, 0, 3, 7, 0, 7, 4, 2, 7, 3, 2, 6, 7, 1, 5, 2, 2, 5, 6,
        1, 0, 5, 0, 4, 5, 4, 7, 5, 5, 7, 6,
      ],
    };

    const tetObj: ObjFile = {
      name: "tet",
      verts: [3, 3, 3, 3, 4, 3, 3, 4, 4, 4, 4, 4],
      tetIds: [0, 1, 2, 3],
      tetEdgeIds: [0, 1, 1, 2, 2, 0, 0, 3, 1, 3, 2, 3],
      tetSurfaceTriIds: [0, 2, 1, 0, 1, 3, 1, 2, 3, 2, 0, 3],
    };

    const cube = new SoftBodyObject(
      1,
      cubeObj,
      this.scene,
      1,
      this.sharedOptions
    );
    // const tet = new SoftBodyObject(tetObj, this.scene, 1, this.sharedOptions);

    this.softBodies.push(bunny);
    // this.softBodies.push(cube);
    // this.softBodies.push(tet);

    this.sharedOptions.colliders.push(bunny);
    // this.sharedOptions.colliders.push(cube);
    // this.sharedOptions.colliders.push(tet);
    this.sharedOptions.colliders.push(backColl);

    const world = this;
    function onMouseDown(e: MouseEvent) {
      const mouse = {
        x: (e.clientX / window.innerWidth) * 2 - 1,
        y: -(e.clientY / window.innerHeight) * 2 + 1,
      };
      world.raycaster.setFromCamera(mouse, world.camera);

      const meshes = world.softBodies.map((s) => s.mesh);
      const intersects = world.raycaster.intersectObjects(meshes);

      if (intersects.length > 0) {
        const ip = intersects[0]!;
        let index = -1;
        for (let i = 0; i < world.softBodies.length; i++) {
          if (world.softBodies[i].mesh == ip.object) {
            index = i;
            break;
          }
        }

        // ip.index
        console.log(
          `Hit ${ip.point.x}, ${ip.point.y}, ${ip.point.z}, ${ip.face?.a}, ${ip.face?.b}, ${ip.face?.c}, ${ip.faceIndex}, ${index}`
        );

        world.hoverObj = world.softBodies[index];
        world.hoverFace = ip.face!;
        world.control.enabled = false;
      }
    }

    function onMouseUp(e: MouseEvent) {
      world.hoverObj?.setDrag(-1);
      world.hoverObj = undefined;
      world.hoverFace = undefined;
      world.control.enabled = true;
    }

    window.addEventListener("mousedown", onMouseDown, false);
    window.addEventListener("mouseup", onMouseUp, false);
  }

  pause() {
    this.paused = !this.paused;
    // this.boundingBox.visible = !this.paused;
  }

  reset() {
    for (const body of this.softBodies) {
      body.reset();
    }

    for (const body of this.rigidBodies) {
      body.reset();
    }

    let lookat = new THREE.Vector3(0, 0, -1);
    lookat.applyQuaternion(this.camera.quaternion);
  }

  addSoft() {
    const color = Math.floor(Math.random() * 16777216);
    const pos = new THREE.Vector3(
      Math.random() * 10 - 5,
      Math.random() * 3 + 3,
      Math.random() * 10 - 5
    );
    const bunny = new SoftBodyObject(
      this.sharedOptions.colliders.length,
      bunnyData,
      this.scene,
      0.7,
      this.sharedOptions,
      pos,
      color
    );
    this.softBodies.push(bunny);
    this.sharedOptions.colliders.push(bunny);
    bunny.onStart();
  }

  addRigid() {
    const color = Math.floor(Math.random() * 16777216);
    const pos = new THREE.Vector3(
      Math.random() * 10 - 5,
      Math.random() * 3 + 3,
      Math.random() * 10 - 5
    );
    const cubeObj: ObjFile = {
      name: "cube",
      verts: [
        1, 1, 1, 2, 1, 1, 2, 1, 2, 1, 1, 2, 1, 2, 1, 2, 2, 1, 2, 2, 2, 1, 2, 2,
      ],
      tetIds: [0, 3, 2, 7, 0, 2, 1, 5, 4, 5, 7, 0, 5, 6, 7, 2, 5, 2, 7, 0],
      tetEdgeIds: [
        0, 1, 1, 2, 2, 3, 3, 0, 0, 2, 0, 4, 1, 5, 2, 6, 3, 7, 0, 7, 2, 7, 2, 5,
        0, 5, 4, 5, 5, 6, 6, 7, 7, 4, 5, 7,
      ],
      tetSurfaceTriIds: [
        0, 1, 2, 0, 2, 3, 0, 3, 7, 0, 7, 4, 2, 7, 3, 2, 6, 7, 1, 5, 2, 2, 5, 6,
        1, 0, 5, 0, 4, 5, 4, 7, 5, 5, 7, 6,
      ],
    };

    const cube = new SoftBodyObject(
      this.sharedOptions.colliders.length,
      cubeObj,
      this.scene,
      1,
      this.sharedOptions,
      pos,
      color
    );

    // const sphere = new RigidBodyObject(
    //   this.sharedOptions.colliders.length,
    //   this.scene,
    //   this.sharedOptions,
    //   0.3,
    //   pos,
    //   color
    // );

    this.softBodies.push(cube);
    this.sharedOptions.colliders.push(cube);
    cube.onStart();
  }

  onStart() {
    this.scene.add(this.boundingBox);

    this.gui.add(this, "pause").name("Pause");
    this.gui.add(this, "reset").name("Reset");
    this.gui.add(this, "addSoft").name("Add Softbody");
    this.gui.add(this, "addRigid").name("Add Rigidbody");
    this.gui.add(this, "timeStep", 0.001, 0.3, 0.001).name("Time Step");

    this.gui.add(this, "numSubSteps", 1, 50, 1).onChange((v) => {
      this.sharedOptions.numSubsteps = v;
    });

    for (const body of this.softBodies) {
      body.onStart();
    }
  }

  onUpdate(mouse: { x: number; y: number }, delta: number) {
    if (!this.hoverObj) {
      this.control.update();
    } else {
      this.raycaster.setFromCamera(mouse, this.camera);
      const ray = this.raycaster.ray;
      const lookat = new THREE.Vector3(0, 0, -1);
      lookat.applyQuaternion(this.camera.quaternion);
      const l0 = ray.origin;
      const l = ray.direction;
      const p0 = this.hoverObj.position(this.hoverFace!.a);
      l.multiplyScalar(p0.sub(l0).dot(lookat) / l.dot(lookat));
      l0.add(l);

      this.hoverObj.setDrag(this.hoverFace!.a, l0);
      this.control.enabled = false;
    }

    // Fixed update
    if (!this.paused) {
      this.timeAccum += delta;
      while (this.timeAccum >= this.timeStep) {
        for (const body of this.softBodies) {
          body.onFixedUpdate_init(this.timeStep);
        }

        for (const body of this.rigidBodies) {
          body.onFixedUpdate_init(this.timeStep);
        }

        for (const body of this.softBodies) {
          body.onFixedUpdate_constr(this.timeStep);
        }

        for (const body of this.softBodies) {
          body.onFixedUpdate_apply(this.timeStep);
        }

        for (const body of this.rigidBodies) {
          body.onFixedUpdate_apply(this.timeStep);
        }

        // console.log(this.softBodies[0].mesh.geometry.attributes.position);

        this.timeAccum -= this.timeStep;
      }
    }

    // render
    for (const body of this.softBodies) {
      body.onUpdate(delta);
    }

    for (const body of this.rigidBodies) {
      body.onUpdate(delta);
    }
  }
}
