import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useUserAuth } from "../contexts/UserAuthContext";

const UserProtectedRoute = () => {
  const location = useLocation();
  const { loading, isAuthenticated } = useUserAuth();

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-slate-600">
        Loading your dashboard...
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/user/login" replace state={{ from: location.pathname }} />;
  }

  return <Outlet />;
};

export default UserProtectedRoute;
