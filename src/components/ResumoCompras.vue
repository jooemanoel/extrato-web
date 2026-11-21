<script setup>
// Resumo por categoria (blocos com o total) e a lista de compras, filtrável pela
// categoria escolhida e por texto. Usado no início (mês) e na fatura.
import { computed, ref } from "vue";
import Icone from "./Icone.vue";
import DialogoCompra from "./DialogoCompra.vue";
import { grupoDaCompra, grupos, nomeDaCompra, nomeDoCartao } from "../composables/useDados.js";
import { dataCurta, dinheiro, normalizar } from "../formatar.js";

const props = defineProps({
  compras: { type: Array, required: true },
  mostrarCartao: { type: Boolean, default: false },
});
const emit = defineEmits(["alterada", "excluida"]);

const filtro = ref(null); // id do grupo, ou null = todas
const busca = ref("");
const aberta = ref(null);

const soma = (lista) => lista.reduce((s, c) => s + c.valor, 0);
const total = computed(() => soma(props.compras));

const blocos = computed(() => {
  const porGrupo = new Map();
  for (const c of props.compras) {
    const g = grupoDaCompra(c);
    if (!porGrupo.has(g)) porGrupo.set(g, []);
    porGrupo.get(g).push(c);
  }
  // Proporção do gasto do grupo no gasto total (estornos reduzem o gasto do grupo).
  const gastoTotal = Math.abs(Math.min(total.value, 0)) || 1;
  return grupos.value
    .filter((g) => porGrupo.has(g.id))
    .map((g) => {
      const lista = porGrupo.get(g.id);
      const valor = soma(lista);
      return { ...g, quantidade: lista.length, valor, proporcao: Math.min(1, Math.max(0, -valor / gastoTotal)) };
    });
});

const visiveis = computed(() => {
  const termo = normalizar(busca.value);
  return props.compras
    .filter((c) => !filtro.value || grupoDaCompra(c) === filtro.value)
    .filter(
      (c) =>
        !termo ||
        normalizar(nomeDaCompra(c)).includes(termo) ||
        c.estabelecimento.includes(termo) ||
        normalizar(c.loja?.nome).includes(termo)
    )
    .sort((a, b) => b.data.localeCompare(a.data) || a.valor - b.valor);
});

const totalVisivel = computed(() => soma(visiveis.value));
const tituloFiltro = computed(() => blocos.value.find((b) => b.id === filtro.value)?.nome ?? "Todas as compras");

function escolher(id) {
  filtro.value = filtro.value === id ? null : id;
}

function alterada(compra) {
  aberta.value = null;
  emit("alterada", compra);
}

function excluida(compra) {
  aberta.value = null;
  emit("excluida", compra);
}
</script>

<template>
  <div class="blocos">
    <button class="bloco bloco-total" :aria-pressed="filtro === null" @click="filtro = null">
      <span class="bloco-valor">{{ dinheiro(total) }}</span>
      <span class="bloco-nome">Total · {{ compras.length }}</span>
    </button>
    <button
      v-for="b in blocos"
      :key="b.id"
      class="bloco"
      :class="{ alerta: b.id === 'sem-loja' }"
      :aria-pressed="filtro === b.id"
      @click="escolher(b.id)"
    >
      <Icone :nome="b.icone" />
      <span class="bloco-valor">{{ dinheiro(b.valor) }}</span>
      <span class="bloco-nome">{{ b.nome }} · {{ b.quantidade }}</span>
      <span class="bloco-barra" :style="{ '--proporcao': b.proporcao }" aria-hidden="true"></span>
    </button>
  </div>

  <div class="cabecalho-lista">
    <h2 class="subtitulo">{{ tituloFiltro }}</h2>
    <span class="contagem">{{ dinheiro(totalVisivel) }}</span>
  </div>
  <label class="busca">
    <Icone nome="search" />
    <span class="oculto">Buscar compra</span>
    <input v-model="busca" type="search" placeholder="Buscar compra ou loja" />
  </label>

  <p v-if="!visiveis.length" class="vazio">Nenhuma compra {{ busca ? "encontrada" : "aqui" }}.</p>
  <ul v-else class="linhas">
    <li v-for="c in visiveis" :key="c.id" class="linha">
      <button class="linha-principal compra" @click="aberta = c">
        <span class="compra-data">{{ dataCurta(c.data) }}</span>
        <span class="compra-texto">
          <span class="reticencias compra-nome">{{ nomeDaCompra(c) }}</span>
          <span class="reticencias compra-sub">
            <template v-if="c.parcela">{{ c.parcela.numero }}/{{ c.parcela.total }} · </template>
            <template v-if="mostrarCartao">{{ nomeDoCartao(c.cartaoId) }} · </template>
            {{ c.descricao || c.loja ? c.nomeEstabelecimento : c.pendente ? "sem loja" : "avulsa" }}
          </span>
        </span>
        <span class="compra-valor" :class="{ credito: c.valor > 0 }">{{ dinheiro(c.valor) }}</span>
      </button>
    </li>
  </ul>

  <DialogoCompra :compra="aberta" @fechar="aberta = null" @alterada="alterada" @excluida="excluida" />
</template>
