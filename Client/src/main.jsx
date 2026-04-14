import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { GoogleOAuthProvider } from "@react-oauth/google";
import App from "./App";
import { AuthProvider } from "./contexts/AuthContext";
import { UserAuthProvider } from "./contexts/UserAuthContext";
import { ToastProvider } from "./contexts/ToastContext";
import { FEATURE_FLAGS } from "./config/featureFlags";
import "./index.css";

const appTree = (
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <UserAuthProvider>
          <ToastProvider>
            <App />
          </ToastProvider>
        </UserAuthProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);

const rootNode = document.getElementById("root");

if (FEATURE_FLAGS.googleClientId) {
  ReactDOM.createRoot(rootNode).render(
    <GoogleOAuthProvider clientId={FEATURE_FLAGS.googleClientId}>
      {appTree}
    </GoogleOAuthProvider>
  );
} else {
  ReactDOM.createRoot(rootNode).render(appTree);
}
