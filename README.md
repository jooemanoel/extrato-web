# Extrato (Vue)

Gastos do cartão de crédito por categoria, a partir das faturas OFX do Banco do Brasil.
O app pode ser instalado como PWA.

É a reescrita em Vue 3 + Vite do extrato-estatico (Angular), no mesmo padrão do
[listas-web](../listas-web). Os dados ficam na [extrato-api](../extrato-api), a única que fala
com o Firestore. As regras de negócio estão em
[extrato-api/docs/MODELAGEM.md](../extrato-api/docs/MODELAGEM.md).

## Comandos

```bash
npm install
npm run dev       # desenvolvimento (API em http://localhost:3000)
npm run build     # gera docs/ (publicado pelo GitHub Pages)
npm run icones    # gera favicon e ícones do PWA (public/icones) a partir do símbolo "receipt_long"
```

Para testar sem credenciais do Firebase, rode a API com dados em memória:
`cd ../extrato-api && npm run dev:memoria`.

O endereço da API publicada fica em [.env.production](.env.production)
(`https://extrato-api-nine.vercel.app`). A API precisa aceitar a origem do app em
`CORS_ORIGINS` (`https://jooemanoel.github.io`).

## Telas

A barra superior tem cinco botões: Início, Faturas, Importar, Lojas e Sair.
O botão de Lojas mostra quantas compras estão sem loja.

| Rota | Tela |
|---|---|
| `#/` e `#/mes/AAAA-MM` | **Início**: o mês (de vencimento) com as faturas dos cartões somadas, o gasto por categoria e as compras |
| `#/faturas` | Faturas por cartão, com a situação (aberta ou fechada) e a conferência com o total do banco; também renomeia o cartão |
| `#/fatura/<id>` | Uma fatura: totais, pagamento, histórico de importações, compras, compra digitada à mão, exclusão |
| `#/importar` | Escolhe um ou mais `.ofx`, mostra a prévia de cada um e importa depois da confirmação |
| `#/lojas` | Sugestões de loja: compras sem loja, agrupadas |
| `#/lojas/todas` | Lojas cadastradas: nome, categoria, padrões, junção e exclusão |
| `#/lojas/ignoradas` | Estabelecimentos ignorados, que podem ser desfeitos |

### Resumo por categoria

- Os blocos mostram o total e a quantidade de compras de cada categoria. A barra no pé de
  cada bloco mostra a parte daquela categoria no gasto total.
- Tocar num bloco filtra a lista de compras.
- Além das categorias, há três grupos: **sem loja**, **sem categoria** (a loja não tem
  categoria) e **avulsas** (estabelecimento ignorado).
- Valores com `+` em verde são estornos.

### Compra

Tocar numa compra abre o diálogo dela, onde dá para:

- dar um **apelido**;
- escolher a **loja à mão**, só para aquela compra. Voltar para "Automática" devolve a compra
  ao reconhecimento pelos padrões;
- **excluir** a compra. Uma compra que veio do OFX volta se o arquivo for importado de novo.

Data e valor só podem ser alterados em compras digitadas à mão.

### Importação

- O arquivo é lido como **windows-1252**, a codificação do OFX do BB, e o nome original vai
  junto. A API tira do nome o cartão e o mês.
- A prévia mostra:
  - compras novas e compras que já existiam;
  - compras movidas de outra fatura;
  - compras ausentes, que podem ser removidas por uma opção;
  - o pagamento da fatura anterior;
  - se o total confere com o do banco.
- Dá para corrigir o mês da fatura antes de importar. A dica avisa quando o mês foi deduzido
  pelas datas das compras, como na fatura aberta.
- Importar de novo a fatura aberta só traz as compras novas.

### Lojas

1. **Escolher a sugestão.** Abra uma sugestão. O nome sugerido pode ser corrigido:
   - "AMERICANAS F485BA" vira "AMERICANAS";
   - "CIA" vira "CIA DOS CALCADOS".
2. **Conferir o padrão.** Enquanto você não editar o padrão à mão, ele acompanha o nome, desde
   que todo estabelecimento do grupo comece com o nome. Se o nome for um apelido, fica o
   padrão sugerido.
3. **Ver a prévia.** Ela mostra quantas compras suas o padrão reconhece e quais estão hoje em
   outra loja. Se o padrão já for de outra loja, o botão fica desabilitado.
4. **Escolher o que fazer:**
   - **criar a loja**;
   - **acrescentar o padrão a uma loja existente**, pelas "lojas parecidas" ou pela lista. Se
     você tentar criar uma loja com um nome que já existe, o app muda para essa opção;
   - **ignorar** compras avulsas.

As lojas e os ignorados valem para **todos os usuários**. A prévia mostra só as suas compras.

## Privacidade

- Os dados financeiros não ficam no aparelho. No `localStorage` só ficam o token e o nome do
  usuário.
- O service worker guarda apenas os arquivos do app, nunca as respostas da API. Sem internet,
  o app abre, mas não mostra faturas.
- Na lista de ignorados, quem ignorou aparece como "você" ou "outro usuário", sem o nome.
- A página tem `noindex`.
- O `.gitignore` bloqueia `*.ofx`.

## Estrutura

| Arquivo | Conteúdo |
|---|---|
| `public/sw.js` | Service worker: cache dos arquivos do app |
| `public/manifest.webmanifest` | Manifesto do PWA |
| `scripts/gerar-icones.js` | Gera os ícones a partir do Material Symbol `receipt_long` |
| `src/services/api.js` | Chamadas à extrato-api, com o token no cabeçalho |
| `src/composables/useSessao.js` | Token JWT e nome do usuário |
| `src/composables/useDados.js` | Categorias, cartões, faturas, lojas e sugestões compartilhados entre as telas |
| `src/composables/useRota.js` | Navegação por hash |
| `src/composables/useAviso.js` | Mensagens no rodapé |
| `src/formatar.js` | Dinheiro em centavos, meses, datas e normalização igual à da API |
| `src/components/Tela*.vue` | Telas |
| `src/components/ResumoCompras.vue` | Blocos por categoria e lista de compras |
| `src/components/Dialogo*.vue` | Compra e loja |
| `src/components/CartaoSugestao.vue` | Uma sugestão de loja, com o editor |
| `src/components/CampoPadrao.vue` | Padrão "começa com" ou "contém" |
| `src/components/PreviaPadroes.vue` | O que os padrões reconhecem |
| `src/components/Icone.vue` | Material Symbols embutidos como SVG |
| `src/estilo.css` | Todo o CSS, com tema claro e escuro do sistema |

## O que mudou em relação à versão Angular

| | Angular | Vue |
|---|---|---|
| Fatura | criada à mão, com datas de abertura e fechamento | criada pelo OFX: uma por cartão e mês |
| Importação | escolhia a fatura antes; "apagar compras anteriores" marcado por padrão | prévia e confirmação; só acrescenta; vários arquivos de uma vez |
| Categoria | escolhida em cada compra | vem da loja |
| Lojas | cadastradas à mão no banco | sugestões com nome editável, padrões e prévia |
| Visão geral | uma fatura por vez | o mês, com os cartões somados, e cada fatura separada |
| JS + CSS | Angular + Material + Bootstrap + moment | cerca de 51 KB + 4 KB (gzip) |
| Fontes externas | Roboto + Material Icons | nenhuma (fontes do sistema, ícones SVG) |
