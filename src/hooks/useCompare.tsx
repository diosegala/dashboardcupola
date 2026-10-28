import { createContext, useContext, useState, type ReactNode } from "react";

// Chave "Comparar com o ano anterior": vale para o Dashboard inteiro e fica guardada no navegador.
// Comparação é sempre com o evento anterior (mesma data um ano antes; lotes pelo número).
interface CompareState {
  ativo: boolean;
  setAtivo: (v: boolean) => void;
  // Ano do evento anterior, para os textos ("2026").
  rotulo: string;
}

const CompareContext = createContext<CompareState>({ ativo: false, setAtivo: () => {}, rotulo: "" });
const CHAVE = "cupola-comparar-ano-anterior";

export function CompareProvider({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  const [ativo, setAtivoState] = useState(() => {
    try {
      return localStorage.getItem(CHAVE) !== "0";
    } catch {
      return true;
    }
  });
  const setAtivo = (v: boolean) => {
    setAtivoState(v);
    try {
      localStorage.setItem(CHAVE, v ? "1" : "0");
    } catch {
      /* sem armazenamento: vale só nesta visita */
    }
  };
  // Sem evento anterior não há o que comparar.
  return <CompareContext.Provider value={{ ativo: ativo && !!rotulo, setAtivo, rotulo }}>{children}</CompareContext.Provider>;
}

export function useCompare() {
  return useContext(CompareContext);
}
