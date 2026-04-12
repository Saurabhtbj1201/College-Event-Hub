import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { GoogleLogin } from "@react-oauth/google";
import { loginUserWithGoogle } from "../../api/userApi";
import { FEATURE_FLAGS, isPhase2UserAuthEnabled } from "../../config/featureFlags";
import { useUserAuth } from "../../contexts/UserAuthContext";

const UserLoginPage = () => {
  const navigate = useNavigate();
  const { isAuthenticated, login } = useUserAuth();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (isAuthenticated) {
      navigate("/dashboard", { replace: true });
    }
  }, [isAuthenticated, navigate]);

  const handleGoogleSuccess = async (credentialResponse) => {
    const credential = credentialResponse?.credential;

    if (!credential) {
      setError("Google login did not return a credential token");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await loginUserWithGoogle(credential);
      login(response);
      navigate("/dashboard", { replace: true });
    } catch (err) {
      setError(err.response?.data?.message || "Unable to sign in with Google");
    } finally {
      setLoading(false);
    }
  };

  if (!isPhase2UserAuthEnabled) {
    return (
      <div className="space-y-3 rounded-2xl border border-amber-200 bg-amber-50 p-6 text-amber-900">
        <h1 className="font-display text-2xl font-semibold">User Dashboard Disabled</h1>
        <p>Phase 2 user auth module is currently disabled by feature flag.</p>
        <Link to="/" className="text-sm font-semibold text-amber-900 underline">
          Return to events
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl space-y-5 rounded-3xl border border-slate-200 bg-white p-7 shadow-sm">
      <h1 className="font-display text-3xl font-semibold text-slate-900">User Sign In</h1>
      <p className="text-sm text-slate-600">
        Sign in with Google to access your ticket dashboard, schedule, and live updates.
      </p>

      {FEATURE_FLAGS.googleClientId ? (
        <div className="space-y-3">
          <GoogleLogin onSuccess={handleGoogleSuccess} onError={() => setError("Google login failed")} />
          {loading ? <p className="text-sm text-slate-500">Verifying Google account...</p> : null}
        </div>
      ) : (
        <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-800">
          Google client configuration is missing on frontend. Set VITE_GOOGLE_CLIENT_ID.
        </p>
      )}

      {error ? <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}

      <div className="pt-2 text-sm">
        <Link to="/" className="font-semibold text-brand-700 hover:text-brand-900">
          Back to Events
        </Link>
      </div>
    </div>
  );
};

export default UserLoginPage;
