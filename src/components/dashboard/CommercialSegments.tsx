import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Chip } from "@/components/Chip";
import { InfoTip } from "@/components/InfoTip";
import { splitTickets, type Ticket } from "@/hooks/useCommercialMetrics";
import { formatDiscount, parseCoupon, type CouponKind } from "@/lib/coupons";
import { cn } from "@/lib/utils";

const int = (n: number) => Math.round(n).toLocaleString("pt-BR");

const REGIAO_POR_UF: Record<string, string> = {
  AC: "Norte", AM: "Norte", AP: "Norte", PA: "Norte", RO: "Norte", RR: "Norte", TO: "Norte",
  AL: "Nordeste", BA: "Nordeste", CE: "Nordeste", MA: "Nordeste", PB: "Nordeste", PE: "Nordeste", PI: "Nordeste", RN: "Nordeste", SE: "Nordeste",
  DF: "Centro-Oeste", GO: "Centro-Oeste", MS: "Centro-Oeste", MT: "Centro-Oeste",
  ES: "Sudeste", MG: "Sudeste", RJ: "Sudeste", SP: "Sudeste",
  PR: "Sul", RS: "Sul", SC: "Sul",
};

const PAGAMENTO: Record<string, string> = {
  CREDIT_CARD: "Cartão de crédito",
  DEBIT_CARD: "Cartão de débito",
  BOLETO: "Boleto",
  BOLETO_BANCARIO: "Boleto",
  BANK_SLIP: "Boleto",
  PIX: "Pix",
  FREE: "Gratuito",
  MANUAL: "Manual",
};

function pagamentoDe(valor: string): string {
  return PAGAMENTO[valor.trim().toUpperCase()] ?? valor;
}

export interface FormAnswerCount {
  question: string;
  answer: string;
  total: number;
}

export function regiaoDe(estado: string): string {
  const uf = estado.trim().toUpperCase().slice(-2);
  return REGIAO_POR_UF[uf] ?? "Outros";
}

const KIND_CHIP: Record<CouponKind, { label: string; variant: "paid" | "neutral" | "lavender" }> = {
  faturado: { label: "Faturado", variant: "paid" },
  cortesia: { label: "Cortesia", variant: "neutral" },
  desconto: { label: "Desconto", variant: "lavender" },
};

export function countBy(tickets: Ticket[], key: (t: Ticket) => string | null | undefined) {
  const map = new Map<string, number>();
  tickets.forEach((t) => {
    const k = key(t);
    if (!k) return;
    map.set(k, (map.get(k) || 0) + (t.quantity || 0));
  });
  return Array.from(map.entries())
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value);
}

// Barras horizontais do ds-summit: crescem da esquerda; no hover a barra fica lima e as outras esmaecem.
export function HBars({ items }: { items: { label: string; value: number }[] }) {
  const [hover, setHover] = useState<string | null>(null);
  const max = Math.max(...items.map((i) => i.value), 1);
  return (
    <div className="flex flex-col gap-3">
      {items.map((i) => (
        <div
          key={i.label}
          onMouseEnter={() => setHover(i.label)}
          onMouseLeave={() => setHover(null)}
          className={cn("transition-opacity duration-150", hover && hover !== i.label && "opacity-40")}
        >
          <div className="mb-1 flex items-center justify-between gap-3 text-[13px]">
            <span className="truncate">{i.label}</span>
            <b className="font-semibold tabular-nums">{int(i.value)}</b>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-secondary">
            <i
              className={cn(
                "block h-full origin-left animate-[grow_900ms_cubic-bezier(.16,1,.3,1)_both] rounded-full transition-colors duration-150 motion-reduce:animate-none",
                hover === i.label ? "bg-primary" : "bg-data-blue",
              )}
              style={{ width: `${(i.value / max) * 100}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function SegmentCard({ title, items, className }: { title: string; items: { label: string; value: number }[]; className?: string }) {
  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2">
          {title} <InfoTip title={title} />
        </CardTitle>
      </CardHeader>
      <CardContent>
        <HBars items={items} />
      </CardContent>
    </Card>
  );
}

interface CommercialSegmentsProps {
  tickets: Ticket[];
}

// Forma de pagamento, origem da venda e cupons. O perfil de quem compra fica na página Compradores.
export function CommercialSegments({ tickets }: CommercialSegmentsProps) {
  const { paying, bonus } = useMemo(() => splitTickets(tickets), [tickets]);

  const porPagamento = useMemo(() => countBy(paying, (t) => (t.payment_method ? pagamentoDe(t.payment_method) : null)), [paying]);
  const porOrigem = useMemo(() => countBy(paying, (t) => t.utm_source).slice(0, 8), [paying]);

  // Cupons agrupados pelo código, com o desconto e o tipo enviados pela Sympla.
  const cupons = useMemo(() => {
    const map = new Map<string, { code: string; discount: string | null; kind: CouponKind; uses: number }>();
    [...paying, ...bonus].forEach((t) => {
      const c = parseCoupon(t.coupon_code);
      if (!c) return;
      const atual = map.get(c.code) ?? { ...c, uses: 0 };
      atual.uses += t.quantity || 0;
      map.set(c.code, atual);
    });
    return Array.from(map.values()).sort((a, b) => b.uses - a.uses);
  }, [paying, bonus]);

  const segmentos = [
    { title: "Pagantes por forma de pagamento", items: porPagamento },
    { title: "Pagantes por origem (UTM)", items: porOrigem },
  ].filter((s) => s.items.length > 0);

  if (segmentos.length === 0 && cupons.length === 0) return null;

  const span = segmentos.length === 1 ? "lg:col-span-12" : segmentos.length % 2 === 0 ? "lg:col-span-6" : "lg:col-span-4";

  return (
    <div className="grid grid-cols-12 gap-[14px]">
      {segmentos.map((s) => (
        <SegmentCard key={s.title} title={s.title} items={s.items} className={cn("col-span-12", span)} />
      ))}

      {cupons.length > 0 && (
        <Card className="col-span-12">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2">
              Cupons <InfoTip title="Cupons" />
            </CardTitle>
          </CardHeader>
          <CardContent className="max-h-[420px] overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cupom</TableHead>
                  <TableHead>Desconto</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead className="text-right">Usos</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cupons.map((c) => (
                  <TableRow key={c.code}>
                    <TableCell className="font-medium">{c.code}</TableCell>
                    <TableCell className="tabular-nums">{formatDiscount(c.discount)}</TableCell>
                    <TableCell>
                      <Chip variant={KIND_CHIP[c.kind].variant}>{KIND_CHIP[c.kind].label}</Chip>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{int(c.uses)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
