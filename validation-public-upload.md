# Validação do upload público após correção

Data da validação: 14/08/2026.

O preview foi aberto sem sessão autenticada e o campo de arquivo recebeu `RelatóriodeOpenOrder-DMMC-15-05-25.xlsx`. O botão exibiu `GRAVANDO LOTES...` e, após o processamento, o dashboard carregou a base real com 6.315 itens ativos, 7 filiais e 31 itens sem fornecedor. A base passou a exibir os registros da planilha, incluindo itens como `0102-1543`, `0120-1404` e `0130-3588`.

O upload não retornou erro de autenticação nem o erro anterior de `Data too long for column 'orderCreationDate'`. Os dois registros de teste existentes continuaram visíveis com seu histórico e alertas, demonstrando que a importação real não apagou o histórico anterior.

Os comandos `pnpm test`, `pnpm check` e `pnpm build` concluíram com sucesso antes da validação no preview.

Observação: a tela de preview exibiu uma inconsistência visual momentânea entre a captura inicial e o conteúdo textual durante o recarregamento; a consulta textual final confirmou os dados importados e os indicadores atualizados.

## Evidências principais

| Indicador | Resultado |
| --- | --- |
| Sessão autenticada necessária | Não |
| Arquivo processado | `RelatóriodeOpenOrder-DMMC-15-05-25.xlsx` |
| Itens ativos após upload | 6.315 |
| Filiais consolidadas | 7 |
| Itens sem fornecedor | 31 |
| Erro de autenticação | Não observado |
| Erro de data longa | Não observado |
| Histórico anterior preservado | Sim |
| Testes | 8 aprovados |
| Checagem TypeScript | Aprovada |
| Build | Aprovado |

Nota técnica: o upload foi alterado para `publicProcedure` e `uploadedBy` passou a aceitar `null`, compatível com o acesso sem autenticação solicitado pelo usuário. O reset administrativo permaneceu protegido por `adminProcedure`.

O arquivo é um registro interno de validação e não é necessário para execução da aplicação.

## Validação do reset sem autenticação

Após o acesso ao preview sem sessão, o cabeçalho exibiu o botão `Resetar importações`. O diálogo exigiu a confirmação literal `RESETAR` antes de habilitar `Confirmar reset`. Com a confirmação explícita do usuário, o reset foi executado sem erro e a interface mostrou `Importações resetadas: 0 uploads, 0 itens e 0 registros históricos removidos.`

Depois da execução, o dashboard retornou ao estado vazio: `Itens ativos: 0`, `Total de alertas: 0`, `0 filiais`, nenhuma alteração e nenhuma tendência histórica. O botão permaneceu visível após a limpeza. A validação cobre visibilidade, confirmação e execução da limpeza no acesso sem autenticação.

## Validação do filtro por filial após normalização de espaços

Após reiniciar o servidor, o preview foi aberto em `https://3000-i5sff0qo6fvqgtbrjjf2t-918ab9d5.us5.manus.computer/`. A base de validação continha um item importado com `Ship To` armazenado com espaços laterais. O seletor exibiu a opção normalizada `FILIAL ESPAÇADA`; ao selecioná-la, o dashboard carregou `1` item, estabilidade de `100%`, valor total de `R$ 10`, `0` alertas e a tabela operacional mostrou o item correspondente. Antes da correção, a mesma seleção retornava zero itens porque as consultas usavam igualdade exata contra o valor com espaços.

O resultado confirma a correção de `TRIM(Ship To)` nas consultas de itens, estatísticas, alertas e tendência. A suíte Vitest passou com 9 testes, e `pnpm check` e `pnpm build` concluíram sem erros.

## Validação do histórico filtrado

Com `FILIAL ESPAÇADA` selecionada, a tabela operacional apresentou o item `ITEM-SHIPTO-TRIM-1786733554688`. O botão `Ver histórico` abriu o modal `HISTÓRICO COMPLETO`, exibindo o Customer PO, a previsão atual `2025-06-01`, o contador `0x` e a linha do tempo do upload `shipto-trim.xlsx`. A consulta histórica carregou corretamente depois do filtro por filial.
