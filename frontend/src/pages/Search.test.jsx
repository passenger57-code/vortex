import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Search from "./Search.jsx";
import { api } from "../lib/api";

vi.mock("../lib/api", () => ({
  api: { get: vi.fn() },
}));

vi.mock("../components/TitleCard.jsx", () => ({
  default: ({ t }) => <div>{t.title}</div>,
}));

describe("Search", () => {
  beforeEach(() => {
    api.get.mockReset();
  });

  it("shows a retryable error instead of treating failed searches as empty results", async () => {
    api.get.mockRejectedValue(new Error("Server unavailable"));
    render(<MemoryRouter initialEntries={["/search?q=Vortex"]}><Search /></MemoryRouter>);

    expect(await screen.findByRole("alert")).toHaveTextContent("Server unavailable");
    expect(screen.queryByText("No matching titles")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry search" })).toBeInTheDocument();
  });

  it("requests type-filtered results when a content filter is selected", async () => {
    api.get.mockResolvedValue([]);
    render(<MemoryRouter initialEntries={["/search?q=Vortex"]}><Search /></MemoryRouter>);
    await screen.findByRole("button", { name: "Anime" });
    fireEvent.click(screen.getByRole("button", { name: "Anime" }));

    await waitFor(() => {
      expect(api.get).toHaveBeenLastCalledWith(expect.stringContaining("&type=anime"));
    });
  });
});
