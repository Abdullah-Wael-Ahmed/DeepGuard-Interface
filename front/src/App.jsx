import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import './App.css'
import Test from './pages/Test'
import Layout from './pages/Layout'
import Reports from './pages/Reports'
import Traffic from './pages/Traffic'
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

function App() {

  const router = createBrowserRouter([
    {
      path: '/',
      element: <Layout />,
      children: [
        { path: '/reports', element: <Reports /> },
        { path: '/traffic', element: <Traffic /> }
      ]
    }
  ])

  return (
    <>
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
    </>
  )
}

export default App
