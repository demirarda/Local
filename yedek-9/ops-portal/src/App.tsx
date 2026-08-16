import { Navigate, Route, Routes } from 'react-router-dom';
import { RequireAuth, RequirePath } from './components/RoleRoute';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import ProjectsPage from './pages/ProjectsPage';
import BoardPage from './pages/BoardPage';
import HostsPage from './pages/HostsPage';
import VenuesPage from './pages/VenuesPage';
import ScreensPage from './pages/ScreensPage';
import TeamPage from './pages/TeamPage';
import BridgePage from './pages/BridgePage';
import NominationsPage from './pages/NominationsPage';
import EventGroupsPage from './pages/EventGroupsPage';
import { getPermissions } from './lib/permissions';
import { getToken } from './lib/api';

function HomeRedirect() {
  const perms = getPermissions();
  if (perms?.default_route && perms.default_route !== '/') {
    return <Navigate to={perms.default_route} replace />;
  }
  return <ProjectsPage />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/dashboard"
        element={
          <RequirePath path="/dashboard">
            <DashboardPage />
          </RequirePath>
        }
      />
      <Route
        path="/hosts"
        element={
          <RequirePath path="/hosts">
            <HostsPage />
          </RequirePath>
        }
      />
      <Route
        path="/venues"
        element={
          <RequirePath path="/venues">
            <VenuesPage />
          </RequirePath>
        }
      />
      <Route
        path="/screens"
        element={
          <RequirePath path="/screens">
            <ScreensPage />
          </RequirePath>
        }
      />
      <Route
        path="/"
        element={
          <RequireAuth>
            <HomeRedirect />
          </RequireAuth>
        }
      />
      <Route
        path="/projects/:projectId"
        element={
          <RequirePath path="/">
            <BoardPage />
          </RequirePath>
        }
      />
      <Route
        path="/team"
        element={
          <RequirePath path="/team">
            <TeamPage />
          </RequirePath>
        }
      />
      <Route
        path="/bridge"
        element={
          <RequirePath path="/bridge">
            <BridgePage />
          </RequirePath>
        }
      />
      <Route
        path="/nominations"
        element={
          <RequireAuth>
            <NominationsPage />
          </RequireAuth>
        }
      />
      <Route
        path="/event-groups"
        element={
          <RequireAuth>
            <EventGroupsPage />
          </RequireAuth>
        }
      />
      <Route
        path="*"
        element={
          getToken() ? (
            <Navigate to={getPermissions()?.default_route || '/dashboard'} replace />
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />
    </Routes>
  );
}
