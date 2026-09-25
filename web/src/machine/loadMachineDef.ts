import { parseMachineDef } from './parseMachineDef';
import type { MachineDef } from './types';

const DEFAULT_MACHINE_URL = '/machines/range_hood_generic.json';

/** Fetch and parse a MachineDef JSON from static hosting. */
export async function loadMachineDef(
  url: string = DEFAULT_MACHINE_URL,
): Promise<MachineDef> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to load MachineDef from ${url}: ${res.status}`);
  }
  const json: unknown = await res.json();
  return parseMachineDef(json);
}
