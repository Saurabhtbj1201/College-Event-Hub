import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

const ProtectedRoute = ({ requireSuperAdmin = false }) => {
  const { loading, isAuthenticated, isSuperAdmin } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-slate-600">
        Loading dashboard...
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/admin/login" replace />;
  }

  if (requireSuperAdmin && !isSuperAdmin) {
    return (
      <div className="mx-auto mt-12 max-w-xl rounded-2xl border border-amber-200 bg-amber-50 p-6 text-amber-900">
        You need super-admin access for this page.
      </div>
    );
  }

  return <Outlet />;
};

export default ProtectedRoute;
