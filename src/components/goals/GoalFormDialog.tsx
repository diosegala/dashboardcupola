import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  format,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  addWeeks,
  getISOWeek,
  getYear,
} from "date-fns";
import { CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { METRIC_OPTIONS } from "@/lib/goalMetrics";
import { useTicketTypes } from "@/hooks/useTicketTypes";

const TICKET_METRICS = ["tickets_sold", "revenue", "funnel_bofu_sales", "funnel_bofu_revenue"];

const goalSchema = z.object({
  label: z.string().trim().min(1, "Nome é obrigatório").max(100),
  metric_key: z.string().min(1, "Métrica é obrigatória"),
  target_value: z.coerce.number().positive("Valor deve ser maior que 0"),
  period_start: z.date({ required_error: "Data inicial é obrigatória" }),
  period_end: z.date({ required_error: "Data final é obrigatória" }),
  ticket_type: z.string().nullable().optional(),
}).refine((d) => d.period_end >= d.period_start, {
  message: "Data final deve ser após a data inicial",
  path: ["period_end"],
});

export type GoalFormValues = z.infer<typeof goalSchema>;

interface GoalFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: GoalFormValues) => void;
  defaultValues?: Partial<GoalFormValues>;
  isSubmitting?: boolean;
}

function getWeekOptions() {
  const today = new Date();
  const options: { label: string; from: Date; to: Date }[] = [];
  for (let i = -4; i <= 12; i++) {
    const d = addWeeks(today, i);
    const from = startOfWeek(d, { weekStartsOn: 1 });
    const to = endOfWeek(d, { weekStartsOn: 1 });
    const weekNum = getISOWeek(from);
    const year = getYear(from);
    options.push({
      label: `S${weekNum}/${year} (${format(from, "dd/MM")}–${format(to, "dd/MM")})`,
      from,
      to,
    });
  }
  return options;
}

function getMonthOptions() {
  const today = new Date();
  const options: { label: string; from: Date; to: Date }[] = [];
  for (let i = -2; i <= 6; i++) {
    const d = new Date(today.getFullYear(), today.getMonth() + i, 1);
    const from = startOfMonth(d);
    const to = endOfMonth(d);
    options.push({
      label: format(from, "MMMM yyyy"),
      from,
      to,
    });
  }
  return options;
}

function DatePickerField({ label, value, onChange, error }: { label: string; value?: Date; onChange: (d: Date | undefined) => void; error?: string }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !value && "text-muted-foreground")}>
            <CalendarIcon className="mr-2 h-4 w-4" />
            {value ? format(value, "dd/MM/yyyy") : "Selecione"}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar mode="single" selected={value} onSelect={onChange} initialFocus className="p-3 pointer-events-auto" />
        </PopoverContent>
      </Popover>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}

export function GoalFormDialog({ open, onOpenChange, onSubmit, defaultValues, isSubmitting }: GoalFormDialogProps) {
  const form = useForm<GoalFormValues>({
    resolver: zodResolver(goalSchema),
    defaultValues: {
      label: "",
      metric_key: "",
      target_value: 0,
      ticket_type: null,
      ...defaultValues,
    },
  });

  const { data: ticketTypes = [] } = useTicketTypes();

  useEffect(() => {
    if (open) {
      form.reset({
        label: defaultValues?.label ?? "",
        metric_key: defaultValues?.metric_key ?? "",
        target_value: defaultValues?.target_value ?? 0,
        period_start: defaultValues?.period_start,
        period_end: defaultValues?.period_end,
        ticket_type: defaultValues?.ticket_type ?? null,
      });
    }
  }, [open, defaultValues]);

  const grouped = METRIC_OPTIONS.reduce((acc, m) => {
    if (!acc[m.category]) acc[m.category] = [];
    acc[m.category].push(m);
    return acc;
  }, {} as Record<string, { key: string; label: string; category: string }[]>);

  const weekOptions = getWeekOptions();
  const monthOptions = getMonthOptions();

  const applyPeriod = (from: Date, to: Date) => {
    form.setValue("period_start", from, { shouldValidate: true });
    form.setValue("period_end", to, { shouldValidate: true });
  };

  const selectedMetric = form.watch("metric_key");
  const showTicketType = TICKET_METRICS.includes(selectedMetric);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>{defaultValues?.label ? "Editar Meta" : "Nova Meta"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="label">Nome</Label>
            <Input id="label" placeholder="Ex: Ingressos Q1" {...form.register("label")} />
            {form.formState.errors.label && (
              <p className="text-sm text-destructive">{form.formState.errors.label.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Métrica</Label>
            <Select value={form.watch("metric_key")} onValueChange={(v) => {
              form.setValue("metric_key", v, { shouldValidate: true });
              if (!TICKET_METRICS.includes(v)) {
                form.setValue("ticket_type", null);
              }
            }}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione a métrica" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(grouped).map(([cat, items]) => (
                  <SelectGroup key={cat}>
                    <SelectLabel>{cat}</SelectLabel>
                    {items.map((m) => (
                      <SelectItem key={m.key} value={m.key}>{m.label}</SelectItem>
                    ))}
                  </SelectGroup>
                ))}
              </SelectContent>
            </Select>
            {form.formState.errors.metric_key && (
              <p className="text-sm text-destructive">{form.formState.errors.metric_key.message}</p>
            )}
          </div>

          {/* Conditional ticket type selector */}
          {showTicketType && (
            <div className="space-y-2">
              <Label>Lote de Ingresso</Label>
              <Select
                value={form.watch("ticket_type") ?? "__all__"}
                onValueChange={(v) => form.setValue("ticket_type", v === "__all__" ? null : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Todos os lotes" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Todos os lotes</SelectItem>
                  {ticketTypes.map((tt) => (
                    <SelectItem key={tt} value={tt}>{tt}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Deixe "Todos os lotes" para meta global ou selecione um tipo específico.
              </p>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="target_value">Valor-alvo</Label>
            <Input id="target_value" type="number" step="any" {...form.register("target_value")} />
            {form.formState.errors.target_value && (
              <p className="text-sm text-destructive">{form.formState.errors.target_value.message}</p>
            )}
          </div>

          {/* Period shortcuts */}
          <div className="space-y-2">
            <Label>Atalhos de período</Label>
            <div className="flex gap-2">
              <Select onValueChange={(v) => {
                const opt = weekOptions[Number(v)];
                if (opt) applyPeriod(opt.from, opt.to);
              }}>
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Semana..." />
                </SelectTrigger>
                <SelectContent>
                  {weekOptions.map((opt, i) => (
                    <SelectItem key={i} value={String(i)}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select onValueChange={(v) => {
                const opt = monthOptions[Number(v)];
                if (opt) applyPeriod(opt.from, opt.to);
              }}>
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Mês..." />
                </SelectTrigger>
                <SelectContent>
                  {monthOptions.map((opt, i) => (
                    <SelectItem key={i} value={String(i)}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <DatePickerField
              label="Início"
              value={form.watch("period_start")}
              onChange={(d) => form.setValue("period_start", d!, { shouldValidate: true })}
              error={form.formState.errors.period_start?.message}
            />
            <DatePickerField
              label="Fim"
              value={form.watch("period_end")}
              onChange={(d) => form.setValue("period_end", d!, { shouldValidate: true })}
              error={form.formState.errors.period_end?.message}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
