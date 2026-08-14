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

- [x] Otimizar importação com consultas e escritas em lote e feedback de progresso
- [x] Corrigir comparativo para usar o último registro histórico por Item + Customer PO e preservar histórico
- [x] Implementar alertas visuais com limiar configurável de dias
- [x] Adicionar gráfico de resumo de severidade e gráfico de tendência histórica de alertas críticos

- [x] Investigar por que o upsert e o comparativo de histórico não registram alterações entre múltiplos uploads
- [x] Ajustar a lógica de comparação no upload para consultar o último histórico gravado por chave exata
- [x] Garantir que `previousPrediction`, `predictionChangesCount` e o histórico sejam atualizados corretamente em cada novo arquivo
- [x] Criar teste de integração específico para múltiplos uploads com datas divergentes

- [x] Diagnosticar o erro atual que impede a importação de arquivos
- [x] Reproduzir a falha com a planilha real e identificar a etapa do parser que quebra
- [x] Corrigir o tratamento do formato de planilha sem regressão no histórico
- [x] Adicionar teste de importação para o formato que causou a falha
- [x] Validar novamente testes, build e preview após a correção
- [x] Validar o preview/browser após a correção de `orderCreationDate`, confirmando a importação bem-sucedida de uma planilha real e ausência de regressão visual ou funcional
- [x] Validar no browser o upload de uma planilha real após a correção de `orderCreationDate`, confirmando sucesso da importação e atualização dos dados na interface
- [x] Registrar evidências da validação funcional pós-correção, incluindo upload e consulta do histórico sem erro

- [x] Inspecionar rotas tRPC para verificar se `uploadExcel` exige autenticação restrita
- [x] Ajustar o procedimento de upload para público ou garantir que usuário padrão seja injetado quando não houver sessão ativa
- [x] Realizar upload real da planilha no preview sem exigir login e confirmar sucesso na interface
- [x] Executar testes, build e salvar checkpoint final
- [x] Validar no browser, após upload real, tabela principal, filtro de filial e atualização dos alertas sem erro
- [x] Abrir o histórico de um item após o upload real e confirmar que o modal/consulta carrega corretamente
- [x] Registrar as evidências ampliadas de UI e histórico no relatório de validação

- [x] Tornar a rota tRPC `resetImports` pública ou acessível sem restrição de admin
- [x] Exibir o botão "Resetar importações" de forma permanente no cabeçalho do Home.tsx
- [x] Validar no browser a exibição do botão e a execução correta da limpeza da base
- [x] Executar testes, build e salvar checkpoint final

- [x] Corrigir a comparação de `Ship To` para ignorar espaços nas consultas de itens, indicadores e alertas
- [x] Adicionar teste de integração para filial com espaços extras no valor importado
- [x] Revalidar filtro por filial e histórico no browser após a correção

- [x] Inspecionar a implementação do modal de histórico em `client/src/pages/Home.tsx`
- [x] Refatorar a estilização, alinhamento e estrutura do modal para seguir o Estilo Suíço (Swiss Style)
- [x] Validar visualmente o modal corrigido via captura de tela no preview
- [x] Validar visualmente o modal de histórico no preview em desktop e largura menor, confirmando alinhamento, largura, overflow e legibilidade da tabela
- [x] Validar o modal de histórico com evidência verificável no preview em desktop, registrando screenshot/inspeção visual que confirme largura, alinhamento, overflow e legibilidade da tabela
- [x] Repetir a validação do modal em viewport menor (reduzida de forma explícita) para comprovar comportamento responsivo e ausência de desalinhamento/corte de conteúdo
