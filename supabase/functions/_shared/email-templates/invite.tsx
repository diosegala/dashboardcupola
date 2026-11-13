/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'
import {
  BrandButton,
  BrandFallbackLink,
  BrandLayout,
  BrandNote,
  BrandText,
  strong,
} from '../email-brand.tsx'

interface InviteEmailProps {
  siteName: string
  siteUrl: string
  confirmationUrl: string
}

export const InviteEmail = ({ confirmationUrl }: InviteEmailProps) => (
  <BrandLayout
    preview="Seu acesso ao Painel de Eventos CUPOLA está pronto. Falta só criar sua senha."
    title="Boas-vindas ao Painel de Eventos CUPOLA!"
    footerNote="Recebeu este convite por engano? Pode ignorar: sem criar a senha, nenhum acesso é liberado."
  >
    <BrandText>
      Agora você acompanha em um só lugar as{' '}
      <span style={strong}>vendas, metas e resultados</span> dos eventos da CUPOLA, em tempo real.
    </BrandText>
    <BrandText>Para começar, é só criar sua senha:</BrandText>
    <BrandButton href={confirmationUrl}>Criar minha senha</BrandButton>
    <BrandNote>
      Este link vale por 24 horas e funciona uma única vez. Se ele vencer, use
      “Esqueci minha senha” na tela de login ou peça um novo convite.
    </BrandNote>
    <BrandFallbackLink href={confirmationUrl} />
  </BrandLayout>
)

export default InviteEmail
