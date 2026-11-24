// A pizza da tela "Cupons em uso".
// Regra: o total do centro soma apenas usos de cupom. "Sem cupom" continua sendo fatia e linha da lista,
// mas não entra no total — cupom em uso é só o que tem código usado.
import { couponCodes, couponLabel } from "@/lib/coupons";

export interface CupomUsado {
  code: string;
  uses: number;
}

export interface FatiaPizza {
  label: string;
  value: number;
  // Códigos por trás da fatia, já escritos para mostrar no aviso do mouse ("LETICIAC5 + LETICIA10").
  codes?: string;
  semCupom?: boolean;
}

// Quantos cupons aparecem sozinhos na pizza; o resto vira "Outros".
const TOP = 5;

export function montarPizza(
  visiveis: CupomUsado[],
  semCupom: { usos: number },
  opts: { todos: boolean; buscando: boolean },
): { fatias: FatiaPizza[]; usosEmCupons: number } {
  const top: FatiaPizza[] = visiveis.slice(0, TOP).map((c) => ({ label: couponLabel(c.code), codes: couponCodes(c.code), value: c.uses }));
  const resto = visiveis.slice(TOP).reduce((s, c) => s + c.uses, 0);
  const cupons: FatiaPizza[] = resto > 0 ? [...top, { label: "Outros", value: resto }] : top;
  // O centro considera apenas os cupons usados.
  const usosEmCupons = cupons.reduce((s, f) => s + f.value, 0);
  // Em "Todos", sem busca, a fatia "Sem cupom" mostra as vendas da Sympla sem código. Faturados já estão no cupom de quem vendeu.
  const fatias = opts.todos && !opts.buscando && semCupom.usos > 0 ? [...cupons, { label: "Sem cupom", value: semCupom.usos, semCupom: true }] : cupons;
  return { fatias, usosEmCupons };
}
