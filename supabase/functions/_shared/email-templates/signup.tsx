/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'
import {
  BrandButton,
  BrandFallbackLink,
  BrandLayout,
  BrandText,
  strong,
} from '../email-brand.tsx'

interface SignupEmailProps {
  siteName: string
  siteUrl: string
  recipient: string
  confirmationUrl: string
}

export const SignupEmail = ({ recipient, confirmationUrl }: SignupEmailProps) => (
  <BrandLayout
    preview="Confirme seu e-mail para liberar o acesso ao Painel de Eventos CUPOLA."
    title="Confirme seu e-mail"
  >
    <BrandText>
      Falta só confirmar que <span style={strong}>{recipient}</span> é o seu
      e-mail para liberar o acesso ao Painel de Eventos CUPOLA.
    </BrandText>
    <BrandButton href={confirmationUrl}>Confirmar e-mail</BrandButton>
    <BrandFallbackLink href={confirmationUrl} />
  </BrandLayout>
)

export default SignupEmail
