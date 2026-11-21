// Dados compartilhados entre as telas: categorias, cartões, faturas, lojas e a contagem de
// sugestões. Ficam só na memória: dados financeiros não são guardados no aparelho.
import { computed, ref } from "vue";
import * as api from "../services/api.js";
import { avisarErro } from "./useAviso.js";

export const categorias = ref([]); // [{ id, nome, icone }]
export const cartoes = ref([]);
export const faturas = ref(null); // null = ainda não carregadas
export const lojas = ref([]);
export const sugestoes = ref(null);

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
  sugestoes.value ? sugestoes.value.reduce((s, g) => s + g.quantidade, 0) : 0
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

/** Depois de entrar: tudo de uma vez. */
export async function carregarTudo() {
  await Promise.all([
    categorias.value.length ? null : tentar(api.buscarCategorias(), (v) => (categorias.value = v)),
    recarregarCartoes(),
    recarregarFaturas(),
    recarregarLojas(),
    recarregarSugestoes(),
  ]);
}

/** Depois de importar: o que pode ter mudado. */
export const aposImportar = () => Promise.all([recarregarCartoes(), recarregarFaturas(), recarregarSugestoes()]);

/** Ao sair: nada do usuário anterior fica na memória. */
export function descarregar() {
  cartoes.value = [];
  faturas.value = null;
  lojas.value = [];
  sugestoes.value = null;
}
