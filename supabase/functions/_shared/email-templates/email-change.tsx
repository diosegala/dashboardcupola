/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'
import {
  BrandButton,
  BrandFallbackLink,
  BrandLayout,
  BrandText,
  strong,
} from '../email-brand.tsx'

interface EmailChangeEmailProps {
  siteName: string
  // oldEmail is the user's current address (HookData.OldEmail). For the
  // NEW-recipient half of a secure email_change fanout, `email` equals the
  // recipient (NEW), so the "from" line must render oldEmail to read
  // "from OLD to NEW" instead of "from NEW to NEW".
  oldEmail: string
  email: string
  newEmail: string
  confirmationUrl: string
}

export const EmailChangeEmail = ({ oldEmail, newEmail, confirmationUrl }: EmailChangeEmailProps) => (
  <BrandLayout
    preview="Confirme a troca de e-mail da sua conta no Painel de Eventos CUPOLA."
    title="Confirme a troca de e-mail"
    footerNote="Não pediu essa troca? Não clique no botão e avise quem administra o painel."
  >
    <BrandText>
      Pediram para trocar o e-mail da sua conta no Painel de Eventos CUPOLA de{' '}
      <span style={strong}>{oldEmail}</span> para{' '}
      <span style={strong}>{newEmail}</span>.
    </BrandText>
    <BrandButton href={confirmationUrl}>Confirmar novo e-mail</BrandButton>
    <BrandFallbackLink href={confirmationUrl} />
  </BrandLayout>
)

export default EmailChangeEmail
