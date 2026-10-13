// Batches many small parts into one mesh per material, to keep draw calls low.
// Parts are Three.js geometries placed with a matrix; UVs are scaled to metres
// so a material's texture keeps its real size whatever the part's size.
import * as THREE from "three";

const tmpN = new THREE.Matrix3();

export function createBatch() {
  const byMat = new Map(); // material -> { pos: [], nor: [], uv: [] }

  // Add a geometry (indexed or not) under a world/local matrix. uvScale stretches its 0..1 UVs to metres.
  function add(geometry, material, matrix, uvScale = [1, 1]) {
    const g = geometry.index ? geometry.toNonIndexed() : geometry;
    let b = byMat.get(material);
    if (!b) byMat.set(material, (b = { pos: [], nor: [], uv: [] }));
    const p = g.attributes.position, n = g.attributes.normal, uv = g.attributes.uv;
    tmpN.getNormalMatrix(matrix);
    const v = new THREE.Vector3(), nn = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i).applyMatrix4(matrix);
      nn.fromBufferAttribute(n, i).applyMatrix3(tmpN).normalize();
      b.pos.push(v.x, v.y, v.z);
      b.nor.push(nn.x, nn.y, nn.z);
      if (uv) b.uv.push(uv.getX(i) * uvScale[0], uv.getY(i) * uvScale[1]);
      else b.uv.push(0, 0);
    }
    if (g !== geometry) g.dispose();
  }

  // A box with each face's UVs in metres (u along the face's width, v along its height).
  function box(material, matrix, [sx, sy, sz]) {
    const g = new THREE.BoxGeometry(sx, sy, sz);
    const uv = g.attributes.uv;
    // BoxGeometry faces in order +x, -x, +y, -y, +z, -z; 4 vertices each.
    const faceSize = [[sz, sy], [sz, sy], [sx, sz], [sx, sz], [sx, sy], [sx, sy]];
    for (let f = 0; f < 6; f++) for (let k = 0; k < 4; k++) { const i = f * 4 + k; uv.setXY(i, uv.getX(i) * faceSize[f][0], uv.getY(i) * faceSize[f][1]); }
    add(g, material, matrix);
    g.dispose();
  }

  // A box given in Three.js world coordinates, each face with its own material
  // (matFor(normal, centre) -> material, or null to skip the face) and UVs taken
  // from world position, so textures run on unbroken from one box to the next.
  function worldBox(matFor, [x0, x1], [y0, y1], [z0, z1]) {
    const faces = [
      [[1, 0, 0], [[x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1]]],
      [[-1, 0, 0], [[x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0]]],
      [[0, 1, 0], [[x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0]]],
      [[0, -1, 0], [[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]]],
      [[0, 0, 1], [[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]]],
      [[0, 0, -1], [[x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0]]],
    ];
    for (const [n, q] of faces) {
      const c = [(x0 + x1) / 2 + (n[0] * (x1 - x0)) / 2, (y0 + y1) / 2 + (n[1] * (y1 - y0)) / 2, (z0 + z1) / 2 + (n[2] * (z1 - z0)) / 2];
      const material = matFor(n, c);
      if (!material) continue;
      let b = byMat.get(material);
      if (!b) byMat.set(material, (b = { pos: [], nor: [], uv: [] }));
      const uvOf = (v) => (n[0] ? [v[2] * -n[0], v[1]] : n[1] ? [v[0], v[2] * -n[1]] : [v[0] * n[2], v[1]]);
      for (const i of [0, 1, 2, 0, 2, 3]) {
        b.pos.push(...q[i]);
        b.nor.push(...n);
        b.uv.push(...uvOf(q[i]));
      }
    }
  }

  // One mesh per material. Group them under `group`; tag each with userData.
  function build(group, userData = {}) {
    for (const [material, b] of byMat) {
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.Float32BufferAttribute(b.pos, 3));
      g.setAttribute("normal", new THREE.Float32BufferAttribute(b.nor, 3));
      g.setAttribute("uv", new THREE.Float32BufferAttribute(b.uv, 2));
      g.computeBoundingSphere();
      const mesh = new THREE.Mesh(g, material);
      mesh.name = `${userData.name ?? "batch"}:${material.name}`;
      Object.assign(mesh.userData, userData);
      group.add(mesh);
    }
    byMat.clear();
    return group;
  }

  return { add, box, worldBox, build };
}
