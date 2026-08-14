# Projeto TODO - Controle e Comparação de Open Orders

- [ ] Definir esquema do banco de dados (tabelas para uploads, itens de pedidos e histórico de previsões)
- [ ] Criar migração SQL e aplicar no banco de dados
- [ ] Implementar parser de Excel (xlsx) com suporte aos campos obrigatórios (Endereço, Customer PO, Shipment Priority, Data Criação, Item, Descrição, Quantidade, Scheduled Reserved, Unit Selling Price, Extended Price, Previsão, Long Text)
- [ ] Implementar lógica de comparação semanal e contagem de alterações na previsão
- [ ] Criar procedimentos tRPC para upload, listagem de itens, estatísticas do dashboard e histórico detalhado por item
- [ ] Desenvolver interface Swiss Style (fundo branco, acentos vermelhos, grid rigoroso, linhas pretas finas)
- [ ] Criar tela de Upload com feedback de progresso e estatísticas da importação
- [ ] Criar Dashboard com indicadores principais (total de itens, alterados no último upload, sem fornecedor, mais alterados)
- [ ] Criar Tabela Principal com busca e filtros por Item, Customer PO, Descrição e faixa de data
- [ ] Criar Tela de Detalhes do Item com o histórico completo de previsões e datas de upload
- [ ] Escrever e executar testes unitários (Vitest) para a lógica de comparação e rotas backend
- [ ] Realizar validação final com a planilha de exemplo fornecida
