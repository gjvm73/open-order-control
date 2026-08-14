# Desempenho da importação

## Metodologia

Foi usada a planilha de referência `RelatóriodeOpenOrder-DMMC-15-05-25.xlsx`, com **6.406 linhas**. Para manter as medições equivalentes e não conflitar com os dados operacionais, foram criadas duas séries de chaves temporárias independentes: `BFB-*` para a implementação anterior e `AFT-*` para a implementação otimizada. Cada série foi importada uma única vez, usando o mesmo parser e os mesmos campos da planilha.

## Resultado

| Implementação | Linhas | Tempo | Observação |
|---|---:|---:|---|
| Antes da otimização | 6.406 | 228.829 ms (3 min 48,8 s) | Processamento linha a linha, com consultas e gravações repetidas |
| Depois da otimização | 6.406 | 2.521 ms (2,5 s) | Busca única, upsert em lotes de até 500 linhas e histórico em lotes |

A redução observada foi de aproximadamente **98,9%**, ou cerca de **90,8 vezes mais rápido** no cenário controlado.

## Alterações aplicadas

A importação passou a buscar os itens existentes em uma consulta agrupada, usar chave única por `Item + Customer PO`, executar upserts em lotes e inserir o histórico em lotes. A interface também deixou de aguardar cinco recarregamentos completos antes de liberar o botão e passou a atualizar as consultas em segundo plano. O leitor do navegador usa `readAsDataURL`, eliminando a concatenação byte a byte que degradava arquivos maiores.

## Validação

A suíte Vitest passou com **7 testes**, a checagem TypeScript passou e o build de produção foi concluído. A validação da planilha completa também processou 6.406 linhas em aproximadamente 2,9 segundos na versão otimizada.
