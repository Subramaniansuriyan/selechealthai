import { createBrowserRouter } from "react-router-dom"
import { AuthGuard } from "@/components/auth-guard"
import DashboardLayout from "@/App"
import LoginPage from "@/pages/login"
import PatientFilesPage from "@/pages/patient-files"
import CodingActivityPage from "@/pages/coding-activity"
import UsersPage from "@/pages/users"
import UploadQueuePage from "@/pages/upload-queue"
import SetPasswordPage from "@/pages/set-password"
import ResetPasswordPage from "@/pages/reset-password"

export const router = createBrowserRouter([
  {
    path: "/login",
    element: <LoginPage />,
  },
  {
    path: "/set-password",
    element: <SetPasswordPage />,
  },
  {
    path: "/reset-password",
    element: <ResetPasswordPage />,
  },
  {
    element: <AuthGuard />,
    children: [
      {
        element: <DashboardLayout />,
        children: [
          {
            index: true,
            element: <PatientFilesPage />,
          },
          {
            path: "queue",
            element: <UploadQueuePage />,
          },
          {
            path: "coding",
            element: <CodingActivityPage />,
          },
          {
            path: "users",
            element: <UsersPage />,
          },
        ],
      },
    ],
  },
])
