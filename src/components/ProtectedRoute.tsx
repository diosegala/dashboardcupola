import { Navigate } from "react-router-dom";
import { precisaCriarSenha } from "@/lib/passwordRules";
import { useAuth } from "@/hooks/useAuth";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading, role, rolesLoaded, signOut } = useAuth();

  if (loading || (user && !rolesLoaded)) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="space-y-4 w-80">
          <Skeleton className="h-8 w-48 mx-auto" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
        </div>
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  if (precisaCriarSenha(user)) return <Navigate to="/set-password" replace />;

  // Sem função gravada (ex.: pessoa excluída), nenhuma tela do painel abre.
  if (!role) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <div className="max-w-sm space-y-4 text-center">
          <h1 className="text-xl font-semibold">Sem acesso ao painel</h1>
          <p className="text-sm text-muted-foreground">Esta conta não tem acesso ao Painel de Eventos CUPOLA. Se isso parece um engano, fale com o administrador.</p>
          <Button onClick={() => signOut()}>Sair</Button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
