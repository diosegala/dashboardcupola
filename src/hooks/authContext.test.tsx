import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AuthContext, type AuthContextType } from "./authContext";
import { useAuth } from "./useAuth";
import type { ReactNode } from "react";

vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
vi.mock("@/lib/registrarAtividade", () => ({ registrarAtividade: vi.fn() }));

const value: AuthContextType = {
  user: null, session: null, loading: false, isAdmin: false, canViewAll: true,
  isSeller: false, viewingAsSeller: false, setViewingAsSeller: vi.fn(),
  profile: null, signOut: vi.fn(), refreshProfile: vi.fn(), role: "viewer",
  rolesLoaded: true, teamView: false,
};
const wrapper = ({ children }: { children: ReactNode }) => (
  <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
);

describe("shared authentication context", () => {
  it("connects the hook to the provider's exact context value", () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    expect(result.current).toBe(value);
  });

  it("still connects an older provider to a re-evaluated consumer module", async () => {
    // Simulate a partial update: the context dependency stays loaded while the hook changes.
    vi.doMock("./authContext", () => ({ AuthContext }));
    vi.resetModules();
    const updated = await import("./useAuth");
    const { result } = renderHook(() => updated.useAuth(), { wrapper });
    expect(result.current).toBe(value);
    vi.doUnmock("./authContext");
  });
});