import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import BrowseBy, { BrowseGrid } from "./BrowseBy.jsx";
import { api } from "../lib/api.js";

vi.mock("../lib/api.js", () => ({ api: { get: vi.fn() } }));
vi.mock("../components/TitleCard.jsx", () => ({
  default: ({ t }) => <div data-testid="catalog-title">{t.title}</div>,
}));

const facets = {
  genres: [{ slug: "drama", name: "Drama" }],
  years: [2024, 2020],
  studios: [{ slug: "blue-studio", name: "Blue Studio" }],
  audio_modes: ["sub", "dub"],
  statuses: ["airing", "completed", "upcoming"],
};

describe("Browse by pages", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.get.mockImplementation((path) => {
      if (path === "/browse/facets") return Promise.resolve(facets);
      if (path.startsWith("/browse/titles")) return Promise.resolve({ items: [{ id: 1, title: "Sky Journey", type: "anime" }], total: 1 });
      return Promise.resolve([]);
    });
  });

  it("links to genre, year, and studio catalog pages", async () => {
    render(<MemoryRouter><BrowseBy /></MemoryRouter>);
    expect(await screen.findByRole("link", { name: /Drama/ })).toHaveAttribute("href", "/browse/genre/drama");
    expect(screen.getByRole("link", { name: /2024/ })).toHaveAttribute("href", "/browse/year/2024");
    expect(screen.getByRole("link", { name: /Blue Studio/ })).toHaveAttribute("href", "/browse/studio/blue-studio");
  });

  it("loads a grid with sticky filters and requests the selected audio mode", async () => {
    render(
      <MemoryRouter initialEntries={["/browse/genre/drama"]}>
        <Routes><Route path="/browse/genre/:slug" element={<BrowseGrid category="genre" />} /></Routes>
      </MemoryRouter>,
    );
    expect(await screen.findByTestId("catalog-title")).toHaveTextContent("Sky Journey");
    expect(document.querySelector(".sticky.top-16")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Audio"), { target: { value: "dub" } });
    await waitFor(() => expect(api.get).toHaveBeenCalledWith(expect.stringContaining("audio_mode=dub")));
    expect(api.get).toHaveBeenCalledWith(expect.stringContaining("genre=drama"));
  });
});
