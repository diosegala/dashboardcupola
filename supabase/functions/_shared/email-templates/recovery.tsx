/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'
import {
  BrandButton,
  BrandFallbackLink,
  BrandLayout,
  BrandNote,
  BrandText,
} from '../email-brand.tsx'

interface RecoveryEmailProps {
  siteName: string
  confirmationUrl: string
}

export const RecoveryEmail = ({ confirmationUrl }: RecoveryEmailProps) => (
  <BrandLayout
    preview="Crie uma nova senha para o Painel de Eventos CUPOLA."
    title="Vamos criar uma nova senha"
    footerNote="Não foi você? Pode ignorar este e-mail: sua senha atual continua valendo."
  >
    <BrandText>
      Recebemos um pedido para trocar a senha da sua conta no Painel de Eventos
      CUPOLA. É só clicar no botão abaixo:
    </BrandText>
    <BrandButton href={confirmationUrl}>Criar nova senha</BrandButton>
    <BrandNote>Este link vale por tempo limitado e funciona uma única vez.</BrandNote>
    <BrandFallbackLink href={confirmationUrl} />
  </BrandLayout>
)

export default RecoveryEmail
