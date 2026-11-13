import { PasswordInput } from "@/components/ui/password-input";
import { traduzirErro } from "@/lib/mensagensErro";
import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Loader2, Check, X } from "lucide-react";
import { criteriosSenha } from "@/lib/passwordRules";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { ThemeToggle } from "@/components/ThemeToggle";
import { CupolaLogo } from "@/components/CupolaLogo";
import { firstName } from "@/lib/personName";


function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="app-bg" aria-hidden>
        <span className="orb orb-1" />
        <span className="orb orb-2" />
        <span className="orb orb-3" />
      </div>
      <ThemeToggle className="absolute right-4 top-4" />
      <Card className="w-full max-w-md p-2">{children}</Card>
    </div>
  );
}

export default function SetPassword() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<"checking" | "ready" | "invalid">("checking");
  const [nome, setNome] = useState("");
  const { toast } = useToast();

  useEffect(() => {
    const hash = new URLSearchParams(window.location.hash.slice(1));
    if (hash.get("error")) setStatus("invalid");

    const pronto = (meta?: Record<string, unknown>) => {
      setStatus("ready");
      const n = typeof meta?.name === "string" ? meta.name : "";
      if (n) setNome(firstName(n));
    };
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if ((event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") && session) pronto(session.user.user_metadata);
    });
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) pronto(session.user.user_metadata);
    });
    const t = window.setTimeout(() => setStatus((s) => (s === "checking" ? "invalid" : s)), 8000);
    return () => { subscription.unsubscribe(); window.clearTimeout(t); };
  }, []);

  const criterios = criteriosSenha(password, confirmPassword);
  const valida = criterios.every((c) => c.ok);
  const [erro, setErro] = useState("");

  const sair = async () => {
    await supabase.auth.signOut();
    navigate("/login", { replace: true });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valida) return;
    setErro("");
    setLoading(true);
    // Senha e marca "senha criada" vão juntas: se a senha falhar, nada é marcado.
    const { error } = await supabase.auth.updateUser({ password, data: { password_set_at: new Date().toISOString() } });
    if (error) {
      setErro(traduzirErro(error));
      setLoading(false);
      return;
    }
    toast({ title: "Senha criada", description: "Tudo pronto. Bem-vindo(a) ao painel!" });
    navigate("/", { replace: true });
  };

  if (status === "checking") {
    return (
      <Shell>
        <CardHeader className="items-center text-center">
          <CupolaLogo className="mx-auto mb-5 h-7" />
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          <CardDescription>Conferindo seu convite…</CardDescription>
        </CardHeader>
      </Shell>
    );
  }

  if (status === "invalid") {
    return (
      <Shell>
        <CardHeader className="text-center">
          <CupolaLogo className="mx-auto mb-5 h-7" />
          <CardTitle className="font-display text-2xl font-normal leading-[1.45]">Este link não vale mais</CardTitle>
          <CardDescription>
            Os links de convite e de troca de senha expiram e só podem ser usados uma vez. Peça um novo ao administrador ou gere outro abaixo.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button asChild className="w-full"><Link to="/forgot-password">Receber novo link</Link></Button>
          <Button asChild variant="ghost" className="w-full"><Link to="/login">Voltar para o login</Link></Button>
        </CardContent>
      </Shell>
    );
  }

  return (
    <Shell>
      <CardHeader className="text-center">
        <CupolaLogo className="mx-auto mb-5 h-7" />
        <CardTitle className="font-display text-2xl font-normal leading-[1.45]">
          {nome ? `Boas-vindas, ${nome}!` : "Crie sua senha"}
        </CardTitle>
        <CardDescription>Defina a senha que você vai usar para entrar no painel de eventos.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="password">Nova senha</Label>
            <PasswordInput id="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} required placeholder="••••••••" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirme a senha</Label>
            <PasswordInput id="confirmPassword" autoComplete="new-password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required placeholder="••••••••" />
          </div>
          <ul className="space-y-1 text-sm">
            {criterios.map((c) => (
              <li key={c.id} className={`flex items-center gap-2 ${c.ok ? "text-ok" : "text-destructive"}`}>
                {c.ok ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />}
                {c.texto}
              </li>
            ))}
            <li className="pt-1 text-xs text-muted-foreground">Senhas que já vazaram na internet também são recusadas.</li>
          </ul>
          {erro && (
            <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">{erro}</p>
          )}
          <Button type="submit" className="w-full" disabled={loading || !valida}>
            {loading ? "Salvando…" : "Criar senha e entrar"}
          </Button>
          <Button type="button" variant="ghost" className="w-full" onClick={sair}>Sair sem criar senha</Button>
        </form>
      </CardContent>
    </Shell>
  );
}
