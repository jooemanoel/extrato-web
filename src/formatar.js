// Formatação para exibir. Valores chegam da API em centavos, com o sinal do OFX:
// negativo = gasto, positivo = estorno/crédito. Na tela, gasto aparece sem sinal
// e crédito com "+".

const reais = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

/** -1234 -> "R$ 12,34"; 1234 -> "+ R$ 12,34" */
export function dinheiro(centavos) {
  if (centavos == null) return "—";
  const texto = reais.format(Math.abs(centavos) / 100);
  return centavos > 0 ? `+ ${texto}` : texto;
}

/** Valor absoluto, sem sinal (para totais de gasto). */
export const dinheiroAbsoluto = (centavos) => reais.format(Math.abs(centavos ?? 0) / 100);

/** "12,34" / "12.34" / "1.234,56" -> 1234 centavos (ou null se inválido). */
export function lerDinheiro(texto) {
  let t = String(texto ?? "").trim().replace(/^R\$\s*/i, "").replace(/\s/g, "");
  if (!t) return null;
  if (t.includes(",")) t = t.replace(/\./g, "").replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(t)) return null;
  return Math.round(Number(t) * 100);
}

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const MESES_LONGOS = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

/** "2026-11" -> "nov/2026" */
export function competenciaCurta(competencia) {
  const [ano, mes] = String(competencia).split("-").map(Number);
  return MESES[mes - 1] ? `${MESES[mes - 1]}/${ano}` : competencia;
}

/** "2026-11" -> "Novembro de 2026" */
export function competenciaLonga(competencia) {
  const [ano, mes] = String(competencia).split("-").map(Number);
  const nome = MESES_LONGOS[mes - 1];
  return nome ? `${nome[0].toUpperCase()}${nome.slice(1)} de ${ano}` : competencia;
}

/** "2026-11-06" -> "06/11"; com ano: "06/11/2026" */
export function dataCurta(data, { comAno = false } = {}) {
  const [ano, mes, dia] = String(data ?? "").split("-");
  if (!dia) return "";
  return comAno ? `${dia}/${mes}/${ano}` : `${dia}/${mes}`;
}

/** ISO -> "21/11/2026 às 14:32" */
export function dataHora(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }).replace(", ", " às ");
}

/** Hoje no formato AAAA-MM-DD (fuso do aparelho). */
export function hoje() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Mesma normalização da API: maiúsculas, sem acentos, só A-Z e 0-9. */
export function normalizar(texto) {
  return String(texto ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

export const plural = (n, um, varios) => `${n} ${n === 1 ? um : varios}`;
