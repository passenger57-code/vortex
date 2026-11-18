import { fireEvent, render, screen } from "@testing-library/react";
import { useLocation, MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import MiniPlayerDock from "./MiniPlayerDock.jsx";
import { MiniPlayerProvider, useMiniPlayer } from "../lib/miniPlayer.jsx";

vi.mock("./VideoPlayer.jsx", async () => {
  const React = await import("react");
  return {
    default: React.forwardRef((props, ref) => {
      React.useImperativeHandle(ref, () => ({ currentTime: props.startAt }), [props.startAt]);
      return React.createElement("div", { "data-testid": "mini-video", "data-src": props.src });
    }),
  };
});

function StartMiniPlayer() {
  const { startMiniPlayer } = useMiniPlayer();
  return <button type="button" onClick={() => startMiniPlayer({
    titleId: 7, title: "Test show", episodeId: 9, episodeName: "Episode 1",
    src: "/signed-video.mp4", subtitle: null, currentTime: 32, profileId: 1,
  })}>Start mini player</button>;
}

function WatchLocation() {
  const location = useLocation();
  return <p>Resume at {location.state?.miniResumeAt}</p>;
}

describe("MiniPlayerDock", () => {
  it("keeps playback docked while browsing and can return to the episode", () => {
    render(
      <MemoryRouter initialEntries={["/browse"]}>
        <MiniPlayerProvider>
          <Routes>
            <Route path="/browse" element={<p>Browse titles</p>} />
            <Route path="/watch/:id" element={<WatchLocation />} />
          </Routes>
          <StartMiniPlayer />
          <MiniPlayerDock />
        </MiniPlayerProvider>
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Start mini player" }));
    expect(screen.getByText("Browse titles")).toBeInTheDocument();
    expect(screen.getByLabelText("Mini player")).toBeInTheDocument();
    expect(screen.getByTestId("mini-video")).toHaveAttribute("data-src", "/signed-video.mp4");
    fireEvent.click(screen.getByRole("button", { name: "Return to full player" }));
    expect(screen.getByText("Resume at 32")).toBeInTheDocument();
    expect(screen.queryByLabelText("Mini player")).not.toBeInTheDocument();
  });
});
