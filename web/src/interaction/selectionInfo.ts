import { getTrainingSession } from '../machine/TrainingSession';
import { isInstallOfferPart } from './partOffer';
import type { HandInteractable } from './registry';
import type { SelectionInfo } from './selectionHub';

function partIdFromInteractable(it: HandInteractable): string {
  const id = it.id;
  const slot = id.indexOf(':install-slot');
  if (slot >= 0) return id.slice(0, slot);
  return id;
}

function hintFor(it: HandInteractable, partId: string): string {
  const mgr = getTrainingSession();
  const st = mgr?.getState(partId);
  if (it.kind === 'grabbable') {
    if (isInstallOfferPart(partId) || st === 'removed') {
      return '抓住 · 放到绿色安装位松手拧上';
    }
    return '已高亮 · 瞄准球靠近后轻握拆下';
  }
  if (it.kind === 'clip') {
    return st === 'clip_closed' ? '已高亮 · 瞄准后轻握打开' : '已高亮 · 瞄准后轻握锁止';
  }
  if (it.kind === 'rotate_nut') {
    if (isInstallOfferPart(partId) || st === 'removed') {
      return '抓住 · 放到安装位松手拧上';
    }
    return '已高亮 · 瞄准球靠近后轻握拧下';
  }
  return '已选中';
}

export function selectionFromInteractable(it: HandInteractable): SelectionInfo {
  const partId = partIdFromInteractable(it);
  const part = getTrainingSession()?.getPart(partId);
  return {
    id: partId,
    displayName: part?.displayName ?? partId,
    kind: it.kind,
    hint: hintFor(it, partId),
  };
}

/** When hand isn't hovering, still show the current SOP install/remove target. */
export function selectionFromSopFallback(): SelectionInfo | null {
  const mgr = getTrainingSession();
  if (!mgr) return null;
  const current = mgr.buildChromeSteps().find((s) => s.status === 'current');
  if (!current) return null;

  let partId: string | null = null;
  let hint = '按 SOP 操作';
  if (current.stepId.startsWith('remove_')) {
    partId = current.stepId.slice('remove_'.length);
    hint = '已高亮 · 瞄准球靠近后轻握拆下';
  } else if (current.stepId.startsWith('install_')) {
    partId = current.stepId.slice('install_'.length);
    hint = isInstallOfferPart(partId)
      ? '右侧已弹出 · 抓住放回安装位'
      : '等待道具弹出';
  } else if (current.stepId.startsWith('open_')) {
    partId = current.stepId.slice('open_'.length);
    hint = '已高亮 · 瞄准后轻握打开';
  } else if (current.stepId.startsWith('close_')) {
    partId = current.stepId.slice('close_'.length);
    hint = '已高亮 · 瞄准后轻握锁止';
  } else if (current.stepId === 'appliance_wash') {
    return {
      id: 'appliance_wash',
      displayName: '家电清洗',
      kind: 'wash',
      hint: '拆完后自动清洗',
    };
  }

  if (!partId) return null;
  const part = mgr.getPart(partId);
  return {
    id: partId,
    displayName: part?.displayName ?? current.label,
    kind: part?.kind ?? 'part',
    hint,
  };
}
