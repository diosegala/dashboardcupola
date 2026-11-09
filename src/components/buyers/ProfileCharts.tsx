import { useMemo } from "react";
import { Card } from "@/components/ui/card";
import { InfoTip } from "@/components/InfoTip";
import { CountUp } from "@/components/CountUp";
import { companyProfiles, countProfiles } from "@/lib/companyProfile";
import { BrazilTileMap, ufDe } from "@/components/buyers/profile/BrazilTileMap";
import { CompanyRanking } from "@/components/buyers/profile/CompanyRanking";
import { BubblesViz, CloudViz, DonutViz, HighlightViz, VizCard, vizFor, VIZ, type Item } from "@/components/buyers/profile/ProfileViz";
import { themeCharts } from "@/lib/formQuestions";
import { isApproved } from "@/lib/eventConfig";
import type { Ticket } from "@/hooks/useCommercialMetrics";
import type { Company, EventRef, Person } from "@/lib/buyers";

const int = (n: number) => Math.round(n).toLocaleString("pt-BR");

interface ProfileChartsProps {
  tickets: Ticket[];
  formAnswers: { question: string; answer: string; total: number }[];
  // Só para administradores: pessoas e empresas de todos os eventos CUPOLA, para recorrência e ranking.
  people?: Person[];
  companies?: Company[];
  eventos?: EventRef[];
  eventSlug?: string;
}

// Perguntas secundárias: lista curta, lado a lado, sem gráfico.
const COMPACTOS = ["Visita presencial", "Acessibilidade"];

function ListaCompacta({ items }: { items: Item[] }) {
  return (
    <ul className="flex max-h-24 flex-col gap-1 overflow-y-auto text-sm">
      {items.map((it) => (
        <li key={it.label} className="flex items-baseline justify-between gap-3">
          <span className="min-w-0 truncate text-muted-foreground" title={it.label}>{it.label}</span>
          <b className="shrink-0 font-semibold tabular-nums">{int(it.value)}</b>
        </li>
      ))}
    </ul>
  );
}

function Grafico({ title, items }: { title: string; items: Item[] }) {
  const forma = vizFor(title, items);
  if (forma === "cloud") return <CloudViz items={items} />;
  if (forma === "highlight") return <HighlightViz items={items} />;
  if (forma === "donut") return <DonutViz items={items} />;
  return <BubblesViz items={items} />;
}

// Perfis somados: barra = % dos participantes que marcaram o perfil (a soma passa de 100% porque a resposta é múltipla).
function PerfilBarras({ items, total }: { items: Item[]; total: number }) {
  return (
    <ul className="flex flex-col gap-3">
      {items.map((it, i) => {
        const f = it.value / (total || 1);
        const cor = it.label === "Outros" ? "hsl(var(--muted-foreground) / 0.55)" : VIZ[i % VIZ.length];
        return (
          <li key={it.label} className="flex flex-col gap-1.5">
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="font-medium">{it.label}</span>
              <span className="shrink-0 tabular-nums text-muted-foreground">
                <b className="font-semibold text-foreground">{Math.round(f * 100)}%</b> · {int(it.value)}
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full transition-[width] duration-700" style={{ width: `${Math.min(f, 1) * 100}%`, background: cor }} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function Destaque({ titulo, valor, sufixo, cor, atraso }: { titulo: string; valor: number; sufixo?: string; cor: string; atraso: number }) {
  return (
    <Card
      className="relative col-span-6 flex animate-[pop-in_600ms_cubic-bezier(.16,1,.3,1)_both] flex-col gap-2 overflow-hidden p-5 lg:col-span-3"
      style={{ animationDelay: `${atraso}ms` }}
    >
      <span className="absolute -right-6 -top-6 h-20 w-20 rounded-full opacity-20 blur-xl" style={{ background: cor }} aria-hidden />
      <div className="flex items-center gap-2 text-[13px] font-semibold text-foreground/75">
        <i className="inline-block h-2 w-2 rounded-full" style={{ background: cor }} />
        {titulo} <InfoTip title={titulo} />
      </div>
      <div className="text-[clamp(28px,2.8vw,38px)] font-semibold leading-none tracking-[-0.035em]">
        <CountUp value={valor} format={(n) => int(n)} />
        {sufixo && <span className="ml-0.5 text-[0.6em] text-muted-foreground">{sufixo}</span>}
      </div>
    </Card>
  );
}

// Perfil de quem vai ao evento: só totais, sem dados pessoais. Cada pergunta do formulário ganha um gráfico
// escolhido pelo jeito das respostas; perguntas novas de qualquer evento entram sozinhas.
export function ProfileCharts({ tickets, formAnswers, people, companies, eventos, eventSlug }: ProfileChartsProps) {
  const aprovados = useMemo(() => tickets.filter((t) => isApproved(t.status)), [tickets]);
  const participantes = useMemo(() => aprovados.reduce((s, t) => s + (t.quantity || 0), 0), [aprovados]);
  const porUf = useMemo(() => {
    const map: Record<string, number> = {};
    aprovados.forEach((t) => {
      const uf = ufDe(t.buyer_state);
      if (uf) map[uf] = (map[uf] ?? 0) + (t.quantity || 0);
    });
    return map;
  }, [aprovados]);
  const porPerfil = useMemo(() => countProfiles(aprovados, (t) => t.company_size, (t) => t.quantity || 0), [aprovados]);
  const responderamPerfil = useMemo(
    () => aprovados.reduce((s, t) => s + (companyProfiles(t.company_size).length ? t.quantity || 0 : 0), 0),
    [aprovados],
  );
  const temas = useMemo(() => themeCharts(formAnswers), [formAnswers]);

  const cidades = temas.find((t) => t.title === "Cidades");
  const empresasForm = temas.find((t) => t.title === "Empresas");
  const outros = [
    ...(porPerfil.length ? [{ title: "Perfil da empresa", items: porPerfil }] : []),
    ...temas.filter((t) => t.title !== "Cidades" && t.title !== "Empresas"),
  ].filter((t) => t.items.length > 0 && !COMPACTOS.includes(t.title));
  const compactos = COMPACTOS.flatMap((title) => temas.filter((t) => t.title === title && t.items.length > 0));

  const admin = !!(people && companies && eventos && eventSlug);
  const noEvento = admin ? people!.filter((p) => p.events[eventSlug!]) : [];
  const voltaram = noEvento.filter((p) => Object.keys(p.events).length > 1).length;
  const empresasNoEvento = admin ? companies!.filter((c) => c.events[eventSlug!]).length : empresasForm?.distinct ?? 0;

  if (participantes === 0 && temas.length === 0) {
    return <p className="py-12 text-center text-sm text-muted-foreground">Ainda não há participantes nem respostas do formulário para este evento.</p>;
  }

  return (
    <div className="grid grid-cols-12 gap-[14px]">
      <Destaque titulo="Participantes" valor={participantes} cor={VIZ[0]} atraso={0} />
      <Destaque titulo="Estados" valor={Object.keys(porUf).length} cor={VIZ[1]} atraso={80} />
      {admin && noEvento.length > 0 ? (
        <Destaque titulo="Voltaram à CUPOLA" valor={Math.round((voltaram / noEvento.length) * 100)} sufixo="%" cor={VIZ[2]} atraso={160} />
      ) : (
        <Destaque titulo="Cidades" valor={cidades?.distinct ?? 0} cor={VIZ[2]} atraso={160} />
      )}
      <Destaque titulo="Empresas" valor={empresasNoEvento} cor={VIZ[3]} atraso={240} />

      {Object.keys(porUf).length > 0 && (
        <VizCard title="De onde vêm" subtitle="Cada quadradinho é um estado; quanto mais forte a cor, mais gente." className="col-span-12 xl:col-span-7">
          <BrazilTileMap porUf={porUf} />
        </VizCard>
      )}

      {outros.map((t, i) => (
        <VizCard
          key={t.title}
          title={t.title}
          subtitle={
            t.title === "Perfil da empresa"
              ? `% de ${int(responderamPerfil)} participantes que responderam. Cada um pode marcar mais de um perfil.`
              : undefined
          }
          className={i === 0 && Object.keys(porUf).length > 0 ? "col-span-12 xl:col-span-5" : "col-span-12 md:col-span-6 xl:col-span-4"}
        >
          {t.title === "Perfil da empresa" ? (
            <PerfilBarras items={t.items} total={responderamPerfil} />
          ) : (
            <Grafico title={t.title} items={t.items} />
          )}
        </VizCard>
      ))}

      {compactos.map((t) => (
        <VizCard key={t.title} title={t.title} className={compactos.length > 1 ? "col-span-12 sm:col-span-6" : "col-span-12"}>
          <ListaCompacta items={t.items} />
        </VizCard>
      ))}

      {cidades && cidades.items.length > 0 && (
        <VizCard title="Cidades" subtitle={`${int(cidades.distinct)} cidades diferentes`} className="col-span-12">
          <CloudViz items={cidades.items} limite={30} />
        </VizCard>
      )}

      {admin ? (
        <CompanyRanking companies={companies!} eventos={eventos!} eventSlug={eventSlug!} />
      ) : (
        empresasForm &&
        empresasForm.items.length > 0 && (
          <VizCard title="Empresas" subtitle={`${int(empresasForm.distinct)} empresas diferentes`} className="col-span-12">
            <CloudViz items={empresasForm.items} limite={30} />
          </VizCard>
        )
      )}
    </div>
  );
}
