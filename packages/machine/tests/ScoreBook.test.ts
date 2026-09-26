import { describe, expect, it } from "vite-plus/test";
import { createScoreBook } from "../src/ScoreBook.js";
import { miniDef } from "./fixtures.js";

describe("ScoreBook", () => {
  it("deducts and records faultLog", () => {
    const book = createScoreBook(miniDef.scoring, { cooldownMs: 0 });
    expect(book.getScore()).toBe(100);
    expect(book.deduct("a", 5, "illegal", 1000)).toBe(true);
    expect(book.getScore()).toBe(95);
    expect(book.getFaultLog()).toHaveLength(1);
    expect(book.snapshot().faultLog[0]?.reason).toBe("illegal");
  });

  it("cooldown blocks repeated deduct on same key", () => {
    const book = createScoreBook(miniDef.scoring, { cooldownMs: 1500 });
    expect(book.deduct("k", 5, "t1", 1000)).toBe(true);
    expect(book.deduct("k", 5, "t2", 1200)).toBe(false);
    expect(book.getScore()).toBe(95);
    expect(book.deduct("k", 5, "t3", 2600)).toBe(true);
    expect(book.getScore()).toBe(90);
  });

  it("clamps applied amount when amount exceeds score", () => {
    const book = createScoreBook({ ...miniDef.scoring, baseScore: 3 }, { cooldownMs: 0 });
    expect(book.deduct("x", 10, "big", 1)).toBe(true);
    expect(book.getScore()).toBe(0);
    expect(book.getFaultLog()[0]?.amount).toBe(3);
  });
});
