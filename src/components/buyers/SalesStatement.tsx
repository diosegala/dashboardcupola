import { useMemo, useState } from "react";
import { format } from "date-fns";
import { ExternalLink } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { splitTickets, type Ticket } from "@/hooks/useCommercialMetrics";
import { utmTexto } from "@/components/dashboard/CommercialSegments";
import { batchOf } from "@/lib/batches";
import { parseCoupon } from "@/lib/coupons";
import { saleCode } from "@/lib/salesCategories";
import { VALOR_LIQUIDO_SYMPLA } from "@/lib/metricInfo";
import { cn } from "@/lib/utils";

const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const ORIGENS = [
  { key: "todas", label: "Todas" },
  { key: "sympla", label: "Sympla" },
  { key: "pipedrive", label: "Faturados" },
] as const;

const linkDe = (t: Ticket) => {
  const partes = [t.utm_source, t.utm_medium, t.utm_campaign, t.utm_content].map(utmTexto);
  return t.source === "pipedrive" || !partes[0] ? "—" : partes.map((p) => p || "—").join(" / ");
};

// Extrato: uma linha por venda paga, da mais recente para a mais antiga, com o código para achar a venda na origem.
export function SalesStatement({ tickets }: { tickets: Ticket[] }) {
  const [origem, setOrigem] = useState<(typeof ORIGENS)[number]["key"]>("todas");
  const [busca, setBusca] = useState("");

  const linhas = useMemo(
    () =>
      splitTickets(tickets).paying
        .map((t) => {
          const faturado = t.source === "pipedrive";
          const cupom = parseCoupon(t.coupon_code)?.code ?? "—";
          const descricao = faturado ? t.company || t.deal_title || "Negócio sem nome" : t.ticket_type || "—";
          const codigo = saleCode(t) ?? "—";
          const link = linkDe(t);
          const vendedor = t.seller_name ?? t.seller ?? "—";
          return { t, faturado, cupom, descricao, codigo, link, vendedor, texto: [descricao, cupom, codigo, link, vendedor].join(" ").toLowerCase() };
        })
        .sort((a, b) => String(b.t.sold_at ?? "").localeCompare(String(a.t.sold_at ?? ""))),
    [tickets],
  );

  const termo = busca.trim().toLowerCase();
  const visiveis = linhas.filter((l) => (origem === "todas" || (origem === "pipedrive") === l.faturado) && (!termo || l.texto.includes(termo)));

  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-center gap-3">
        <div className="inline-flex w-fit items-center gap-0.5 rounded-[18px] border bg-secondary p-1">
          {ORIGENS.map((o) => (
            <button
              key={o.key}
              type="button"
              onClick={() => setOrigem(o.key)}
              className={cn("rounded-full px-3 py-1 text-xs font-semibold transition-colors duration-150", origem === o.key ? "bg-foreground text-background" : "text-muted-foreground hover:bg-card hover:text-foreground")}
            >
              {o.label}
            </button>
          ))}
        </div>
        <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar empresa, cupom, link ou código" className="h-9 w-full max-w-[300px] rounded-full bg-card" />
        <span className="text-xs text-muted-foreground">{visiveis.length.toLocaleString("pt-BR")} vendas</span>
      </div>

      <div className="mt-4 max-h-[560px] overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Data</TableHead>
              <TableHead>Origem</TableHead>
              <TableHead>Lote</TableHead>
              <TableHead>Tipo ou negócio</TableHead>
              <TableHead className="text-right">Qtd.</TableHead>
              <TableHead className="text-right">Valor</TableHead>
              <TableHead>Cupom</TableHead>
              <TableHead>Link</TableHead>
              <TableHead>Vendedor</TableHead>
              <TableHead>Pedido ou negócio</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visiveis.length === 0 ? (
              <TableRow><TableCell colSpan={10} className="py-8 text-center text-sm text-muted-foreground">Nenhuma venda encontrada.</TableCell></TableRow>
            ) : visiveis.map((l, i) => (
              <TableRow key={`${l.codigo}-${i}`}>
                <TableCell className="whitespace-nowrap tabular-nums">{l.t.sold_at ? format(new Date(l.t.sold_at), "dd/MM/yyyy") : "—"}</TableCell>
                <TableCell>{l.faturado ? "Faturado" : "Sympla"}</TableCell>
                <TableCell className="whitespace-nowrap">{batchOf(l.t.ticket_type) ?? "—"}</TableCell>
                <TableCell className="min-w-[200px]">{l.descricao}</TableCell>
                <TableCell className="text-right tabular-nums">{l.t.quantity ?? 0}</TableCell>
                <TableCell className="whitespace-nowrap text-right tabular-nums">{brl(Number(l.t.total_price || 0))}</TableCell>
                <TableCell>{l.cupom}</TableCell>
                <TableCell className="min-w-[180px] text-xs text-muted-foreground">{l.link}</TableCell>
                <TableCell>{l.vendedor}</TableCell>
                <TableCell className="whitespace-nowrap tabular-nums">
                  {l.faturado && l.t.crm_account ? (
                    <a href={`https://${l.t.crm_account}.pipedrive.com/deal/${l.codigo}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 underline underline-offset-4">
                      #{l.codigo} <ExternalLink className="h-3 w-3" />
                    </a>
                  ) : (
                    l.codigo
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">Só vendas pagas, sem cortesias nem cancelamentos. {VALOR_LIQUIDO_SYMPLA}</p>
    </Card>
  );
}
