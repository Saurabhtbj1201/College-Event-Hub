import { Link, Outlet } from "react-router-dom";
import {
  isPhase2UserAuthEnabled,
  isPhase2UserDashboardEnabled,
} from "../config/featureFlags";
import { useUserAuth } from "../contexts/UserAuthContext";

const PublicLayout = () => {
  const { isAuthenticated, logout } = useUserAuth();

  return (
    <div className="min-h-screen bg-hero-radial">
      <header className="border-b border-slate-200 bg-white/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <Link to="/" className="font-display text-xl font-semibold text-brand-900">
            College Event Hub
          </Link>
          <nav className="flex items-center gap-5 text-sm font-medium text-slate-700">
            <Link to="/" className="hover:text-brand-700">
              Events
            </Link>
            {isPhase2UserAuthEnabled ? (
              isAuthenticated ? (
                <>
                  {isPhase2UserDashboardEnabled ? (
                    <Link to="/dashboard" className="hover:text-brand-700">
                      My Dashboard
                    </Link>
                  ) : null}
                  <button
                    type="button"
                    onClick={logout}
                    className="rounded-full border border-slate-300 px-4 py-2 text-slate-700 hover:bg-slate-100"
                  >
                    User Logout
                  </button>
                </>
              ) : (
                <Link
                  to="/user/login"
                  className="rounded-full border border-brand-300 px-4 py-2 text-brand-700 hover:bg-brand-50"
                >
                  User Login
                </Link>
              )
            ) : null}
            <Link
              to="/admin/login"
              className="rounded-full bg-brand-500 px-4 py-2 text-white shadow-glow hover:bg-brand-700"
            >
              Admin Login
            </Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <Outlet />
      </main>

      <footer className="border-t border-slate-200 bg-white/80 py-4 text-center text-sm text-slate-600">
        College Event Hub - Built for simple campus event registrations
      </footer>
    </div>
  );
};

export default PublicLayout;
