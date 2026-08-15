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

- [x] Mapear o dashboard atual para estruturar a nova camada de avaliação estratégica e tomada de decisão
- [x] Criar blocos de inteligência gerencial (Índice de Risco Executivo, Prazos Críticos por Filial, Projeção de Impacto Financeiro e Plano de Ação Recomendado)
- [x] Implementar os novos painéis estratégicos e refinamentos visuais no Swiss Style
- [x] Validar cálculos, responsividade e estabilidade dos dados estratégicos
- [x] Salvar checkpoint e entregar o relatório do dashboard estratégico
- [x] Implementar a exportação do dashboard em PDF no frontend usando impressão otimizada ou jsPDF/html2canvas
- [x] Adicionar o botão "Exportar PDF" no cabeçalho ou na seção executiva
- [x] Validar a geração e o download do PDF no preview
- [x] Salvar checkpoint e entregar o recurso de exportação
- [x] Investigar getDashboardStats em server/db.ts para o cálculo de stabilityRate e changedItems
- [x] Ajustar a lógica de estabilidade para que 100% de alterações reflita corretamente 0% de estabilidade (ou vice-versa)
- [x] Validar a consistência matemática entre alteredItems, stableItems e stabilityRate
- [x] Definir a estabilidade exibida como o complemento da taxa de alterações do último upload
- [x] Expor latestChangeRate no contrato de estatísticas e diferenciar alteração do ciclo de alteração acumulada
- [x] Cobrir o cenário de 100% de alterações no último upload com estabilidade de 0%

- [x] Criar o documento Word conceitual e de métricas do Open Order Control usando python-docx
- [x] Validar a geração do arquivo .docx com formatação limpa e seções estruturadas
- [x] Entregar o documento Word ao usuário

- [x] Criar o arquivo de conteúdo markdown dos slides executivos (slide_content.md)
- [x] Gerar a apresentação de slides usando o modo html do Manus Slides
- [x] Exportar a apresentação para PDF/PPT e entregá-la ao usuário

- [x] Normalizar os cinco endereços solicitados para as cidades correspondentes nos filtros, itens, alertas, histórico e indicadores
- [x] Criar testes para o mapeamento de endereços e validar o filtro por filial
- [x] Executar testes, checagem TypeScript, build e validação visual após a correção
- [x] Salvar checkpoint da correção de normalização de filiais

- [x] Exibir o nome/descrição do item ao lado do código na seção 07 / Mapa de alterações
- [x] Validar testes, build e visualização da tabela após a alteração
- [x] Salvar checkpoint da melhoria do mapa de alterações

- [x] Investigar o comportamento do filtro por filial ao selecionar e limpar a opção
- [x] Corrigir a sincronização das consultas e indicadores ao limpar o filtro
- [x] Adicionar testes para seleção, limpeza e retorno ao conjunto completo de filiais
- [x] Validar no preview, executar testes e build
- [x] Salvar checkpoint da correção do filtro por filial

- [x] Modelar campo de status (ativo vs entregue) na tabela de itens ou controlar via flag/data de entrega
- [x] Atualizar o uploadExcel para marcar como entregues os itens que estavam ativos mas não vieram no novo upload
- [x] Criar procedimento tRPC para listar itens entregues com filtros e histórico
- [x] Adicionar aba/menu "Itens Entregues" no Dashboard com tabela completa, informações detalhadas e histórico
- [x] Adicionar teste de integração para o ciclo de entrega e validação de build
- [x] Salvar checkpoint final da nova funcionalidade de itens entregues

- [x] Adicionar botão de exportar Excel na seção 06 / Base operacional em Home.tsx
- [x] Implementar a geração e download do arquivo .xlsx usando SheetJS (xlsx) com todos os campos e filtros ativos
- [x] Validar a exportação com testes e build de produção
- [x] Salvar checkpoint da nova funcionalidade de exportação em Excel

- [x] Implementar procedimento de login ADM local (giovani.martino / M@rtino) com token/sessão segura
- [x] Restringir uploadExcel e resetImports no backend para exigir ctx.user?.role === 'admin'
- [x] Ajustar Home.tsx para exibir modal ou formulário de login ao clicar em 'Entrar' e ocultar botões de upload e reset para usuários não-adm
- [x] Escrever testes unitários e de integração para autenticação ADM e proteção das rotas sensíveis
- [x] Validar build de produção e salvar checkpoint final

- [x] Melhorar margens, escala e paginação da exportação PDF do dashboard
- [x] Ajustar blocos e tabelas para evitar fragmentação entre páginas
- [x] Validar visualmente a impressão e executar testes/build
- [x] Salvar checkpoint da melhoria da exportação PDF

- [x] Compactar a exportação PDF do dashboard para eliminar quebras excessivas e unificar o relatório em um formato executivo coeso

- [x] Implementar suporte a modo noturno com estado persistente no localStorage e botão de alternância no menu superior
- [x] Adaptar o design Swiss Style para o tema escuro (fundo preto/cinza escuro, textos claros, bordas contrastantes e acentos vermelhos)
- [x] Executar testes, checagem TypeScript, build e validar no preview
- [x] Salvar checkpoint da funcionalidade de modo noturno

- [x] Validar no preview o modo noturno ativado e garantir que diálogos, portales e modais herdem corretamente o tema escuro
- [x] Salvar checkpoint da funcionalidade de modo noturno completa

- [x] Implementar duas opções de exportação PDF: Relatório Executivo Compacto e Relatório Detalhado Completo com todas as tabelas, gráficos, alertas e bases operacionais
- [x] Ajustar as classes CSS para ocultar/exibir seções conforme o modo de impressão selecionado
- [x] Executar testes, checagem TypeScript, build e validar no preview
- [x] Salvar checkpoint da nova versatilidade de exportação PDF
