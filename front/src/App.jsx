import { createBrowserRouter, RouterProvider, Navigate } from 'react-router-dom';
import './App.css';
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
// Context Providers
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider, useAuth } from './context/AuthContext';
// Auth Components
import PersistLogin from './components/PersistLogin';
import ProtectedRoute from './components/ProtectedRoute';
import PublicRoute from './components/PublicRoute';
// Pages
import Layout from './pages/Layout';
import LoginPage from './pages/AuthPage';
import Dashboard from './pages/Dashboard';
import Reports from './pages/Reports';
import Traffic from './pages/Traffic';
import Firewall from './pages/Firewall';
import Settings from './pages/Settings';
import AnomalyDetection from './pages/AnomalyDetection';
import UserManagement from './pages/UserManagement';
import Correlation from './pages/Correlation';
import ThreatIntelligence from './pages/ThreatIntelligence';
import NetworkBehaviorAnalytics from './pages/NetworkBehaviorAnalytics'
import MitreAttack from './pages/MitreAttack'
import Incidents from './pages/Incidents'
import IncidentDetail from './pages/IncidentDetail'
import Playbooks from './pages/Playbooks'
import PlaybookBuilder from './pages/PlaybookBuilder'
import { useEffect } from 'react';
import axios from 'axios'
const AxiosInterceptorSetup = ({ children }) => {
  const { auth } = useAuth();

  useEffect(() => {
    const requestInterceptor = axios.interceptors.request.use(
      (config) => {
        // Automatically attach the token to every request
        if (auth?.accessToken) {
          config.headers.Authorization = `Bearer ${auth.accessToken}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Cleanup interceptor to prevent memory leaks
    return () => {
      axios.interceptors.request.eject(requestInterceptor);
    };
  }, [auth]);

  return children;
};
function App() {
  const router = createBrowserRouter([
    {
      // wraps everything so we check for the "Remember Me" cookie
      element: <PersistLogin />,
      children: [
        {
          element: <PublicRoute />,
          children: [
            {
              path: '/login',
              element: <LoginPage />
            }
          ]
        },
        {
          element: <ProtectedRoute />,
          errorElement: <div className="p-10 text-white">Page not found! <a href="/" className="text-primary underline">Go Home</a></div>,
          children: [
            {
              path: '/',
              element: <Layout />,
              children: [
                { index: true, element: <Dashboard /> },
                { path: 'dashboard', element: <Dashboard /> },
                { path: 'reports', element: <Reports /> },
                { path: 'traffic', element: <Traffic /> },
                { path: 'firewall', element: <Firewall /> },
                { path: 'detection', element: <AnomalyDetection /> },
                { path: 'users', element: <UserManagement /> },
                { path: 'correlation', element: <Correlation /> },
                { path: 'mitre-attack', element: <MitreAttack /> },
                { path: 'threat-intel', element: <ThreatIntelligence /> },
                { path: 'settings', element: <Settings /> },
                { path: '/network-analytics', element: <NetworkBehaviorAnalytics /> },
                { path: 'incidents', element: <Incidents /> },
                { path: 'incidents/:id', element: <IncidentDetail /> },
                { path: 'playbooks', element: <Playbooks /> },
                { path: 'playbooks/:id', element: <PlaybookBuilder /> }
              ]
            }
          ]
        },
        {
          path: '*',
          element: <Navigate to="/" replace />
        }
      ]
    }
  ]);

  return (
    <ThemeProvider>
      <AuthProvider>
        <AxiosInterceptorSetup>
          <RouterProvider router={router} />
          <ToastContainer
            position='top-right'
            autoClose={3000}
            theme='dark'
          />
        </AxiosInterceptorSetup>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;