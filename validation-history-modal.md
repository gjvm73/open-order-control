# Validação visual do modal de histórico

## Desktop / preview (14/08/2026)

Após abrir **Ver histórico**, o modal passou a ocupar uma largura ampla e consistente dentro da viewport, com margens laterais equilibradas e cabeçalho alinhado ao conteúdo. O título permanece em uma única linha quando há espaço, o botão de fechamento fica no canto superior direito e os quatro cartões de resumo usam uma grade regular.

A tabela de linha do tempo está contida em um único quadro com bordas, cabeçalho preto fixo, colunas alinhadas e separadores verticais. O conteúdo excedente é tratado por rolagem horizontal dentro da tabela, sem estourar o modal ou deslocar o fundo da página. A captura final mostrou a linha `shipto-trim.xlsx` com arquivo, data, previsão, status e diferença legíveis.

## Validação técnica

O `DialogContent` foi ajustado para usar `w-[calc(100vw-2rem)]`, `sm:w-[calc(100vw-3rem)]`, `max-w-none` e `sm:max-w-4xl`, sobrescrevendo o limite padrão `sm:max-w-lg` do componente base. O modal também usa `max-h-[90vh]` e `overflow-y-auto`; a tabela usa `overflow-x-auto` e largura mínima controlada.

Testes Vitest: 9 aprovados. TypeScript: aprovado. Build de produção: aprovado.

## Evidência adicional de responsividade

A captura do modal no preview foi realizada na viewport de 896×768 e mostrou largura ampla, margens equilibradas, cartões alinhados, cabeçalho de tabela íntegro e rolagem horizontal confinada ao quadro da tabela. Uma captura adicional do dashboard em viewport explícita de 375×812 confirmou que o layout geral se reorganiza em coluna, mantém o botão de reset dentro da área visível e não apresenta overflow horizontal na página. Como o modal usa a mesma largura calculada por viewport (`calc(100vw - 2rem)` / `calc(100vw - 3rem)`) e `max-h-[90vh]`, sua contenção responsiva segue o mesmo limite de tela.
