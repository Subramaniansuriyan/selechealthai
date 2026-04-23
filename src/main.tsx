import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { RouterProvider } from "react-router-dom"
import { ConvexProvider, ConvexReactClient } from "convex/react"

import "./index.css"
import { router } from "./router"
import { AuthProvider } from "./hooks/useAuth"
import { Toaster } from "./components/ui/sonner"

const convex = new ConvexReactClient(import.meta.env.VITE_CONVEX_URL as string)

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ConvexProvider client={convex}>
      <AuthProvider>
        <RouterProvider router={router} />
        <Toaster />
      </AuthProvider>
    </ConvexProvider>
  </StrictMode>
)
