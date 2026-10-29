import { Switch } from "@/components/ui/switch";
import { useCompare } from "@/hooks/useCompare";

// Chave do topo do Dashboard: liga ou desliga a comparação com o evento anterior em todos os gráficos.
export function CompareToggle() {
  const { ativo, setAtivo, rotulo } = useCompare();
  if (!rotulo) return null;
  return (
    <label className="inline-flex h-10 cursor-pointer items-center gap-2.5 rounded-full border bg-card px-3.5 text-[13px] font-medium">
      <Switch checked={ativo} onCheckedChange={setAtivo} aria-label={`Comparar com ${rotulo}`} />
      <span className="flex items-center gap-1.5">
        Comparar com {rotulo}
      </span>
    </label>
  );
}
