import { useMemo, useState } from "react";
import { Check, ChevronsUpDown, X } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export interface Campaign {
  campaign_id: string;
  campaign_name: string;
}

interface CampaignFilterProps {
  campaigns: Campaign[];
  selected: string[];
  onChange: (ids: string[]) => void;
}

export function CampaignFilter({ campaigns, selected, onChange }: CampaignFilterProps) {
  const [open, setOpen] = useState(false);

  const sorted = useMemo(
    () => [...campaigns].sort((a, b) => a.campaign_name.localeCompare(b.campaign_name)),
    [campaigns],
  );

  const toggle = (id: string) => {
    onChange(
      selected.includes(id) ? selected.filter((s) => s !== id) : [...selected, id],
    );
  };

  const label =
    selected.length === 0
      ? "Todas as campanhas"
      : selected.length === 1
        ? sorted.find((c) => c.campaign_id === selected[0])?.campaign_name ?? "1 campanha"
        : `${selected.length} campanhas`;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-[260px] justify-between text-sm font-normal"
        >
          <span className="truncate">{label}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-[300px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Buscar campanha..." />
          <CommandList>
            <CommandEmpty>Nenhuma campanha encontrada.</CommandEmpty>
            <CommandGroup>
              {sorted.map((c) => (
                <CommandItem
                  key={c.campaign_id}
                  value={c.campaign_name}
                  onSelect={() => toggle(c.campaign_id)}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      selected.includes(c.campaign_id) ? "opacity-100" : "opacity-0",
                    )}
                  />
                  <span className="truncate">{c.campaign_name}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>

        {selected.length > 0 && (
          <div className="border-t p-2">
            <Button
              variant="ghost"
              size="sm"
              className="w-full text-xs"
              onClick={() => {
                onChange([]);
                setOpen(false);
              }}
            >
              <X className="mr-1 h-3 w-3" />
              Limpar filtro
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
