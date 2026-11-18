import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Auth from "./Auth.jsx";
import { useAuth } from "../lib/auth.jsx";

vi.mock("../lib/auth.jsx", () => ({
  useAuth: vi.fn(),
}));

describe("Auth", () => {
  beforeEach(() => {
    useAuth.mockReturnValue({ token: null, login: vi.fn(), register: vi.fn() });
  });

  it("allows the password to be shown and hidden", () => {
    render(<MemoryRouter><Auth /></MemoryRouter>);
    const password = screen.getByLabelText("Password");

    expect(password).toHaveAttribute("type", "password");
    fireEvent.click(screen.getByRole("button", { name: "Show password" }));
    expect(password).toHaveAttribute("type", "text");
    fireEvent.click(screen.getByRole("button", { name: "Hide password" }));
    expect(password).toHaveAttribute("type", "password");
  });

  it("shows field-level registration validation before submitting", () => {
    const { register } = useAuth();
    render(<MemoryRouter><Auth /></MemoryRouter>);
    fireEvent.click(screen.getByRole("button", { name: "Create an account" }));
    fireEvent.change(screen.getByLabelText("Your name"), { target: { value: "Viewer" } });
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "viewer@example.com" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "short" } });
    fireEvent.click(screen.getByRole("button", { name: "Create account" }));

    expect(screen.getByText("Use at least 6 characters.")).toBeInTheDocument();
    expect(register).not.toHaveBeenCalled();
  });
});
