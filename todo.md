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
