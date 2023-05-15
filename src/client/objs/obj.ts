import * as THREE from "three";

export interface ObjFile {
  name?: string;
  tetIds: number[];
  verts: number[];
  tetEdgeIds: number[];
  tetSurfaceTriIds: number[];
}

export interface Collider {
  vert: Float32Array; //
  idx: Uint16Array; // tetSurfaceTriIds

  bsphere(): THREE.Sphere;
}

export interface ObjectOption {
  numSubsteps: number;
  colliders: Collider[];
}
