import { describe, expect, it, vi } from "vitest";
import {
  emitSessionChange,
  emitTip,
  subscribeSession,
  subscribeTips,
} from "../src/sessionEvents.js";

describe("sessionEvents", () => {
  it("notifies tip and session subscribers and unsubscribes", () => {
    const tip = vi.fn();
    const session = vi.fn();
    const unTip = subscribeTips(tip);
    const unSession = subscribeSession(session);

    emitTip("hello");
    emitSessionChange();
    expect(tip).toHaveBeenCalledWith("hello");
    expect(session).toHaveBeenCalledTimes(1);

    unTip();
    unSession();
    emitTip("again");
    emitSessionChange();
    expect(tip).toHaveBeenCalledTimes(1);
    expect(session).toHaveBeenCalledTimes(1);
  });
});
