
import { Route, Routes } from "react-router-dom";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { AppProvider } from "./context/AppContext";
import { AppLayout } from "./layouts/AppLayout";
import OverviewPage from "./pages/OverviewPage";
import ProjectPage from "./pages/ProjectPage";
import TestingDashboardPage from "./pages/TestingDashboardPage";

export default function App() {
  return (
    <ErrorBoundary>
      <AppProvider>
        <Routes>
          <Route element={<AppLayout />}>
            <Route index element={<OverviewPage />} />
            <Route path="projects/:key" element={<ProjectPage />} />
            <Route path="testing-dashboard" element={<TestingDashboardPage />} />
            <Route path="*" element={<OverviewPage />} />
          </Route>
        </Routes>
      </AppProvider>
    </ErrorBoundary>
  );
}
