import { InfoTip } from "@/components/InfoTip";
import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface DemandGenTableProps {
  ga4Events: any[];
}

const DEMAND_EVENTS = [
  { key: "add_to_cart", label: "Add to Cart" },
  { key: "botao_sympla", label: "Botão Sympla" },
  { key: "botao_tabela", label: "Botão Tabela" },
  { key: "mais_infos_tp_mobile", label: "Mais Infos TP (Mobile)" },
];

export function DemandGenTable({ ga4Events }: DemandGenTableProps) {
  const totals = useMemo(() => {
    const map = new Map<string, number>();
    for (const row of ga4Events) {
      map.set(row.event_name, (map.get(row.event_name) || 0) + (row.event_count || 0));
    }
    return DEMAND_EVENTS.map((e) => ({
      ...e,
      count: map.get(e.key) || 0,
    }));
  }, [ga4Events]);

  const grandTotal = totals.reduce((s, t) => s + t.count, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">Geração de Demanda no Site <InfoTip title="Geração de Demanda no Site" /></CardTitle>
      </CardHeader>
      <CardContent>
        {grandTotal === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            Nenhum dado de eventos no período
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Evento</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {totals.map((t) => (
                <TableRow key={t.key}>
                  <TableCell className="font-medium">{t.label}</TableCell>
                  <TableCell className="text-right">{t.count.toLocaleString("pt-BR")}</TableCell>
                </TableRow>
              ))}
              <TableRow className="font-bold">
                <TableCell>Total</TableCell>
                <TableCell className="text-right">{grandTotal.toLocaleString("pt-BR")}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
