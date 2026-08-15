# Validação dos modos de exportação PDF

## Contexto da correção
Foi ajustado o fluxo de exportação para que o modo **PDF completo** sempre force a renderização do **Dashboard Ativo** durante a impressão, mesmo quando a interface estiver posicionada na aba **Itens Entregues**. O objetivo foi garantir que o relatório detalhado sempre inclua todas as seções gerenciais e operacionais exigidas.

## Evidências técnicas
- Checagem executada: `pnpm check && pnpm test && pnpm build`
- Resultado: **19 testes Vitest aprovados**, checagem TypeScript aprovada e build de produção concluído com sucesso.
- Validação visual do cabeçalho: confirmada a presença dos botões **PDF Executivo** e **PDF Completo** no preview.

## Validação real via Chromium
Foram geradas duas amostras reais de impressão por automação via Chromium DevTools:

| Arquivo | Páginas | Formato | Evidência principal |
|---|---:|---|---|
| `open-order-control-dashboard-executive-validated.pdf` | 1 | A4 paisagem | Relatório executivo compacto em página única |
| `open-order-control-dashboard-detailed-validated.pdf` | 5 | A4 paisagem | Relatório detalhado com seções gerenciais e operacionais completas |

## Conteúdo confirmado no PDF detalhado
A extração textual e a revisão visual confirmaram a presença das seguintes seções no relatório completo:

1. `01 / VISÃO EXECUTIVA`
2. `01A / CENTRO DE COMANDO ESTRATÉGICO`
3. `01A / ALERTAS DE VARIAÇÃO`
4. `01B / CONSOLIDAÇÃO POR FILIAL`
5. `02 / TENDÊNCIA OPERACIONAL`
6. `03 / LEITURA GERENCIAL`
7. `04 / FILA DE AÇÃO`
8. `05 / INSTABILIDADE`
9. `06 / BASE OPERACIONAL`
10. `07 / MAPA DE ALTERAÇÕES`

## Conclusão
A correção foi validada com sucesso. O modo **PDF Executivo** continua compacto e focado em decisão, enquanto o modo **PDF Completo** agora imprime o dashboard detalhado integral, independentemente da aba ativa no momento da exportação.
