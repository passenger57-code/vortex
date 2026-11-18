import { createRef } from "react";
import { fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import VideoPlayer from "./VideoPlayer.jsx";

describe("VideoPlayer", () => {
  afterEach(() => vi.restoreAllMocks());

  it("shows a frame preview after seeking", () => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({ drawImage: vi.fn() });
    vi.spyOn(HTMLCanvasElement.prototype, "toDataURL").mockReturnValue("data:image/jpeg;base64,preview");
    const ref = createRef();
    const { container } = render(<VideoPlayer ref={ref} src="" />);
    Object.defineProperty(ref.current, "videoWidth", { configurable: true, value: 320 });
    Object.defineProperty(ref.current, "videoHeight", { configurable: true, value: 180 });
    Object.defineProperty(ref.current, "currentTime", { configurable: true, value: 42 });

    fireEvent.seeking(ref.current);
    fireEvent.seeked(ref.current);

    expect(container.querySelector('img[src="data:image/jpeg;base64,preview"]')).toBeInTheDocument();
    expect(container.querySelector('[aria-label="Preview at 42 seconds"]')).toBeInTheDocument();
  });
});
