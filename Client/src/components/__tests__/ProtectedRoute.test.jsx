import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ProtectedRoute from "../../components/ProtectedRoute";
import { useAuth } from "../../contexts/AuthContext";

vi.mock("../../contexts/AuthContext", () => ({
  useAuth: vi.fn(),
}));

const renderRoute = (element = <ProtectedRoute />) =>
  render(
    <MemoryRouter initialEntries={["/admin/dashboard"]}>
      <Routes>
        <Route path="/admin/login" element={<div>Admin Login</div>} />
        <Route element={element}>
          <Route path="/admin/dashboard" element={<div>Dashboard Content</div>} />
        </Route>
      </Routes>
    </MemoryRouter>
  );

describe("ProtectedRoute", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows loading state while auth is bootstrapping", () => {
    useAuth.mockReturnValue({
      loading: true,
      isAuthenticated: false,
      isSuperAdmin: false,
    });

    renderRoute();

    expect(screen.getByText("Loading dashboard...")).toBeInTheDocument();
  });

  it("redirects unauthenticated users to admin login", () => {
    useAuth.mockReturnValue({
      loading: false,
      isAuthenticated: false,
      isSuperAdmin: false,
    });

    renderRoute();

    expect(screen.getByText("Admin Login")).toBeInTheDocument();
  });

  it("renders protected content for authenticated admins", () => {
    useAuth.mockReturnValue({
      loading: false,
      isAuthenticated: true,
      isSuperAdmin: false,
    });

    renderRoute();

    expect(screen.getByText("Dashboard Content")).toBeInTheDocument();
  });

  it("blocks non super-admin users when requireSuperAdmin is true", () => {
    useAuth.mockReturnValue({
      loading: false,
      isAuthenticated: true,
      isSuperAdmin: false,
    });

    renderRoute(<ProtectedRoute requireSuperAdmin />);

    expect(screen.getByText("You need super-admin access for this page.")).toBeInTheDocument();
  });
});
