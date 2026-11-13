/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'
import {
  BrandCode,
  BrandLayout,
  BrandNote,
  BrandText,
} from '../email-brand.tsx'

interface ReauthenticationEmailProps {
  token: string
}

export const ReauthenticationEmail = ({ token }: ReauthenticationEmailProps) => (
  <BrandLayout
    preview="Seu código de verificação do Painel de Eventos CUPOLA."
    title="Seu código de verificação"
    footerNote="Não pediu este código? Pode ignorar este e-mail."
  >
    <BrandText>Use o código abaixo para confirmar que é você:</BrandText>
    <BrandCode code={token} />
    <BrandNote>O código vence em poucos minutos.</BrandNote>
  </BrandLayout>
)

export default ReauthenticationEmail
