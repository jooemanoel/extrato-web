// Dados compartilhados entre as telas: categorias, cartões, faturas, lojas e a contagem de
// sugestões. Ficam só na memória: dados financeiros não são guardados no aparelho.
import { computed, ref } from "vue";
import * as api from "../services/api.js";
import { avisarErro } from "./useAviso.js";
import { normalizar } from "../formatar.js";

export const categorias = ref([]); // [{ id, nome, icone }]
export const cartoes = ref([]);
export const faturas = ref(null); // null = ainda não carregadas
export const lojas = ref([]);
// Sugestões: lidas só na tela de lojas (cada leitura passa por todas as compras sem loja).
// Fora dela basta a contagem, que custa quase nada.
export const sugestoes = ref(null); // null = não carregadas (ou velhas)
const contagemPendentes = ref(0);

// Grupos extras, além das categorias da API.
export const SEM_LOJA = { id: "sem-loja", nome: "SEM LOJA", icone: "help" };
export const SEM_CATEGORIA = { id: "sem-categoria", nome: "SEM CATEGORIA", icone: "sell" };
export const AVULSAS = { id: "avulsa", nome: "AVULSAS", icone: "block" };

const categoriasPorId = computed(() => new Map(categorias.value.map((c) => [c.id, c])));
export const categoriaPorId = (id) => categoriasPorId.value.get(id) ?? null;

/** Em que grupo a compra aparece no resumo por categoria. */
export function grupoDaCompra(compra) {
  if (compra.loja) return compra.categoria ? compra.categoria : SEM_CATEGORIA.id;
  return compra.ignorado ? AVULSAS.id : SEM_LOJA.id;
}

/** Todos os grupos possíveis, na ordem de exibição. */
export const grupos = computed(() => [...categorias.value, SEM_CATEGORIA, AVULSAS, SEM_LOJA]);

/** Nome exibido da compra: o apelido, senão a loja, senão o estabelecimento do OFX. */
export const nomeDaCompra = (c) => c.descricao || c.loja?.nome || c.nomeEstabelecimento;

const cartoesPorId = computed(() => new Map(cartoes.value.map((c) => [c.id, c])));
export const nomeDoCartao = (id) => cartoesPorId.value.get(id)?.nome ?? `Cartão ${id}`;

export const quantidadeSugestoes = computed(() =>
  sugestoes.value ? sugestoes.value.reduce((s, g) => s + g.quantidade, 0) : contagemPendentes.value
);

async function tentar(promessa, aplicar) {
  try {
    aplicar(await promessa);
  } catch (erro) {
    avisarErro(erro);
  }
}

export const recarregarCartoes = () => tentar(api.buscarCartoes(), (v) => (cartoes.value = v));
export const recarregarFaturas = () => tentar(api.buscarFaturas(), (v) => (faturas.value = v));
export const recarregarLojas = () => tentar(api.buscarLojas(), (v) => (lojas.value = v));
export const recarregarSugestoes = () => tentar(api.buscarSugestoes(), (v) => (sugestoes.value = v));

/**
 * Fora da tela de lojas, quando as compras sem loja podem ter mudado: relê só a contagem.
 * As sugestões já carregadas ficam velhas; a tela de lojas relê ao abrir.
 */
export function recarregarContagem() {
  sugestoes.value = null;
  return tentar(api.contarPendentes(), (v) => (contagemPendentes.value = v.quantidade));
}

/** Loja criada ou alterada: entra na lista sem reler todas. */
export function guardarLoja(loja) {
  const resto = lojas.value.filter((l) => l.id !== loja.id);
  lojas.value = [...resto, loja];
}

/**
 * Atualiza as sugestões com o que a API informou depois de uma mudança de loja ou de ignorados:
 *   { resolvidas: [{ estabelecimento, quantidade, total }], novas }
 * As compras resolvidas saem dos grupos. Se alguma compra voltou a ficar sem loja (novas), ou
 * um estabelecimento aparece em mais de um grupo, relê tudo: aí não dá para acertar localmente.
 */
export function aplicarPendencias(pendencias) {
  if (!pendencias || !sugestoes.value || pendencias.novas) return recarregarSugestoes();
  const resolvidas = new Map(pendencias.resolvidas.map((r) => [r.estabelecimento, r]));
  if (!resolvidas.size) return;

  const grupos = sugestoes.value.filter((g) => g.estabelecimentos.some((e) => resolvidas.has(e)));
  const vezes = new Map();
  for (const g of grupos) for (const e of g.estabelecimentos) vezes.set(e, (vezes.get(e) ?? 0) + 1);
  if ([...resolvidas.keys()].some((e) => (vezes.get(e) ?? 0) > 1)) return recarregarSugestoes();

  sugestoes.value = sugestoes.value.flatMap((g) => {
    const saem = g.estabelecimentos.filter((e) => resolvidas.has(e));
    if (!saem.length) return [g];
    const estabelecimentos = g.estabelecimentos.filter((e) => !resolvidas.has(e));
    const quantidade = g.quantidade - saem.reduce((s, e) => s + resolvidas.get(e).quantidade, 0);
    if (!estabelecimentos.length || quantidade <= 0) return [];
    const total = g.total - saem.reduce((s, e) => s + resolvidas.get(e).total, 0);
    // Exemplos são o nome como veio no OFX ("AMERICANAS F485BA" ~ "AMERICANASF485BA").
    const exemplos = g.exemplos.filter((x) => {
      const n = normalizar(x);
      return estabelecimentos.some((e) => n.startsWith(e) || e.startsWith(n));
    });
    return [{ ...g, estabelecimentos, quantidade, total, exemplos: exemplos.length ? exemplos : g.exemplos }];
  });
}

/** Depois de entrar: tudo de uma vez (das sugestões, só a contagem). */
export async function carregarTudo() {
  await Promise.all([
    categorias.value.length ? null : tentar(api.buscarCategorias(), (v) => (categorias.value = v)),
    recarregarCartoes(),
    recarregarFaturas(),
    recarregarLojas(),
    recarregarContagem(),
  ]);
}

/** Depois de importar: o que pode ter mudado. */
export const aposImportar = () => Promise.all([recarregarCartoes(), recarregarFaturas(), recarregarContagem()]);

/** Ao sair: nada do usuário anterior fica na memória. */
export function descarregar() {
  cartoes.value = [];
  faturas.value = null;
  lojas.value = [];
  sugestoes.value = null;
  contagemPendentes.value = 0;
}
