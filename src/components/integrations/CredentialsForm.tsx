import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Eye, EyeOff } from "lucide-react";
import type { Integration } from "@/hooks/useIntegrations";

interface FieldDef {
  key: string;
  label: string;
  type: "text" | "textarea";
}

const FIELDS: Record<string, FieldDef[]> = {
  sympla: [
    { key: "api_token", label: "API Token (s_token)", type: "text" },
    { key: "event_id", label: "Event ID", type: "text" },
  ],
  pipedrive: [
    { key: "api_token", label: "API Token", type: "text" },
    { key: "domain", label: "Domínio (ex: company)", type: "text" },
  ],
  meta: [
    { key: "access_token", label: "Access Token", type: "text" },
    { key: "ad_account_id", label: "Ad Account ID", type: "text" },
  ],
  google_ads: [
    { key: "client_id", label: "Client ID", type: "text" },
    { key: "client_secret", label: "Client Secret", type: "text" },
    { key: "refresh_token", label: "Refresh Token", type: "text" },
    { key: "developer_token", label: "Developer Token", type: "text" },
    { key: "customer_id", label: "Customer ID", type: "text" },
  ],
  rd_station: [
    { key: "api_token", label: "API Token (Token Privado)", type: "text" },
  ],
  google_analytics: [
    { key: "property_id", label: "Property ID", type: "text" },
    { key: "service_account_json", label: "Service Account JSON", type: "textarea" },
  ],
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  integration: Integration;
  onSave: (credentials: Record<string, string>) => void;
}

export function CredentialsForm({ open, onOpenChange, integration, onSave }: Props) {
  const fields = FIELDS[integration.name] ?? [];
  const existing = (integration.credentials as Record<string, string> | null) ?? {};
  const [values, setValues] = useState<Record<string, string>>({});
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (open) {
      const init: Record<string, string> = {};
      fields.forEach((f) => {
        init[f.key] = existing[f.key] ?? "";
      });
      setValues(init);
      setRevealed({});
    }
  }, [open]);

  const handleSave = () => {
    onSave(values);
    onOpenChange(false);
  };

  const mask = (val: string) => (val ? "••••••••" : "");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Credenciais — {integration.name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          {fields.map((field) => (
            <div key={field.key} className="space-y-1">
              <Label>{field.label}</Label>
              <div className="flex gap-1">
                {field.type === "textarea" ? (
                  <Textarea
                    value={revealed[field.key] ? values[field.key] : (values[field.key] ? mask(values[field.key]) : "")}
                    onChange={(e) => {
                      setRevealed((r) => ({ ...r, [field.key]: true }));
                      setValues((v) => ({ ...v, [field.key]: e.target.value }));
                    }}
                    onFocus={() => {
                      if (!revealed[field.key] && values[field.key]) {
                        setRevealed((r) => ({ ...r, [field.key]: true }));
                      }
                    }}
                    rows={3}
                  />
                ) : (
                  <Input
                    type={revealed[field.key] ? "text" : "password"}
                    value={values[field.key]}
                    onChange={(e) => setValues((v) => ({ ...v, [field.key]: e.target.value }))}
                    placeholder={existing[field.key] ? "••••••••" : ""}
                  />
                )}
                {field.type === "text" && (
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    onClick={() => setRevealed((r) => ({ ...r, [field.key]: !r[field.key] }))}
                  >
                    {revealed[field.key] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSave}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
