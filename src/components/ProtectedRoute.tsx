import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { precisaCriarSenha } from "@/lib/passwordRules";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";

type Conferencia = "conferindo" | "tem_senha" | "sem_senha" | "falhou";

function Carregando() {
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

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading, role, rolesLoaded, signOut } = useAuth();
  const semSenhaNoNavegador = precisaCriarSenha(user);
  const [conferencia, setConferencia] = useState<{ userId: string; estado: Conferencia } | null>(null);
  const [tentativa, setTentativa] = useState(0);

  // Os dados guardados no navegador podem estar velhos ou incompletos. Antes de mandar
  // alguém criar senha de novo, o servidor confirma; se ele já tem senha, a pessoa segue
  // direto, sem passar pela tela de senha à toa. A sessão se atualiza sozinha na próxima renovação.
  useEffect(() => {
    if (!user || !semSenhaNoNavegador) return;
    let ativo = true;
    setConferencia({ userId: user.id, estado: "conferindo" });
    supabase.auth.getUser().then(({ data, error }) => {
      if (!ativo) return;
      if (error || !data.user) return setConferencia({ userId: user.id, estado: "falhou" });
      if (precisaCriarSenha(data.user)) return setConferencia({ userId: user.id, estado: "sem_senha" });
      setConferencia({ userId: user.id, estado: "tem_senha" });
    });
    return () => { ativo = false; };
  }, [user?.id, semSenhaNoNavegador, tentativa]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading || (user && !rolesLoaded)) return <Carregando />;

  if (!user) return <Navigate to="/login" replace />;

  if (semSenhaNoNavegador) {
    const estado = conferencia?.userId === user.id ? conferencia.estado : "conferindo";
    if (estado === "conferindo") return <Carregando />;
    if (estado === "sem_senha") return <Navigate to="/set-password" replace />;
    if (estado === "falhou") {
      return (
        <div className="flex min-h-screen items-center justify-center p-6">
          <div className="max-w-sm space-y-4 text-center">
            <h1 className="text-xl font-semibold">Não conseguimos abrir o painel agora</h1>
            <p className="text-sm text-muted-foreground">Parece que a conexão caiu por um instante. Tente de novo em alguns segundos.</p>
            <div className="flex justify-center gap-2">
              <Button onClick={() => setTentativa((n) => n + 1)}>Tentar de novo</Button>
              <Button variant="ghost" onClick={() => signOut()}>Sair</Button>
            </div>
          </div>
        </div>
      );
    }
    // "tem_senha": o servidor confirmou a senha; segue para o painel.
  }

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
