
import { Route, Routes } from "react-router-dom";

import { ErrorBoundary } from "./components/ErrorBoundary";
import { AppProvider } from "./context/AppContext";
import { AppLayout } from "./layouts/AppLayout";

import ProtectedRoute from "./components/auth/ProtectedRoute";

import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import OverviewPage from "./pages/OverviewPage";
import ProjectPage from "./pages/ProjectPage";
import TestingDashboardPage from "./pages/TestingDashboardPage";
import ManualScriptsPage from "./pages/ManualScriptsPage";

export default function App() {
  return (
    <ErrorBoundary>
      <AppProvider>
        <Routes>
          {/* Public authentication routes */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />

          {/* Protected application routes */}
          <Route element={<ProtectedRoute />}>
            <Route element={<AppLayout />}>
              {/* Main overview */}
              <Route
                index
                element={<OverviewPage />}
              />

              {/* Project details */}
              <Route
                path="projects/:key"
                element={<ProjectPage />}
              />

              {/* Testing dashboard */}
              <Route
                path="testing-dashboard"
                element={<TestingDashboardPage />}
              />

              {/* Manual ticket scripts dashboard */}
              <Route
                path="manual-scripts"
                element={<ManualScriptsPage />}
              />

              {/* Fallback route */}
              <Route
                path="*"
                element={<OverviewPage />}
              />
            </Route>
          </Route>
        </Routes>
      </AppProvider>
    </ErrorBoundary>
  );
}
