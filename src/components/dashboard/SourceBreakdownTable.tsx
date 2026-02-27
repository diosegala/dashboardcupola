import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface SourceData {
  source: string;
  sessions: number;
  conversions: number;
  avg_engagement_time: number;
  bounce_rate: number;
}

interface SourceBreakdownTableProps {
  title: string;
  data: SourceData[];
  metricKey: keyof Omit<SourceData, "source">;
  formatValue?: (value: number) => string;
}

export function SourceBreakdownTable({
  title,
  data,
  metricKey,
  formatValue = (v) => v.toLocaleString("pt-BR"),
}: SourceBreakdownTableProps) {
  const sorted = [...data].sort((a, b) => b[metricKey] - a[metricKey]).slice(0, 10);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Origem</TableHead>
              <TableHead className="text-right">Valor</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.length === 0 ? (
              <TableRow>
                <TableCell colSpan={2} className="text-center text-muted-foreground">
                  Sem dados
                </TableCell>
              </TableRow>
            ) : (
              sorted.map((row) => (
                <TableRow key={row.source}>
                  <TableCell className="font-medium">{row.source}</TableCell>
                  <TableCell className="text-right">
                    {formatValue(row[metricKey])}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
