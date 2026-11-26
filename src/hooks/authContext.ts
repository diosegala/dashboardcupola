import { createContext, type Context } from "react";
import type { User, Session } from "@supabase/supabase-js";

export interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  isAdmin: boolean;
  canViewAll: boolean;
  isSeller: boolean;
  viewingAsSeller: boolean;
  setViewingAsSeller: (v: boolean) => void;
  profile: { name: string | null } | null;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  role: "admin" | "viewer" | "seller" | null;
  rolesLoaded: boolean;
  teamView: boolean;
}

// Keep the provider and consumers on the same context during partial preview updates.
// This module has no dependency on the provider, data hooks or page components.
type AuthContext = Context<AuthContextType | undefined>;
const previousContext = import.meta.hot?.data?.authContext as AuthContext | undefined;
export const AuthContext = previousContext ?? createContext<AuthContextType | undefined>(undefined);

if (import.meta.hot) {
  import.meta.hot.dispose((data) => {
    data.authContext = AuthContext;
  });
}