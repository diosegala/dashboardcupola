import { ThemeProvider as NextThemesProvider } from "next-themes";
import type { ReactNode } from "react";

// Segue o tema do navegador até a pessoa escolher um no botão; a escolha fica salva.
export function ThemeProvider({ children }: { children: ReactNode }) {
  return (
    <NextThemesProvider attribute="class" defaultTheme="system" enableSystem storageKey="cupola-summit-tema">
      {children}
    </NextThemesProvider>
  );
}
