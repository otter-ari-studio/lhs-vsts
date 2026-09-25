import { Matrix4, Quaternion, Vector3 } from 'three';

export type AxisSource = 'x' | 'y' | 'z';

export interface AxisMapConfig {
  unityXFrom: AxisSource;
  invertX: boolean;
  unityYFrom: AxisSource;
  invertY: boolean;
  unityZFrom: AxisSource;
  invertZ: boolean;
}

/** Match Unity UdpHandDataReceiver defaults: flip Y and Z. */
export const DEFAULT_AXIS_MAP: AxisMapConfig = {
  unityXFrom: 'x',
  invertX: false,
  unityYFrom: 'y',
  invertY: true,
  unityZFrom: 'z',
  invertZ: true,
};

const AXIS_INDEX: Record<AxisSource, number> = { x: 0, y: 1, z: 2 };

function srcAxis(axis: AxisSource, invert: boolean): [number, number, number] {
  const v: [number, number, number] = [0, 0, 0];
  v[AXIS_INDEX[axis]] = invert ? -1 : 1;
  return v;
}

/** Build a Matrix4 that maps capture-space points (no translation). */
export function buildMapMatrix(cfg: AxisMapConfig = DEFAULT_AXIS_MAP): Matrix4 {
  const sx = AXIS_INDEX[cfg.unityXFrom];
  const sy = AXIS_INDEX[cfg.unityYFrom];
  const sz = AXIS_INDEX[cfg.unityZFrom];
  let xFrom = cfg.unityXFrom;
  let yFrom = cfg.unityYFrom;
  let zFrom = cfg.unityZFrom;
  let invertX = cfg.invertX;
  let invertY = cfg.invertY;
  let invertZ = cfg.invertZ;
  if (sx === sy || sx === sz || sy === sz) {
    console.warn(
      `[axisMap] illegal axis config ${cfg.unityXFrom}/${cfg.unityYFrom}/${cfg.unityZFrom}, using identity`,
    );
    xFrom = 'x';
    yFrom = 'y';
    zFrom = 'z';
    invertX = false;
    invertY = false;
    invertZ = false;
  }
  const r0 = srcAxis(xFrom, invertX);
  const r1 = srcAxis(yFrom, invertY);
  const r2 = srcAxis(zFrom, invertZ);
  // Three.js Matrix4 is column-major; set rows like Unity SetRow for MultiplyPoint3x4.
  const m = new Matrix4();
  m.set(
    r0[0],
    r0[1],
    r0[2],
    0,
    r1[0],
    r1[1],
    r1[2],
    0,
    r2[0],
    r2[1],
    r2[2],
    0,
    0,
    0,
    0,
    1,
  );
  return m;
}

const _v = new Vector3();
const _rm = new Matrix4();
const _tmp = new Matrix4();
const _mT = new Matrix4();
const _q = new Quaternion();

export function mapPoint(p: Vector3, map: Matrix4, out = new Vector3()): Vector3 {
  return out.copy(p).applyMatrix4(map);
}

export function mapPointTuple(
  p: readonly [number, number, number],
  map: Matrix4,
): [number, number, number] {
  mapPoint(_v.set(p[0], p[1], p[2]), map, _v);
  return [_v.x, _v.y, _v.z];
}

/** Capture rotation → scene: M · R(q) · M⁻¹ (M orthogonal). */
export function mapRotation(q: Quaternion, map: Matrix4, out = new Quaternion()): Quaternion {
  _rm.makeRotationFromQuaternion(q);
  _mT.copy(map).transpose();
  _tmp.multiplyMatrices(map, _rm).multiply(_mT);
  return out.setFromRotationMatrix(_tmp);
}

export function mapRotationTuple(
  q: readonly [number, number, number, number],
  map: Matrix4,
): [number, number, number, number] {
  mapRotation(_q.set(q[0], q[1], q[2], q[3]), map, _q);
  return [_q.x, _q.y, _q.z, _q.w];
}
