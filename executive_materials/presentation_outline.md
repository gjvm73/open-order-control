# Open Order Control — Roteiro Executivo

## Cover
**Open Order Control**

Controle estratégico de pedidos em aberto, previsões de entrega e riscos operacionais

Material para Diretoria · Agosto de 2026

## Slide 1 — Da planilha semanal à decisão executiva

- Centraliza o acompanhamento de pedidos em aberto a partir de arquivos Excel semanais.
- Compara a carteira atual com o histórico acumulado e transforma mudanças de previsão em sinais de gestão.
- Combina visão operacional, financeira e de risco para orientar priorização e reuniões de acompanhamento.

## Slide 2 — Ciclo de controle semanal, com rastreabilidade

- Importação controlada de uma planilha semanal por usuário administrador.
- Chave de comparação: **Ship To + Item + Customer PO**; a combinação identifica o mesmo pedido ao longo dos ciclos.
- Cada importação preserva arquivo, data, previsões anterior e atual, variação e contagem acumulada de alterações.
- Itens ativos ausentes na importação mais recente são classificados automaticamente como entregues.

## Slide 3 — Painel executivo: onde a gestão deve atuar

- Visão superior apresenta itens ativos, estabilidade do último ciclo, valor total, valor sob risco, previsões vencidas, sem fornecedor e prioridades altas.
- Centro de Comando reúne índice de risco, decisão recomendada, pressão por filial e projeção financeira.
- Sinais para decisão e fila de ação organizam a resposta aos temas que exigem atuação imediata.

## Slide 4 — Índice de Risco Executivo: uma leitura única da exposição

- O índice varia de 0 a 100 e classifica a situação em **Controlado**, **Atenção** ou **Crítico**.
- Fórmula: min(100, 35% × instabilidade + 25% × vencimento + 20% × sem fornecedor + 10% × prioridade + 10% × exposição financeira).
- O indicador consolida variação da carteira, itens vencidos, indisponibilidade de fornecedor, prioridades altas e valor financeiro exposto.
- O objetivo é orientar foco de gestão; o detalhamento operacional permanece disponível nas tabelas e no histórico.

## Slide 5 — Alertas que distinguem atenção de criticidade

- O usuário define o limiar de alteração em dias; o padrão é 7 dias e a faixa permitida é de 1 a 3.650 dias.
- Itens acima do limiar entram em atenção; alterações iguais ou superiores ao dobro do limiar são classificadas como críticas.
- A tela exibe severidade, direção da mudança, previsões anterior e atual, variação em dias, filial e atalho para o histórico.
- Gráficos de proporção e tendência por upload mostram o comportamento dos alertas críticos ao longo do tempo.

## Slide 6 — Pressão por filial e normalização da rede

- As linhas são consolidadas por filial solicitante, a partir do endereço **Ship To**.
- Regras de normalização convertem endereços conhecidos em cidades de referência: Porto Alegre, Colombo, São José, Maringá e Chapecó.
- Por filial, a diretoria acompanha itens, alterações, taxa de mudança, vencidos, ausência de fornecedor e valor sob risco.
- O botão de filtro segmenta todo o dashboard; a limpeza restaura o conjunto completo.

## Slide 7 — Histórico do item e mapa de alterações

- A Base Operacional permite busca por item, PO, descrição, previsão e filial.
- Cada registro mostra previsão atual, anterior, último upload, última alteração, total de alterações e resumo do histórico.
- O botão **Ver histórico** abre a linha do tempo completa do pedido; o Mapa de Alterações evidencia cada transição registrada.
- A contagem acumulada evita que mudanças recorrentes se percam entre diferentes semanas.

## Slide 8 — Itens entregues: encerramento automático da carteira

- Se um item ativo existe em um upload e não aparece no seguinte, o sistema o marca como entregue.
- A aba **Itens Entregues** disponibiliza busca, filtros por filial, item e PO, com dados e histórico preservados.
- Essa regra separa pendências ativas de itens encerrados, evitando leitura inflada da carteira operacional.

## Slide 9 — Segurança, permissões e integridade

- O acesso administrativo local protege os comandos de maior impacto: upload semanal e reset de importações.
- Operações de consulta permanecem separadas das funções críticas de manutenção.
- O reset exige confirmação e remove histórico, itens e importações; deve ser reservado a reinicializações controladas da base.
- O modo noturno pode ser acionado no menu superior e é preservado no navegador.

## Slide 10 — Relatórios para reunião e análise operacional

- **PDF Executivo**: visão compacta para reunião e comunicação de liderança.
- **PDF Completo**: inclui todas as seções gerenciais, alertas, tendências, fila de ação, base operacional e mapa de alterações.
- **Excel da Base Operacional**: Resumo Executivo, Base Operacional e Histórico de Alterações, com filtros ativos, painéis congelados e datas no padrão brasileiro.
- **Exportar alterados** produz uma visão dedicada aos itens que tiveram mudança de previsão.

## Slide 11 — Rotina recomendada de governança

- Preparar a planilha semanal com colunas de identificação, valores e previsão de entrega.
- Administrador importa o arquivo, revisa o resumo de importação e valida o Índice de Risco, alertas e filiais pressionadas.
- Gestores investigam a fila de ação e o histórico dos itens mais críticos; a diretoria recebe PDF Executivo e Excel quando necessário.
- Após alinhamentos, manter a próxima importação como novo ciclo — nunca sobrescrever o histórico manualmente.

## Slide 12 — Controle contínuo, decisão mais rápida

**Uma única fonte para acompanhar estabilidade, exceções, exposição financeira e evolução dos pedidos em aberto.**

Próximo passo: institucionalizar a rotina semanal de upload, análise por filial e reunião de decisão.

---

**Fonte interna:** funcionalidades e telas validadas na aplicação Open Order Control, checkpoint `5f125413`, em 15/08/2026.
