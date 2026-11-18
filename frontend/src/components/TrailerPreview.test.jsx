import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import TrailerPreview from "./TrailerPreview.jsx";

describe("TrailerPreview", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("plays a YouTube preview muted after the hover delay", () => {
    vi.useFakeTimers();
    render(<TrailerPreview url="https://www.youtube.com/watch?v=abcdefghijk" title="Sample" active />);

    expect(screen.queryByTitle("Sample muted trailer preview")).not.toBeInTheDocument();
    act(() => vi.advanceTimersByTime(800));

    const frame = screen.getByTitle("Sample muted trailer preview");
    expect(frame.src).toContain("youtube-nocookie.com/embed/abcdefghijk");
    expect(frame.src).toContain("mute=1");
    expect(frame.src).toContain("autoplay=1");
  });

  it("ignores unsupported trailer URLs", () => {
    render(<TrailerPreview url="https://example.com/trailer.mp4" title="Sample" active />);
    expect(screen.queryByTitle("Sample muted trailer preview")).not.toBeInTheDocument();
  });
});
