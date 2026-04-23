# Select Health AI

Select Health AI is a healthcare operations dashboard for managing patient files, upload processing, coding activity, and user/team access.  
It uses a React + TypeScript frontend (Vite + shadcn/ui) with Convex functions for backend logic, data handling, authentication flows, invitations, and AI-assisted extraction/coding tasks.

## Project Index

- `src/` - Frontend application source code.
- `src/pages/` - Route-level pages (`login`, `patient-files`, `upload-queue`, `coding-activity`, `users`, password flows).
- `src/components/` - Shared UI and feature components (sidebar, auth guard, upload/coding/patient UI, settings).
- `src/components/ui/` - Reusable shadcn-style primitives (button, dialog, table, input, etc.).
- `src/hooks/` - Custom React hooks for auth state and file upload behavior.
- `src/router.tsx` - Application route definitions and protected route structure.
- `src/App.tsx` - Main dashboard layout shell used by authenticated routes.
- `convex/` - Backend functions for auth, users, teams, invitations, uploads, processing, coding, and schema.
- `convex/_generated/` - Convex generated API/data model types.
- `public/` and `src/assets/` - Static assets used by the app.
- `package.json` - Project scripts and dependencies.
- `vite.config.ts` / `tsconfig*.json` - Build and TypeScript configuration.
- `vercel.json` - Deployment configuration.

## Architecture

The application follows a client-server style architecture with a React SPA frontend and Convex-powered backend functions.

```text
User
  -> React + TypeScript UI (`src/pages`, `src/components`)
  -> Route/Auth Layer (`src/router.tsx`, `AuthGuard`)
  -> Feature Hooks (`src/hooks`)
  -> Convex API Calls
  -> Convex Backend (`convex/*.ts`)
      - Auth + sessions
      - Users/teams/invitations
      - Upload + processing pipeline
      - Coding + extraction logic
  -> Data + responses returned to UI
```

- **Frontend layer**: Vite + React renders dashboard views for patient files, queue, coding activity, and user management.
- **Routing and access control**: Route-level guards protect authenticated sections and isolate login/password reset flows.
- **Backend domain logic**: Convex functions encapsulate operational domains (accounts, teams, invitations, uploads, coding, processing).
- **Data contract**: Shared generated Convex types in `convex/_generated/` keep frontend/backend API usage aligned.
- **Deployment model**: Frontend is build/deploy ready via Vite and `vercel.json`, while backend logic runs through Convex services.
