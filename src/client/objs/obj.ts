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

  bbox(): THREE.Box3 | undefined;
}

export interface ObjectOption {
  numSubsteps: number;
  colliders: Collider[];
}

export function vecPrint(vec: THREE.Vector3): String {
  return `(${vec.x.toFixed(4)}, ${vec.y.toFixed(4)}, ${vec.z.toFixed(4)})`;
}
