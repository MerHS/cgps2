// import { Vector3 } from 'three'

class Vector3 {
    x: number
    y: number
    z: number
    constructor(x: number, y: number, z: number) {
        this.x = x
        this.y = y
        this.z = z
    }
    distanceToSquared(that: Vector3): number {
        let x = this.x - that.x
        let y = this.y - that.y
        let z = this.z - that.z
        return x * x + y * y + z * z
    }
}

interface Node {
    point: Vector3
    idx: number
    left: Node | null
    right: Node | null
}

function insertNode(node: Node, idx: number, point: Vector3, xyz: number) {
    if (
        (xyz == 0 && point.x <= node.point.x) ||
        (xyz == 1 && point.y <= node.point.y) ||
        (xyz >= 2 && point.z <= node.point.z)
    ) {
        if (!node.left) {
            node.left = { point, idx, left: null, right: null }
        } else {
            insertNode(node.left, idx, point, (xyz + 1) % 3)
        }
    } else {
        if (!node.right) {
            node.right = { point, idx, left: null, right: null }
        } else {
            insertNode(node.right, idx, point, (xyz + 1) % 3)
        }
    }
}

type BBox = [[number, number, number], [number, number, number]]
function min(a: number, b: number) {
    return a <= b ? a : b
}

function queryNode(
    node: Node,
    point: Vector3,
    distanceSq: number,
    xyz: number,
    box: BBox,
    result: number[]
) {
    let border: number
    let thisBox: BBox
    let thatBox: BBox
    let thisNode: Node | null
    let thatNode: Node | null
    if (xyz == 0) {
        border = node.point.x
        if (point.x <= border) {
            thisNode = node.left
            thatNode = node.right
            thisBox = [box[0], [border, box[1][1], box[1][2]]]
            thatBox = [[border, box[0][1], box[0][2]], box[1]]
        } else {
            thisNode = node.right
            thatNode = node.left
            thatBox = [box[0], [border, box[1][1], box[1][2]]]
            thisBox = [[border, box[0][1], box[0][2]], box[1]]
        }
    } else if (xyz == 1) {
        border = node.point.y
        if (point.y <= border) {
            thisNode = node.left
            thatNode = node.right
            thisBox = [box[0], [box[1][0], border, box[1][2]]]
            thatBox = [[box[0][0], border, box[0][2]], box[1]]
        } else {
            thisNode = node.right
            thatNode = node.left
            thatBox = [box[0], [box[1][0], border, box[1][2]]]
            thisBox = [[box[0][0], border, box[0][2]], box[1]]
        }
    } else {
        border = node.point.z
        if (point.z <= border) {
            thisNode = node.left
            thatNode = node.right
            thisBox = [box[0], [box[1][0], box[1][1], border]]
            thatBox = [[box[0][0], box[0][1], border], box[1]]
        } else {
            thisNode = node.right
            thatNode = node.left
            thatBox = [box[0], [box[1][0], box[1][1], border]]
            thisBox = [[box[0][0], box[0][1], border], box[1]]
        }
    }

    let thatX = min(Math.abs(thatBox[0][0] - point.x), Math.abs(thatBox[1][0] - point.x))
    let thatY = min(Math.abs(thatBox[0][1] - point.y), Math.abs(thatBox[1][1] - point.y))
    let thatZ = min(Math.abs(thatBox[0][2] - point.z), Math.abs(thatBox[1][2] - point.z))

    if (thatX == Infinity || (thatBox[0][0] <= point.x && point.x <= thatBox[1][0])) {
        thatX = 0
    }
    if (thatY == Infinity || (thatBox[0][1] <= point.y && point.y <= thatBox[1][1])) {
        thatY = 0
    }
    if (thatZ == Infinity || (thatBox[0][2] <= point.z && point.z <= thatBox[1][2])) {
        thatZ = 0
    }
    const thatDist = thatX * thatX + thatY * thatY + thatZ * thatZ
    const addThis = node.point.distanceToSquared(point) <= distanceSq
    const nextXYZ = (xyz + 1) % 3

    if (addThis) {
        result.push(node.idx)
    }

    if (!thisNode) {
        if (thatNode && thatDist <= distanceSq) {
            queryNode(thatNode, point, distanceSq, nextXYZ, thatBox, result)
        }
    } else if (!thatNode || thatDist > distanceSq) {
        // prune that
        queryNode(thisNode, point, distanceSq, nextXYZ, thisBox, result)
    } else {
        queryNode(thisNode, point, distanceSq, nextXYZ, thisBox, result)
        queryNode(thatNode, point, distanceSq, nextXYZ, thatBox, result)
    }
}

export class KDTree {
    root?: Node

    insert(point: Vector3, idx: number) {
        if (!this.root) {
            this.root = {
                point,
                idx,
                left: null,
                right: null,
            }
        } else {
            insertNode(this.root, idx, point, 0)
        }
    }

    query(point: Vector3, distance: number): number[] {
        if (!this.root) {
            return []
        }

        let indices: number[] = []

        queryNode(
            this.root,
            point,
            distance * distance,
            0,
            [
                [-Infinity, -Infinity, -Infinity],
                [Infinity, Infinity, Infinity],
            ],
            indices
        )

        return indices
    }
}
