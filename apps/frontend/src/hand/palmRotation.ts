import { Matrix4, Quaternion, Vector3 } from "three";
import type { Quat, Vec3 } from "./types";

const _wrist = new Vector3();
const _index = new Vector3();
const _pinky = new Vector3();
const _middle = new Vector3();
const _x = new Vector3();
const _y = new Vector3();
const _z = new Vector3();
const _m = new Matrix4();
const _q = new Quaternion();

const IDENTITY: Quat = [0, 0, 0, 1];

/**
 * Rough palm orientation from wrist / index / pinky / middle MCP landmarks.
 * Returns x,y,z,w quaternion in the same space as the landmarks.
 */
export function estimatePalmRotation(landmarks: readonly Vec3[]): Quat {
  if (landmarks.length < 18) return IDENTITY;

  _wrist.set(landmarks[0][0], landmarks[0][1], landmarks[0][2]);
  _index.set(landmarks[5][0], landmarks[5][1], landmarks[5][2]);
  _pinky.set(landmarks[17][0], landmarks[17][1], landmarks[17][2]);
  _middle.set(landmarks[9][0], landmarks[9][1], landmarks[9][2]);

  // +Z roughly along palm toward fingers
  _z.copy(_middle).sub(_wrist);
  if (_z.lengthSq() < 1e-8) return IDENTITY;
  _z.normalize();

  // +X across palm (index − pinky)
  _x.copy(_index).sub(_pinky);
  if (_x.lengthSq() < 1e-8) return IDENTITY;
  _x.normalize();

  // Orthonormalize
  _y.copy(_z).cross(_x);
  if (_y.lengthSq() < 1e-8) return IDENTITY;
  _y.normalize();
  _x.copy(_y).cross(_z).normalize();

  _m.makeBasis(_x, _y, _z);
  _q.setFromRotationMatrix(_m);
  return [_q.x, _q.y, _q.z, _q.w];
}
