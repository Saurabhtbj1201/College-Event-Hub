import { Navigate, Outlet } from "react-router-dom";
import { useUserAuth } from "../contexts/UserAuthContext";
import { isPhase2UserDashboardEnabled } from "../config/featureFlags";

const UserProtectedRoute = () => {
  const { loading, isAuthenticated } = useUserAuth();

  if (!isPhase2UserDashboardEnabled) {
    return <Navigate to="/" replace />;
  }

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-slate-600">
        Loading your dashboard...
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/user/login" replace />;
  }

  return <Outlet />;
};

export default UserProtectedRoute;
