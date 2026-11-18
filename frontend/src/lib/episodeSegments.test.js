import { describe, expect, it } from "vitest";
import { activeSegmentAction } from "./episodeSegments.js";

describe("episode segment actions", () => {
  const episode = { intro_start: 5, intro_end: 50, recap_start: 60, recap_end: 85 };

  it("offers Skip intro only during the first ten seconds of its marker", () => {
    expect(activeSegmentAction(episode, 4.9)).toBeNull();
    expect(activeSegmentAction(episode, 5)).toBe("intro");
    expect(activeSegmentAction(episode, 14.9)).toBe("intro");
    expect(activeSegmentAction(episode, 15)).toBeNull();
  });

  it("offers Skip recap only within the marked recap", () => {
    expect(activeSegmentAction(episode, 60)).toBe("recap");
    expect(activeSegmentAction(episode, 84.9)).toBe("recap");
    expect(activeSegmentAction(episode, 85)).toBeNull();
    expect(activeSegmentAction({ intro_start: null, intro_end: null }, 1)).toBeNull();
  });
});
