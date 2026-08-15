# Materiais Atualizados — Open Order Control

## Público e posicionamento

Os materiais destinam-se à diretoria de uma grande empresa. A narrativa trata o Open Order Control como uma camada de governança operacional que converte uploads semanais de pedidos em aberto em visão de risco, fila priorizada, rastreabilidade e material de decisão.

## Apresentação Executiva — 12 slides

## Cover

**Open Order Control**

Gestão executiva de pedidos em aberto, previsões e riscos de entrega

Material para Diretoria | 2026

## Slide 1 — Da planilha ao controle de decisão

- Centraliza o acompanhamento semanal de pedidos em aberto em uma única base histórica.
- Compara cada novo upload contra o último estado conhecido do mesmo pedido, item e filial.
- Transforma mudanças de previsão em alertas, indicadores financeiros e decisões de reunião.

## Slide 2 — Ciclo operacional sob controle

- O administrador importa a planilha semanal e o sistema normaliza campos críticos.
- A chave de acompanhamento é **Filial solicitante + Item + Customer PO**.
- Cada comparação atualiza histórico, identifica alterações e marca como entregue o item ausente do upload mais recente.

## Slide 3 — Visão executiva em uma tela

- Indicadores: itens ativos, estabilidade do último ciclo, valor total, valor sob risco, vencidos, sem fornecedor e prioridade alta.
- Centro de comando converte dados em sinais de decisão e foco de atuação da semana.
- Filtros por filial propagam a leitura para indicadores, alertas, tendências, fila, base operacional e exportações.

## Slide 4 — Índice de Risco Executivo

- Síntese de instabilidade, vencimento, disponibilidade de fornecedor, prioridade e exposição financeira.
- Fórmula exibida na aplicação: **min(100, 35% × instabilidade + 25% × vencimento + 20% × sem fornecedor + 10% × prioridade + 10% × exposição financeira)**.
- Permite comparar a intensidade do risco e concentrar a discussão da diretoria em exceções reais.

## Slide 5 — Alertas, tendência e pressão por filial

- Alertas visualizam desvios de previsão acima do limiar configurável em dias.
- Distribuição separa itens críticos e de atenção; tendência mostra evolução dos críticos por upload semanal.
- Mapa de filiais mostra pressão operacional, vencimentos, itens sem fornecedor e valor em risco.

## Slide 6 — Fila de Ação: o que deve entrar na reunião

- Seleciona apenas itens que demandam ação imediata e ordena por score.
- Score combina alterações de previsão, ausência de fornecedor, vencimento e prioridade alta.
- O balão “Como o score é calculado?” documenta fórmula, pontos, faixas e regra de desempate diretamente na tela.

## Slide 7 — Pesos configuráveis com governança

- Área **Configurações de Priorização**, restrita a administradores, permite ajustar pesos sem alterar código.
- Quatro critérios configuráveis: alteração de previsão, sem fornecedor, previsão vencida e prioridade alta.
- A simulação mostra o efeito da configuração; salvar recalcula a fila e restaurar padrão reverte os pesos para a política inicial.

## Slide 8 — Base operacional e rastreabilidade total

- A Base Operacional permite busca por filial, item, PO, previsão e texto livre.
- Cada item revela previsão atual, previsão anterior, upload, quantidade de alterações e resumo de todas as mudanças.
- O histórico cronológico mostra cada upload, a transição anterior/atual e o impacto em dias.

## Slide 9 — Itens entregues e exceções encerradas

- Item que existia no upload anterior e desaparece no novo arquivo é tratado como entregue.
- A aba dedicada preserva dados de origem, data de entrega identificada e histórico completo.
- A separação entre ativos e entregues reduz ruído na carteira e mantém evidência operacional.

## Slide 10 — Compartilhamento executivo e auditoria

- Relatório PDF oferece modo Executivo compacto e modo Completo com todas as tabelas e análises.
- Excel profissional reúne Resumo Executivo, Base Operacional e Histórico de Alterações, incluindo todas as datas de mudança.
- A exportação seletiva permite gerar somente os itens que sofreram alteração de previsão.

## Slide 11 — Segurança e rotina de gestão

- Login administrativo protege upload, reset da base e configuração dos pesos.
- Dark mode melhora uso em sala de reunião; filtros e relatórios preservam o contexto de análise.
- Rotina recomendada: importar, validar alertas, revisar fila, conduzir reunião e distribuir relatório.

## Slide 12 — Agenda de decisão da diretoria

- Começar pelo Índice de Risco e pela variação do último ciclo.
- Direcionar responsáveis para itens críticos, filiais sob pressão e exposição financeira.
- Registrar decisões e acompanhar a mudança de status no upload subsequente.

## Manual Word — capítulos e roteiros

| Capítulo | Objetivo | Evidência visual / roteiro |
| --- | --- | --- |
| 1. Visão geral | Apresentar o propósito, limites e resultados da aplicação. | Tela completa do dashboard. |
| 2. Acesso e permissões | Explicar acesso comum e funções de administrador. | Cabeçalho com controles administrativos. |
| 3. Navegação | Descrever abas, filtros, modo noturno e menu de relatórios. | Tela superior do dashboard. |
| 4. Importação semanal | Ensinar upload, validação e processamento do arquivo. | Roteiro: selecionar arquivo, confirmar resultado e revisar indicadores. |
| 5. Visão executiva | Interpretar cartões, centro de comando e Índice de Risco. | Tela completa e descrição da fórmula. |
| 6. Alertas e tendência | Configurar limiar, analisar severidade e comparar uploads. | Roteiro de triagem por alerta. |
| 7. Filiais | Usar a normalização e os filtros de filial. | Roteiro de investigação da pressão por filial. |
| 8. Fila de Ação | Ler score, faixas e motivos da priorização. | Roteiro para preparação da reunião. |
| 9. Configurações de Priorização | Ajustar, simular, salvar e restaurar pesos. | Passo a passo de governança dos pesos. |
| 10. Base operacional | Pesquisar, filtrar, abrir histórico e interpretar datas. | Tela da base operacional. |
| 11. Itens entregues | Consultar itens que deixaram de constar no upload. | Roteiro de reconciliação de carteira. |
| 12. Relatórios | Gerar PDF executivo, PDF completo, Excel total e Excel alterados. | Tela de relatórios/exportações. |
| 13. Administração | Login, upload, reset e proteção das ações sensíveis. | Checklist de segurança. |
| 14. Rotina semanal | Formalizar sequência operacional e agenda de decisão. | Checklist operacional de 15 minutos. |
| 15. FAQ e glossário | Esclarecer conceitos, erros comuns e termos. | Matriz de dúvidas frequentes. |
