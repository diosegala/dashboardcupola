import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface SourceData {
  source: string;
  sessions: number;
  conversions: number;
  avg_engagement_time: number;
  bounce_rate: number;
}

interface SourceBreakdownDataTableProps {
  title: string;
  data: SourceData[];
  metricKey: keyof Omit<SourceData, "source">;
  formatValue?: (value: number) => string;
}

export function SourceBreakdownDataTable({
  title,
  data,
  metricKey,
  formatValue = (v) => v.toLocaleString("pt-BR"),
}: SourceBreakdownDataTableProps) {
  const sorted = [...data].sort((a, b) => b[metricKey] - a[metricKey]).slice(0, 10);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        {sorted.length === 0 ? (
          <p className="text-center text-muted-foreground text-sm py-4">Sem dados</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="h-8 text-xs">Origem</TableHead>
                <TableHead className="h-8 text-xs text-right">Valor</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.map((row) => (
                <TableRow key={row.source}>
                  <TableCell className="py-2 text-xs">
                    {row.source.length > 20 ? row.source.slice(0, 19) + "…" : row.source}
                  </TableCell>
                  <TableCell className="py-2 text-xs text-right font-medium">
                    {formatValue(row[metricKey])}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
