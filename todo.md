# Projeto TODO - Controle e Comparação de Open Orders

- [x] Definir esquema do banco de dados (tabelas para uploads, itens de pedidos e histórico de previsões)
- [x] Criar migração SQL e aplicar no banco de dados
- [x] Implementar parser de Excel (xlsx) com suporte aos campos obrigatórios (Endereço, Customer PO, Shipment Priority, Data Criação, Item, Descrição, Quantidade, Scheduled Reserved, Unit Selling Price, Extended Price, Previsão, Long Text)
- [x] Implementar lógica de comparação semanal e contagem de alterações na previsão
- [x] Criar procedimentos tRPC para upload, listagem de itens, estatísticas do dashboard e histórico detalhado por item
- [x] Desenvolver interface Swiss Style (fundo branco, acentos vermelhos, grid rigoroso, linhas pretas finas)
- [x] Criar tela de Upload com feedback de progresso e estatísticas da importação
- [x] Criar Dashboard com indicadores principais (total de itens, alterados no último upload, sem fornecedor, mais alterados)
- [x] Criar Tabela Principal com busca e filtros por Item, Customer PO, Descrição e faixa de data
- [x] Criar Tela de Detalhes do Item com o histórico completo de previsões e datas de upload
- [x] Escrever e executar testes unitários (Vitest) para a lógica de comparação e rotas backend
- [x] Realizar validação final com a planilha de exemplo fornecida

- [x] Expandir listagem principal para destacar explicitamente o histórico de alterações por item (data do upload, previsão anterior e nova previsão)
- [x] Aprimorar modal de detalhamento com tabela cronológica de todas as mudanças ocorridas em cada upload semanal
- [x] Validar a exibição detalhada com testes unitários em Vitest

- [x] Implementar rota tRPC de indicadores gerenciais avançados (taxa de estabilidade, itens críticos por PO, volume financeiro sob risco de alteração)
- [x] Construir o Dashboard Gerencial no frontend com seções de Visão Executiva, Alertas de Risco, Ranking de Instabilidade e Ações Prioritárias
- [x] Garantir conformidade com o Swiss Style e testes unitários em Vitest

- [x] Implementar procedimento backend de limpeza de base (uploads, orderItems, predictionHistory)
- [x] Criar botão "Resetar importações" na interface com modal de confirmação de segurança
- [x] Testar limpeza completa e revalidação do dashboard e tabelas vazias

- [x] Adicionar suporte a filtro por filial solicitante (Endereço / Ship To) nas consultas do backend
- [x] Implementar listagem de filiais e consolidação de indicadores por filial no painel gerencial
- [x] Adicionar seletor de filial na interface para segmentar itens, alertas e histórico
- [x] Validar consolidação por filial com testes unitários e testes de integração

- [x] Adicionar à tabela principal a data do upload mais recente e um resumo explícito das alterações do item
- [x] Criar uma função de apresentação da linha do tempo com teste unitário verificável
- [x] Executar resetImports em cenário isolado de teste e validar dashboard e tabelas vazias
- [x] Validar valores consolidados por filial após uploads controlados (contagens, taxa de alteração e valor sob risco)
- [x] Revalidar o build e o preview após as correções finais

> Observação de histórico: os itens marcados anteriormente como concluídos foram refinados com as validações adicionais acima para cobrir os critérios de aceite com maior precisão.

---

## Critérios de aceite adicionais

A tabela principal deve mostrar o último upload associado ao item e um resumo das transições registradas. A consolidação por filial deve ser conferida com valores esperados em um cenário controlado. O reset deve ser exercitado em uma base de teste isolada, sem apagar os dados operacionais atuais, e o estado vazio resultante deve ser verificado.

- [x] Revisar e confirmar todos os critérios de aceite adicionais antes do próximo checkpoint

- [x] Medir o tempo atual do upload e localizar gargalos no parsing, comparação, histórico e gravação
- [x] Otimizar a importação com consultas e escritas em lote, preservando a comparação semanal
- [x] Evitar recarregamentos redundantes após o upload e melhorar o feedback de progresso
- [x] Validar desempenho, contagem de alterações, histórico e build após a otimização

- [x] Medir e registrar explicitamente o tempo da importação antes e depois da otimização com a mesma planilha de referência
- [x] Aprimorar o feedback de progresso com estados visíveis de leitura, processamento e atualização do painel

- [x] Corrigir comparativo para usar o último registro histórico por Item + Customer PO e preservar todos os uploads
- [x] Exibir no detalhe as alterações acumuladas entre uploads, sem limitar ao último arquivo
- [x] Testar sequência de três uploads com mudança de previsão em duas semanas diferentes

- [x] Implementar parâmetros de limite de dias para alerta no backend e nas rotas tRPC
- [x] Criar endpoint para retornar alertas de atraso e adiantamento acima do limite configurado
- [x] Construir o painel visual de alertas configuráveis com ajuste de limiar no dashboard
- [x] Validar alertas com testes unitários e testes de integração end-to-end

- [x] Calcular proporção de alertas críticos vs atenção e expor totais e percentuais na API tRPC de alertas
- [x] Criar endpoint e gráfico de tendência histórica de alertas críticos por upload semanal com filtro por filial
- [x] Executar pnpm check, pnpm test e pnpm build e validar sucesso de todos os testes
- [x] Validar gráfico de tendência histórica e proporção de severidade integrado ao dashboard gerencial
