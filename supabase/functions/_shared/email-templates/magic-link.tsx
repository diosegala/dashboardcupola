/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'
import {
  BrandButton,
  BrandFallbackLink,
  BrandLayout,
  BrandNote,
  BrandText,
} from '../email-brand.tsx'

interface MagicLinkEmailProps {
  siteName: string
  confirmationUrl: string
}

export const MagicLinkEmail = ({ confirmationUrl }: MagicLinkEmailProps) => (
  <BrandLayout
    preview="Seu link para entrar no Painel de Eventos CUPOLA."
    title="Seu link de acesso"
    footerNote="Não pediu para entrar? Pode ignorar este e-mail: ninguém acessa sem clicar no link."
  >
    <BrandText>Clique no botão para entrar direto no Painel de Eventos CUPOLA.</BrandText>
    <BrandButton href={confirmationUrl}>Entrar no painel</BrandButton>
    <BrandNote>O link vale por pouco tempo e funciona uma única vez.</BrandNote>
    <BrandFallbackLink href={confirmationUrl} />
  </BrandLayout>
)

export default MagicLinkEmail
