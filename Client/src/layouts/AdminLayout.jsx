import { Link, NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

const navLinkClass = ({ isActive }) =>
  `rounded-xl px-3 py-2 text-sm font-medium transition ${
    isActive ? "bg-brand-500 text-white" : "text-slate-700 hover:bg-brand-50 hover:text-brand-900"
  }`;

const AdminLayout = () => {
  const { admin, logout, isSuperAdmin } = useAuth();

  return (
    <div className="min-h-screen bg-slate-100">
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <div>
            <p className="font-display text-lg font-semibold text-slate-900">Admin Panel</p>
            <p className="text-sm text-slate-600">
              Logged in as {admin?.name} ({admin?.role})
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/" className="rounded-full border border-slate-300 px-4 py-2 text-sm text-slate-700">
              Public Site
            </Link>
            <button
              type="button"
              className="rounded-full bg-slate-900 px-4 py-2 text-sm text-white"
              onClick={logout}
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-6xl gap-6 px-4 py-8 sm:px-6 lg:grid-cols-[240px_1fr] lg:px-8">
        <aside className="rounded-2xl bg-white p-4 shadow-sm">
          <nav aria-label="Admin" className="flex flex-col gap-2">
            <NavLink to="/admin/dashboard" className={navLinkClass}>
              Overview
            </NavLink>
            <NavLink to="/admin/command-center" className={navLinkClass}>
              Command Center
            </NavLink>
            <NavLink to="/admin/scanner" className={navLinkClass}>
              Ticket Scanner
            </NavLink>
            <NavLink to="/admin/navigation" className={navLinkClass}>
              Navigation Editor
            </NavLink>
            <NavLink to="/admin/food" className={navLinkClass}>
              Food Operations
            </NavLink>
            <NavLink to="/admin/emergency" className={navLinkClass}>
              Emergency Ops
            </NavLink>
            <NavLink to="/admin/intelligence" className={navLinkClass}>
              Intelligence
            </NavLink>
            <NavLink to="/admin/events/new" className={navLinkClass}>
              Create Event
            </NavLink>
            <NavLink to="/admin/registrations" className={navLinkClass}>
              Registrations
            </NavLink>
            {isSuperAdmin ? (
              <NavLink to="/admin/pending-admins" className={navLinkClass}>
                Pending Admins
              </NavLink>
            ) : null}
          </nav>
        </aside>

        <section id="main-content" tabIndex="-1" className="rounded-2xl bg-white p-5 shadow-sm">
          <Outlet />
        </section>
      </div>
    </div>
  );
};

export default AdminLayout;
