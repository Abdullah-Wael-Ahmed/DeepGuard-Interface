import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import './App.css'
import Test from './pages/Test'
import Layout from './pages/Layout'
import Reports from './pages/Reports'
import Traffic from './pages/Traffic'
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import Firewall from './pages/Firewall'
import Dashboard from './pages/Dashboard'
import Settings from './pages/Settings'
import AnomalyDetection from './pages/AnomalyDetection'
import UserManagement from './pages/UserManagement'
import Correlation from './pages/Correlation'
import ThreatIntelligence from './pages/ThreatIntelligence'
import { ThemeProvider } from './context/ThemeContext'

function App() {

  const router = createBrowserRouter([
    {
      path: '/',
      element: <Layout />,
      children: [
        { path: '/', element: <Dashboard /> },
        { path: '/reports', element: <Reports /> },
        { path: '/traffic', element: <Traffic /> },
        { path: '/firewall', element: <Firewall /> },
        { path: '/settings', element: <Settings /> },
        { path: '/detection', element: <AnomalyDetection /> },
        { path: '/users', element: <UserManagement /> },
        { path: '/correlation', element: <Correlation /> },
        { path: '/threat-intel', element: <ThreatIntelligence /> }
      ]
    }
  ])

  return (
    <ThemeProvider>
      <RouterProvider router={router} />
      <ToastContainer
        position='top-right'
        autoClose={3000}
        hideProgressBar={false}
        newestOnTop={true}
        closeOnClick
        pauseOnFocusLoss
        draggable
        pauseOnHover
        theme='dark'
      />
    </ThemeProvider>
  )
}

export default App

