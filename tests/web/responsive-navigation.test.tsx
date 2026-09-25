import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ResponsiveSidebar } from "../../src/web/app/ResponsiveSidebar";
import { useSuperstringStore as store } from "../../src/web/store";

beforeEach(() => {
  store.getState().resetForTests();
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() })),
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

it("compact navigation mounts one directory in a labelled dialog and Escape restores focus", async () => {
  render(<ResponsiveSidebar version="test" />);
  const trigger = screen.getByRole("button", { name: "会话与导航" });
  await userEvent.click(trigger);
  expect(screen.getByRole("dialog", { name: "会话与导航" })).toBeTruthy();
  expect(screen.getAllByRole("navigation", { name: "历史会话" })).toHaveLength(1);
  expect(screen.getByRole("navigation", { name: "主导航" })).toBeTruthy();
  await userEvent.keyboard("{Escape}");
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  expect(document.activeElement).toBe(trigger);
});

it("compact navigation stays open when a dirty destination is cancelled, closes after commit", async () => {
  store.setState({ page: "settings", settingsView: "agents", dirty: true });
  render(<ResponsiveSidebar version="test" />);
  fireEvent.click(screen.getByRole("button", { name: "会话与导航" }));
  fireEvent.click(screen.getByRole("button", { name: "接入" }));
  expect(store.getState().navigationConfirmOpen).toBe(true);
  expect(store.getState().settingsView).toBe("agents");
  expect(screen.getByRole("dialog")).toBeTruthy();
  act(() => store.getState().cancelPendingNavigation());
  expect(screen.getByRole("dialog")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "偏好" }));
  await act(async () => store.getState().confirmDiscardAndContinue());
  expect(store.getState().settingsView).toBe("general");
  expect(screen.queryByRole("dialog")).toBeNull();
});
