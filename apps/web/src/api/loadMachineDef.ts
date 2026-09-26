import { parseMachineDef, type MachineDef } from '@lhs-vsts/machine';

const CURRENT_MACHINE_URL = '/api/machines/current';

/** Fetch and parse the current MachineDef from the backend API. */
export async function loadMachineDef(
  url: string = CURRENT_MACHINE_URL,
): Promise<MachineDef> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to load MachineDef from ${url}: ${res.status}`);
  }
  const json: unknown = await res.json();
  return parseMachineDef(json);
}
