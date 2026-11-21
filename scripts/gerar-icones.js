// Gera os ícones do PWA a partir do símbolo "receipt_long" do Material Symbols (Google).
// Fonte: https://fonts.google.com/icons?selected=Material+Symbols+Rounded:receipt_long:FILL@1
// Uso: npm run icones   (grava em public/, que o Vite copia para o build)
import { mkdirSync, writeFileSync } from "node:fs";
import sharp from "sharp";

// Mesma cor de destaque do estilo.css (azul do tema).
// Branco sobre #3a5ba9 tem contraste de 6,3:1 (WCAG AA exige 3:1 para ícones).
const COR_FUNDO = "#3a5ba9";
const COR_SIMBOLO = "#ffffff";

// Desenho original do símbolo (viewBox 0 -960 960 960).
const SIMBOLO =
  "M240-80q-50 0-85-35t-35-85v-80q0-17 11.5-28.5T160-320h80v-536q0-7 6-9.5t11 2.5l29 29q6 6 14 6t14-6l32-32q6-6 14-6t14 6l32 32q6 6 14 6t14-6l32-32q6-6 14-6t14 6l32 32q6 6 14 6t14-6l32-32q6-6 14-6t14 6l32 32q6 6 14 6t14-6l32-32q6-6 14-6t14 6l32 32q6 6 14 6t14-6l29-29q5-5 11-2.5t6 9.5v656q0 50-35 85t-85 35H240Zm480-80q17 0 28.5-11.5T760-200v-560H320v440h320q17 0 28.5 11.5T680-280v80q0 17 11.5 28.5T720-160ZM400-680h160q17 0 28.5 11.5T600-640q0 17-11.5 28.5T560-600H400q-17 0-28.5-11.5T360-640q0-17 11.5-28.5T400-680Zm0 120h160q17 0 28.5 11.5T600-520q0 17-11.5 28.5T560-480H400q-17 0-28.5-11.5T360-520q0-17 11.5-28.5T400-560Zm280-40q-17 0-28.5-11.5T640-640q0-17 11.5-28.5T680-680q17 0 28.5 11.5T720-640q0 17-11.5 28.5T680-600Zm0 120q-17 0-28.5-11.5T640-520q0-17 11.5-28.5T680-560q17 0 28.5 11.5T720-520q0 17-11.5 28.5T680-480Z";

/**
 * Monta o SVG do ícone: fundo colorido com o símbolo branco centralizado.
 * @param tamanho      lado do ícone em pixels
 * @param proporcao    fração do lado ocupada pelo símbolo
 * @param cantos       raio dos cantos (0 = quadrado, para ícones "maskable")
 */
function montarSvg(tamanho, proporcao, cantos) {
  const lado = tamanho * proporcao;
  const margem = (tamanho - lado) / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${tamanho}" height="${tamanho}" viewBox="0 0 ${tamanho} ${tamanho}">
  <rect width="${tamanho}" height="${tamanho}" rx="${cantos}" fill="${COR_FUNDO}"/>
  <svg x="${margem}" y="${margem}" width="${lado}" height="${lado}" viewBox="0 -960 960 960">
    <path d="${SIMBOLO}" fill="${COR_SIMBOLO}"/>
  </svg>
</svg>`;
}

async function gerarPng(arquivo, svg) {
  await sharp(Buffer.from(svg)).png().toFile(arquivo);
  console.log("gerado:", arquivo);
}

mkdirSync("public/icones", { recursive: true });

// Ícone da aba do navegador (vetorial, cantos arredondados).
writeFileSync("public/favicon.svg", montarSvg(64, 0.72, 14));
console.log("gerado: public/favicon.svg");

// Ícones "any": usados como estão, com cantos arredondados.
await gerarPng("public/icones/icone-192.png", montarSvg(192, 0.62, 42));
await gerarPng("public/icones/icone-512.png", montarSvg(512, 0.62, 112));

// Ícone "maskable": o Android recorta no formato do aparelho (círculo, gota...).
// Fundo sem cantos e símbolo menor, dentro da "zona segura" central de 80%.
await gerarPng("public/icones/icone-maskable-512.png", montarSvg(512, 0.5, 0));

// iOS: o próprio sistema arredonda os cantos; tamanho padrão de 180 px.
await gerarPng("public/icones/apple-touch-icon.png", montarSvg(180, 0.58, 0));
