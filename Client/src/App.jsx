import { Navigate, Route, Routes } from "react-router-dom";
import ProtectedRoute from "./components/ProtectedRoute";
import UserProtectedRoute from "./components/UserProtectedRoute";
import PublicLayout from "./layouts/PublicLayout";
import AdminLayout from "./layouts/AdminLayout";
import HomePage from "./pages/public/HomePage";
import EventDetailsPage from "./pages/public/EventDetailsPage";
import QueueStatusPage from "./pages/public/QueueStatusPage";
import NavigationPage from "./pages/public/NavigationPage";
import FoodServicesPage from "./pages/public/FoodServicesPage";
import SafetySocialPage from "./pages/public/SafetySocialPage";
import SmartGuidancePage from "./pages/public/SmartGuidancePage";
import RegisterPage from "./pages/public/RegisterPage";
import PassPage from "./pages/public/PassPage";
import UserLoginPage from "./pages/public/UserLoginPage";
import UserDashboardPage from "./pages/public/UserDashboardPage";
import UserProfilePage from "./pages/public/UserProfilePage";
import AdminLoginPage from "./pages/admin/AdminLoginPage";
import AdminRegisterPage from "./pages/admin/AdminRegisterPage";
import AdminDashboardPage from "./pages/admin/AdminDashboardPage";
import AdminCommandCenterPage from "./pages/admin/AdminCommandCenterPage";
import AdminScannerPage from "./pages/admin/AdminScannerPage";
import AdminNavigationPage from "./pages/admin/AdminNavigationPage";
import AdminFoodOperationsPage from "./pages/admin/AdminFoodOperationsPage";
import AdminEmergencyOpsPage from "./pages/admin/AdminEmergencyOpsPage";
import AdminIntelligencePage from "./pages/admin/AdminIntelligencePage";
import CreateEventPage from "./pages/admin/CreateEventPage";
import RegistrationsPage from "./pages/admin/RegistrationsPage";
import PendingAdminsPage from "./pages/admin/PendingAdminsPage";

const App = () => {
  return (
    <Routes>
      <Route path="/" element={<PublicLayout />}>
        <Route index element={<HomePage />} />
        <Route path="events/:eventId" element={<EventDetailsPage />} />
        <Route path="user/login" element={<UserLoginPage />} />

        <Route element={<UserProtectedRoute />}>
          <Route path="events/:eventId/queues" element={<QueueStatusPage />} />
          <Route path="events/:eventId/navigation" element={<NavigationPage />} />
          <Route path="events/:eventId/food" element={<FoodServicesPage />} />
          <Route path="events/:eventId/safety-social" element={<SafetySocialPage />} />
          <Route path="events/:eventId/intelligence" element={<SmartGuidancePage />} />
          <Route path="events/:eventId/register" element={<RegisterPage />} />
          <Route path="pass/:passId" element={<PassPage />} />
          <Route path="dashboard" element={<UserDashboardPage />} />
          <Route path="profile" element={<UserProfilePage />} />
        </Route>
      </Route>

      <Route path="/admin/login" element={<AdminLoginPage />} />
      <Route path="/admin/register" element={<AdminRegisterPage />} />

      <Route element={<ProtectedRoute />}>
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<Navigate to="/admin/dashboard" replace />} />
          <Route path="dashboard" element={<AdminDashboardPage />} />
          <Route path="command-center" element={<AdminCommandCenterPage />} />
          <Route path="scanner" element={<AdminScannerPage />} />
          <Route path="navigation" element={<AdminNavigationPage />} />
          <Route path="food" element={<AdminFoodOperationsPage />} />
          <Route path="emergency" element={<AdminEmergencyOpsPage />} />
          <Route path="intelligence" element={<AdminIntelligencePage />} />
          <Route path="events/new" element={<CreateEventPage />} />
          <Route path="registrations" element={<RegistrationsPage />} />

          <Route element={<ProtectedRoute requireSuperAdmin />}>
            <Route path="pending-admins" element={<PendingAdminsPage />} />
          </Route>
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

export default App;
