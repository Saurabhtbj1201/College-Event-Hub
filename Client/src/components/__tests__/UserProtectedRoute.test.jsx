import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import UserProtectedRoute from "../../components/UserProtectedRoute";
import { useUserAuth } from "../../contexts/UserAuthContext";

vi.mock("../../contexts/UserAuthContext", () => ({
  useUserAuth: vi.fn(),
}));

const renderRoute = () =>
  render(
    <MemoryRouter initialEntries={["/user/dashboard"]}>
      <Routes>
        <Route path="/user/login" element={<div>User Login</div>} />
        <Route element={<UserProtectedRoute />}>
          <Route path="/user/dashboard" element={<div>User Dashboard</div>} />
        </Route>
      </Routes>
    </MemoryRouter>
  );

describe("UserProtectedRoute", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows loading state while user auth is bootstrapping", () => {
    useUserAuth.mockReturnValue({
      loading: true,
      isAuthenticated: false,
    });

    renderRoute();

    expect(screen.getByText("Loading your dashboard...")).toBeInTheDocument();
  });

  it("redirects guests to user login", () => {
    useUserAuth.mockReturnValue({
      loading: false,
      isAuthenticated: false,
    });

    renderRoute();

    expect(screen.getByText("User Login")).toBeInTheDocument();
  });

  it("renders protected content for authenticated users", () => {
    useUserAuth.mockReturnValue({
      loading: false,
      isAuthenticated: true,
    });

    renderRoute();

    expect(screen.getByText("User Dashboard")).toBeInTheDocument();
  });
});
