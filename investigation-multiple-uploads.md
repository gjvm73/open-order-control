# Investigação — múltiplos uploads

A consulta da base em 14/08/2026 mostrou quatro registros em `uploads`, com arquivos `01.xlsx` e `02.xlsx` repetidos, mas apenas os uploads `01.xlsx` possuíam linhas em `prediction_history`. Os uploads `02.xlsx` tinham `totalRows = 74` e `changedRowsCount = 0`, porém não havia nenhum registro de histórico associado a seus IDs. Os itens continuavam vinculados ao upload anterior.

A causa observável é que o fluxo aceita e grava um upload mesmo quando nenhuma linha é convertida em `preparedRows`. Isso faz a interface informar que o arquivo foi importado, embora o conteúdo não tenha sido reconhecido para comparação. O parser atual depende de `sheet_to_json` começar diretamente na linha de cabeçalho e, portanto, não lida com planilhas que tenham título, filtros, linhas em branco ou cabeçalhos ligeiramente deslocados antes dos dados.

A correção deverá localizar automaticamente a linha real de cabeçalho, reconhecer os campos de item e previsão por normalização de nomes, rejeitar uploads sem linhas válidas e cobrir o caso com teste de integração usando múltiplos uploads com cabeçalho deslocado e datas diferentes.
