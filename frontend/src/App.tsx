
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
              <Route index element={<OverviewPage />} />
              <Route path="projects/:key" element={<ProjectPage />} />
              <Route
                path="testing-dashboard"
                element={<TestingDashboardPage />}
              />
              <Route path="*" element={<OverviewPage />} />
            </Route>
          </Route>
        </Routes>
      </AppProvider>
    </ErrorBoundary>
  );
}
