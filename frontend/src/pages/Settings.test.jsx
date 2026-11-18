import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Settings from "./Settings.jsx";
import { useAuth } from "../lib/auth.jsx";

vi.mock("../lib/auth.jsx", () => ({
  useAuth: vi.fn(),
}));

describe("Settings", () => {
  afterEach(() => vi.unstubAllGlobals());

  beforeEach(() => {
    window.localStorage.clear();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => [] }));
    useAuth.mockReturnValue({
      profile: { name: "Viewer" },
      profileId: 7,
      logout: vi.fn(),
    });
  });

  it("saves playback preferences for the active profile", async () => {
    render(<MemoryRouter><Settings /></MemoryRouter>);
    await screen.findByText("No active sessions found.");
    fireEvent.change(screen.getByLabelText(/Default playback speed/), { target: { value: "1.5" } });
    expect(window.localStorage.getItem("vortex_profile_7_playback_rate")).toBe("1.5");
    expect(screen.getByText("Settings saved on this device.")).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText(/Show subtitles by default/));
    expect(window.localStorage.getItem("vortex_profile_7_subtitles_enabled")).toBe("false");
  });

  it("shows active account sessions", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [{ id: "session-1", current: true, user_agent: "", last_seen_at: "2026-11-17T00:00:00Z" }],
    }));
    render(<MemoryRouter><Settings /></MemoryRouter>);
    expect(await screen.findByText("This device")).toBeInTheDocument();
  });
});
