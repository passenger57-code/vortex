import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AdminDashboard, { AdminAccessDenied } from "./AdminDashboard.jsx";
import { useAuth } from "../lib/auth.jsx";
import { api } from "../lib/api";

vi.mock("../lib/auth.jsx", () => ({
  useAuth: vi.fn(),
}));

vi.mock("../lib/api", () => ({
  api: {
    get: vi.fn().mockResolvedValue([]),
    post: vi.fn(),
    put: vi.fn(),
    del: vi.fn(),
    upload: vi.fn(),
  },
}));

describe("AdminDashboard", () => {
  beforeEach(() => {
    api.get.mockReset();
    api.get.mockResolvedValue([]);
  });

  it("shows access denied for non-admin users", () => {
    useAuth.mockReturnValue({ user: { is_admin: false } });
    render(
      <MemoryRouter>
        <AdminAccessDenied />
      </MemoryRouter>
    );
    expect(screen.getByText("Access denied")).toBeInTheDocument();
  });

  it("renders the admin dashboard for an admin user", async () => {
    useAuth.mockReturnValue({ user: { is_admin: true } });
    render(
      <MemoryRouter>
        <AdminDashboard />
      </MemoryRouter>
    );
    expect(await screen.findByText("Catalog dashboard")).toBeInTheDocument();
  });

  it("paginates title results", async () => {
    const titles = Array.from({ length: 12 }, (_, index) => ({
      id: index + 1,
      type: "movie",
      title: `Title ${index + 1}`,
      year: 2025,
      episode_count: 0,
      genres: [],
    }));
    api.get.mockImplementation((path) => {
      if (path === "/admin/titles?limit=300") return Promise.resolve(titles);
      if (path === "/admin/reports" || path === "/admin/analytics/playback" || path === "/media/scan-roots") return Promise.resolve([]);
      return Promise.resolve({ type: "movie" });
    });
    useAuth.mockReturnValue({ user: { is_admin: true } });
    render(<MemoryRouter><AdminDashboard /></MemoryRouter>);

    expect(await screen.findByText("Title 1")).toBeInTheDocument();
    expect(screen.queryByText("Title 11")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(await screen.findByText("Title 11")).toBeInTheDocument();
  });
});
