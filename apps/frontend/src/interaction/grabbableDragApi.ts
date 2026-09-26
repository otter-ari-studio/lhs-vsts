import { Vector3 } from "three";
import { getTrainingSession } from "@lhs-vsts/machine";
import type { PartDef } from "@lhs-vsts/machine";
import {
  COLLIDER_RADIUS,
  INSTALLED_PICK_PRIORITY,
  REMOVED_PICK_PRIORITY,
  SOP_PICK_PRIORITY,
} from "./defaults";
import { setGrabHolding } from "./grabHoldHub";
import { INVENTORY_PARK, partInventory } from "./partInventory";
import { isInstallOfferPart, PROP_OFFER_POS } from "./partOffer";
import { surfaceDistance } from "./operationSurface";
import type { HandInteractable } from "./registry";
import { detectLateralThrow, pushThrowSample, type ThrowSample } from "./throwDetect";

export interface GrabbableDragHost {
  part: PartDef;
  snapRange: number;
  /** Mutable world pose of the part mesh (same role as R3F group). */
  worldPos: Vector3;
  isSopTarget: () => boolean;
  setVisible?: (visible: boolean) => void;
  tipShown?: { current: boolean };
  onInventory?: (inInventory: boolean) => void;
  onOffered?: (offered: boolean) => void;
  onInstalledSpin?: () => void;
}

/**
 * Grab / drag / release behavior shared by GrabPart and automated 3D drag tests.
 */
export function createGrabbableDragApi(host: GrabbableDragHost): HandInteractable {
  const grabbed = { current: false };
  const grabOffset = new Vector3();
  const throwBuf: ThrowSample[] = [];
  const installedPos = new Vector3(...host.part.anchor.position);
  const tipShown = host.tipShown ?? { current: false };
  const followPos = host.worldPos;
  const _tmp = new Vector3();

  const self: HandInteractable = {
    id: host.part.partId,
    kind: "grabbable",
    interactionRadius: COLLIDER_RADIUS.grabbable,
    isInteractableNow() {
      if (grabbed.current) return false;
      const mgr = getTrainingSession();
      if (!mgr) return true;
      const st = mgr.getState(host.part.partId);
      if (st === "installed") return host.isSopTarget();
      if (st === "removed" && isInstallOfferPart(host.part.partId)) return true;
      if (partInventory.has(host.part.partId)) return false;
      if (st === "removed") return host.isSopTarget();
      return false;
    },
    pickPriority() {
      if (isInstallOfferPart(host.part.partId)) return SOP_PICK_PRIORITY + 1;
      if (host.isSopTarget()) return SOP_PICK_PRIORITY;
      const mgr = getTrainingSession();
      const st = mgr?.getState(host.part.partId);
      if (st === "removed") return REMOVED_PICK_PRIORITY;
      return INSTALLED_PICK_PRIORITY;
    },
    distanceTo(handPos) {
      return surfaceDistance(
        [handPos.x, handPos.y, handPos.z],
        [followPos.x, followPos.y, followPos.z],
      );
    },
    copyWorldPosition(out) {
      out.copy(followPos);
      return true;
    },
    onPinchStart(handPos) {
      if (grabbed.current) return true;
      const mgr = getTrainingSession();
      const st = mgr?.getState(host.part.partId) ?? "installed";
      if (st === "installed") {
        if (!mgr?.tryBeginRemove(host.part.partId)) return false;
        mgr.notifyRemoved(host.part.partId);
      }
      grabbed.current = true;
      throwBuf.length = 0;
      setGrabHolding(host.part.partId, true);
      grabOffset.set(followPos.x - handPos.x, followPos.y - handPos.y, 0);
      if (mgr && !tipShown.current) {
        tipShown.current = true;
        mgr.tip("点击取下零件，拖到左侧入栏；回装时拖回安装位松手");
      }
      return true;
    },
    onPinchHold(handPos) {
      if (!grabbed.current) return;
      followPos.copy(handPos).add(grabOffset);
      followPos.z = installedPos.z;
      pushThrowSample(throwBuf, performance.now(), handPos.x);
    },
    onPinchEnd(handPos) {
      if (!grabbed.current) return;
      grabbed.current = false;
      setGrabHolding(host.part.partId, false);
      const mgr = getTrainingSession();
      if (!mgr) return;
      const range = Math.max(host.part.snapRangeMeters ?? host.snapRange, 0.18);
      _tmp.copy(followPos);
      pushThrowSample(throwBuf, performance.now(), handPos.x);
      const throwDir = detectLateralThrow(throwBuf);
      throwBuf.length = 0;

      const slot: [number, number, number] = [installedPos.x, installedPos.y, installedPos.z];
      const partNear = surfaceDistance([_tmp.x, _tmp.y, _tmp.z], slot) <= range;
      const pointerNear = surfaceDistance([handPos.x, handPos.y, handPos.z], slot) <= range;
      if ((partNear || pointerNear) && mgr.canInstall(host.part.partId)) {
        if (mgr.tryInstall(host.part.partId)) {
          partInventory.dequeue(host.part.partId);
          followPos.copy(installedPos);
          host.setVisible?.(true);
          host.onInventory?.(false);
          host.onOffered?.(false);
          host.onInstalledSpin?.();
          mgr.tip(`✅ 已自动拧上 ${host.part.displayName}`);
          return;
        }
      }

      if (mgr.getState(host.part.partId) === "removed") {
        if (isInstallOfferPart(host.part.partId)) {
          followPos.set(...PROP_OFFER_POS);
          host.setVisible?.(true);
          host.onOffered?.(true);
          mgr.tip("放到机身安装位松手，即可自动拧上");
          return;
        }
        partInventory.enqueue(host.part.partId);
        followPos.set(...INVENTORY_PARK);
        host.setVisible?.(false);
        host.onInventory?.(true);
        host.onOffered?.(false);
        if (throwDir) {
          mgr.tip(
            throwDir === "left" ? "已甩向左侧 · 零件进入物品栏" : "已甩向右侧 · 零件进入物品栏",
          );
        } else {
          mgr.tip("零件已进入左侧物品栏");
        }
        return;
      }

      mgr.notifyToleranceFail(host.part.partId);
      followPos.copy(installedPos);
    },
    onHover() {},
  };

  Object.defineProperty(self, "interactionRadius", {
    get() {
      return host.isSopTarget() || isInstallOfferPart(host.part.partId)
        ? COLLIDER_RADIUS.grabbable + 0.06
        : COLLIDER_RADIUS.grabbable;
    },
    enumerable: true,
    configurable: true,
  });

  return self;
}
