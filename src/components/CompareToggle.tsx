import { Switch } from "@/components/ui/switch";
import { useCompare } from "@/hooks/useCompare";

// Chave do topo do Dashboard: liga ou desliga a comparação com o evento anterior em todos os gráficos.
export function CompareToggle() {
  const { ativo, setAtivo, rotulo } = useCompare();
  if (!rotulo) return null;
  return (
    <label className="inline-flex h-8 cursor-pointer items-center gap-2 rounded-full border bg-card px-2.5 text-xs font-medium text-muted-foreground">
      <Switch checked={ativo} onCheckedChange={setAtivo} aria-label={`Comparar com ${rotulo}`} />
      <span className="flex items-center gap-1.5">
        Comparar com {rotulo}
      </span>
    </label>
  );
}
