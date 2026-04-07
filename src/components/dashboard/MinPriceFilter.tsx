import { DollarSign } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface MinPriceFilterProps {
  value: number;
  onChange: (value: number) => void;
}

export function MinPriceFilter({ value, onChange }: MinPriceFilterProps) {
  const isActive = value > 0;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <DollarSign className="h-4 w-4" />
          <span className="hidden sm:inline">Valor mínimo</span>
          {isActive && (
            <Badge variant="secondary" className="ml-1 px-1.5 py-0 text-xs">
              R$ {value.toFixed(2).replace(".", ",")}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72" align="end">
        <div className="space-y-3">
          <div>
            <Label className="text-sm font-medium">Valor mínimo do ingresso</Label>
            <p className="text-xs text-muted-foreground mt-1">
              Ingressos com valor unitário abaixo desse limite serão excluídos da contabilidade de vendas (ex: cortesias).
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">R$</span>
            <Input
              type="number"
              min={0}
              step={0.01}
              value={value}
              onChange={(e) => {
                const v = parseFloat(e.target.value);
                onChange(isNaN(v) ? 0 : Math.max(0, v));
              }}
              className="h-8"
              placeholder="0.00"
            />
          </div>
          {isActive && (
            <Button
              variant="ghost"
              size="sm"
              className="w-full text-xs"
              onClick={() => onChange(0)}
            >
              Remover filtro
            </Button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
