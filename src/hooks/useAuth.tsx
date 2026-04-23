import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import { useQuery, useAction, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";

const SESSION_KEY = "selectrcm_session_token";

type User = {
  _id: string;
  email: string;
  name: string;
  role: "superadmin" | "manager" | "staff";
};

type AuthContextType = {
  user: User | null;
  token: string;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string>(
    () => localStorage.getItem(SESSION_KEY) ?? ""
  );
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const sessionUser = useQuery(
    api.sessions.validateSession,
    token ? { token } : "skip"
  );
  const loginAction = useAction(api.auth.login);
  const logoutMutation = useMutation(api.sessions.deleteSession);

  // Clear invalid token
  useEffect(() => {
    if (token && sessionUser === null) {
      localStorage.removeItem(SESSION_KEY);
      setToken("");
    }
  }, [token, sessionUser]);

  const login = useCallback(
    async (email: string, password: string) => {
      setIsLoggingIn(true);
      try {
        const result = await loginAction({ email, password });
        localStorage.setItem(SESSION_KEY, result.token);
        setToken(result.token);
      } finally {
        setIsLoggingIn(false);
      }
    },
    [loginAction]
  );

  const logout = useCallback(async () => {
    if (token) {
      await logoutMutation({ token });
      localStorage.removeItem(SESSION_KEY);
      setToken("");
    }
  }, [token, logoutMutation]);

  const isLoading = isLoggingIn || (!!token && sessionUser === undefined);
  const isAuthenticated = !!sessionUser;

  return (
    <AuthContext.Provider
      value={{
        user: sessionUser as User | null,
        token,
        isLoading,
        isAuthenticated,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
