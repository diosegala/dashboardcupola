import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import fs from "fs";
import { componentTagger } from "lovable-tagger";
import { PRIMEIRA_MIGRACAO_CHECADA, tabelasSemAuditoria } from "./src/lib/auditCheck";

// Tabela nova sem registro de atividade não sobe: na publicação o build falha; na prévia só avisa.
function checarAuditoria(): Plugin {
  let publicando = false;
  return {
    name: "checar-auditoria",
    configResolved(c) {
      publicando = c.command === "build";
    },
    buildStart() {
      const dir = path.resolve(__dirname, "drizzle/migrations");
      if (!fs.existsSync(dir)) return;
      const faltando = fs
        .readdirSync(dir)
        .filter((f) => /^\d{4}_.*\.sql$/.test(f) && Number(f.slice(0, 4)) >= PRIMEIRA_MIGRACAO_CHECADA)
        .flatMap((f) => tabelasSemAuditoria(fs.readFileSync(path.join(dir, f), "utf8")).map((t) => `${f} (${t})`));
      if (!faltando.length) return;
      const msg = `Tabela nova sem registro de atividade. Chame public.auditoria_ligar('<tabela>') na mesma migração: ${faltando.join(", ")}`;
      if (publicando) this.error(msg);
      else this.warn(msg);
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [react(), checarAuditoria(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    // Uma única cópia do React: evita tela branca ("reading 'useContext'") quando a prévia reempacota bibliotecas.
    dedupe: ["react", "react-dom", "react/jsx-runtime"],
  },
  optimizeDeps: {
    include: ["react", "react-dom", "react/jsx-runtime", "next-themes", "@radix-ui/react-collapsible", "@radix-ui/react-select"],
  },
  build: {
    rollupOptions: {
      output: {
        // Bibliotecas grandes em arquivos próprios: ficam em cache entre publicações e não travam a primeira tela.
        manualChunks: {
          react: ["react", "react-dom", "react-router-dom"],
          charts: ["recharts"],
          supabase: ["@supabase/supabase-js"],
          query: ["@tanstack/react-query"],
        },
      },
    },
  },
}));
