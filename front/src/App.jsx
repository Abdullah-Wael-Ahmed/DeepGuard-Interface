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
import ReportPrintView from './pages/ReportPrintView';
import Traffic from './pages/Traffic';
import Firewall from './pages/Firewall';
import Settings from './pages/Settings';
import AnomalyDetection from './pages/AnomalyDetection';
import UserManagement from './pages/UserManagement';
import Correlation from './pages/Correlation';
import ThreatIntelligence from './pages/ThreatIntelligence';
import NetworkBehaviorAnalytics from './pages/NetworkBehaviorAnalytics'
import MitreAttack from './pages/MitreAttack'
import Endpoints from './pages/Endpoints'
import Incidents from './pages/Incidents'
import IncidentDetail from './pages/IncidentDetail'
import Playbooks from './pages/Playbooks'
import PlaybookBuilder from './pages/PlaybookBuilder'
import ExecutionHistory from './pages/ExecutionHistory'
import RoleRoute from './components/RoleRoute';
import SessionManager from './components/SessionManager';
import React, { useEffect } from 'react';
import axios from 'axios';
const AxiosInterceptorSetup = ({ children }) => {
  const { auth } = useAuth();
  const authRef = React.useRef(auth);

  // Update ref synchronously during render so children's useEffects see the latest token
  authRef.current = auth;

  useEffect(() => {
    const requestInterceptor = axios.interceptors.request.use(
      (config) => {
        if (authRef.current?.accessToken) {
          config.headers.Authorization = `Bearer ${authRef.current.accessToken}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    return () => {
      axios.interceptors.request.eject(requestInterceptor);
    };
  }, []);

  return children;
};
function App() {
  const router = createBrowserRouter([
    {
      path: '/reports/print/:templateId',
      element: <ReportPrintView />
    },
    {
      // wraps everything so we check for the "Remember Me" cookie
      element: <PersistLogin />,
      children: [
        {
          element: <SessionManager />,
          children: [
            {
              // Redirects to "/" if the user is already authenticated
              element: <PublicRoute />,
              children: [
                { path: '/login', element: <LoginPage /> }
              ]
            },
            {
              element: <ProtectedRoute />,
              errorElement: <div className="p-10 text-white">Something went wrong! <a href="/" className="text-primary underline">Go Home</a></div>,
              children: [
                {
                  path: '/',
                  element: <Layout />,
                  children: [
                    { index: true, element: <Dashboard /> },
                    { path: 'dashboard', element: <Dashboard /> },
                    { path: 'reports', element: <Reports /> },
                    { path: 'traffic', element: <Traffic /> },
                    { path: 'detection', element: <AnomalyDetection /> },
                    { path: 'settings', element: <Settings /> },
                    { path: 'incidents', element: <Incidents /> },
                    { path: 'incidents/:id', element: <IncidentDetail /> },
                    
                    // Admin & Operator Only Routes
                    {
                      element: <RoleRoute allowedRoles={['admin', 'operator']} />,
                      children: [
                        { path: 'firewall', element: <Firewall /> },
                        { path: 'correlation', element: <Correlation /> },
                        { path: 'mitre-attack', element: <MitreAttack /> },
                        { path: 'endpoints', element: <Endpoints /> },
                        { path: 'threat-intel', element: <ThreatIntelligence /> },
                        { path: 'network-analytics', element: <NetworkBehaviorAnalytics /> },
                        { path: 'playbooks', element: <Playbooks /> },
                        { path: 'playbooks/history', element: <ExecutionHistory /> },
                        { path: 'playbooks/:id', element: <PlaybookBuilder /> }
                      ]
                    },
                    
                    // Admin Only Routes
                    {
                      element: <RoleRoute allowedRoles={['admin']} />,
                      children: [
                        { path: 'users', element: <UserManagement /> }
                      ]
                    }
                  ]
                }
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
            limit={5}
          />
        </AxiosInterceptorSetup>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;