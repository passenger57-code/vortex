import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import TitleCard from "./TitleCard.jsx";

vi.mock("../lib/modal.jsx", () => ({ useModal: () => ({ open: vi.fn() }) }));
vi.mock("../lib/list.jsx", () => ({ useList: () => ({ has: () => false, toggle: vi.fn() }) }));

const title = (type) => ({
  id: 1,
  type,
  title: "Test title",
  genres: [],
  maturity: "PG",
});

function renderCard(item, props = {}) {
  return render(<MemoryRouter><TitleCard t={item} {...props} /></MemoryRouter>);
}

describe("TitleCard aspect ratio", () => {
  it("uses poster cards for anime and series, and wide cards for movies", () => {
    expect(renderCard(title("anime")).container.firstChild).toHaveClass("aspect-[2/3]");
    expect(renderCard(title("series")).container.firstChild).toHaveClass("aspect-[2/3]");
    expect(renderCard(title("movie")).container.firstChild).toHaveClass("aspect-video");
  });

  it("keeps continue-watching cards wide regardless of content type", () => {
    expect(renderCard(title("anime"), { continueWatching: true }).container.firstChild).toHaveClass("aspect-video");
  });
});
