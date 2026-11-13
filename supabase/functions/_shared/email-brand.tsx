/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from 'npm:@react-email/components@0.0.22'

// Cores do painel (src/index.css), convertidas para hex porque clientes de e-mail não leem variáveis.
export const brand = {
  lime: '#b2f90b',
  ink: '#0f1114',
  muted: '#6b6f76',
  sand: '#f8f8f7',
  line: '#e2e2df',
  limeText: '#3e6b00',
  font: "'Funnel Display', 'Helvetica Neue', Arial, sans-serif",
  radius: '14px',
}

interface BrandLayoutProps {
  preview: string
  title: string
  children: React.ReactNode
  footerNote?: string
}

export const BrandLayout = ({ preview, title, children, footerNote }: BrandLayoutProps) => (
  <Html lang="pt-BR" dir="ltr">
    <Head />
    <Preview>{preview}</Preview>
    <Body style={main}>
      <Container style={outer}>
        <Section style={header}>
          <Text style={wordmark}>CUPOLA</Text>
          <Text style={tag}>Painel de Eventos</Text>
        </Section>
        <Section style={card}>
          <Section style={limeBar} />
          <Heading style={h1}>{title}</Heading>
          {children}
        </Section>
        <Text style={footer}>
          {footerNote ?? 'Se você não esperava este e-mail, pode ignorá-lo com segurança.'}
        </Text>
        <Text style={footerSmall}>
          Painel de Eventos CUPOLA · uso interno da equipe
        </Text>
      </Container>
    </Body>
  </Html>
)

export const BrandText = ({ children }: { children: React.ReactNode }) => (
  <Text style={text}>{children}</Text>
)

export const BrandButton = ({ href, children }: { href: string; children: React.ReactNode }) => (
  <Section style={{ margin: '8px 0 24px' }}>
    <Button style={button} href={href}>
      {children}
    </Button>
  </Section>
)

export const BrandNote = ({ children }: { children: React.ReactNode }) => (
  <Text style={note}>{children}</Text>
)

export const BrandFallbackLink = ({ href }: { href: string }) => (
  <Text style={fallback}>
    Se o botão não funcionar, copie e cole este endereço no navegador:
    <br />
    <Link href={href} style={fallbackLink}>
      {href}
    </Link>
  </Text>
)

export const BrandCode = ({ code }: { code: string }) => (
  <Text style={codeStyle}>{code}</Text>
)

export const strong = { color: brand.ink, fontWeight: 700 as const }

const main = { backgroundColor: '#ffffff', fontFamily: brand.font, margin: 0, padding: 0 }
const outer = { maxWidth: '560px', margin: '0 auto', padding: '32px 20px' }
const header = { padding: '0 4px 18px' }
const wordmark = {
  fontSize: '22px',
  fontWeight: 800 as const,
  letterSpacing: '0.18em',
  color: brand.ink,
  margin: 0,
  lineHeight: '1',
}
const tag = {
  display: 'inline-block',
  fontSize: '11px',
  fontWeight: 700 as const,
  letterSpacing: '0.08em',
  textTransform: 'uppercase' as const,
  color: brand.ink,
  backgroundColor: brand.lime,
  borderRadius: '999px',
  padding: '4px 10px',
  margin: '10px 0 0',
}
const card = {
  backgroundColor: brand.sand,
  border: `1px solid ${brand.line}`,
  borderRadius: brand.radius,
  padding: '28px 28px 8px',
}
const limeBar = {
  width: '44px',
  height: '6px',
  backgroundColor: brand.lime,
  borderRadius: '999px',
  margin: '0 0 18px',
}
const h1 = {
  fontSize: '24px',
  fontWeight: 800 as const,
  color: brand.ink,
  lineHeight: '1.25',
  margin: '0 0 16px',
}
const text = { fontSize: '15px', color: brand.muted, lineHeight: '1.6', margin: '0 0 16px' }
const button = {
  backgroundColor: brand.lime,
  color: brand.ink,
  fontSize: '15px',
  fontWeight: 700 as const,
  borderRadius: '999px',
  padding: '14px 26px',
  textDecoration: 'none',
  display: 'inline-block',
}
const note = {
  fontSize: '13px',
  color: brand.ink,
  lineHeight: '1.5',
  backgroundColor: '#ffffff',
  border: `1px solid ${brand.line}`,
  borderRadius: '10px',
  padding: '12px 14px',
  margin: '0 0 20px',
}
const fallback = { fontSize: '12px', color: brand.muted, lineHeight: '1.5', margin: '0 0 20px', wordBreak: 'break-all' as const }
const fallbackLink = { color: brand.limeText, textDecoration: 'underline' }
const codeStyle = {
  fontFamily: "'Courier New', Courier, monospace",
  fontSize: '30px',
  fontWeight: 700 as const,
  letterSpacing: '0.3em',
  color: brand.ink,
  backgroundColor: '#ffffff',
  border: `2px solid ${brand.lime}`,
  borderRadius: '12px',
  padding: '14px 18px',
  textAlign: 'center' as const,
  margin: '4px 0 24px',
}
const footer = { fontSize: '12px', color: brand.muted, lineHeight: '1.5', margin: '22px 4px 4px' }
const footerSmall = { fontSize: '11px', color: '#9a9da3', margin: '0 4px' }
