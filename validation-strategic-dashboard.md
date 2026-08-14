# Validação do dashboard gerencial estratégico

## Implementação

Foi inserido o bloco **01A / Centro de comando estratégico** entre a visão executiva e os alertas operacionais. O bloco usa exclusivamente dados atuais do banco: estabilidade, alterações, vencimentos, disponibilidade de fornecedor, prioridade e valor sob risco.

## Indicadores verificados

- Índice de risco executivo ponderado em escala de 0 a 100.
- Nível de risco: CONTROLADO, ATENÇÃO ou CRÍTICO.
- Decisão recomendada derivada da maior pressão atual.
- Taxas de alteração, vencimento, fornecedor e exposição financeira.
- Pressão por filial com score derivado de alterações, vencimentos, ausência de fornecedor e prioridade.

## Evidência de preview

A inspeção do preview mostrou a seção com o índice **ATENÇÃO · 35/100**, decisão recomendada **Atacar previsões vencidas**, taxas de contexto e filial ranqueada por pressão. A captura desktop apresentou os três painéis alinhados em uma faixa única, mantendo a hierarquia Swiss Style. A captura em viewport 375×812 empilhou os painéis verticalmente, preservando leitura, barras de progresso, textos e controles sem sobreposição ou corte estrutural.

## Validação técnica

`pnpm test`: 9 testes aprovados.

`pnpm check`: aprovado.

`pnpm build`: concluído com sucesso. O build emite apenas o aviso existente de chunk JavaScript acima de 500 kB.
