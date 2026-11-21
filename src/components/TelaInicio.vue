<script setup>
// Início: o mês (competência = mês de vencimento) com as faturas de todos os cartões
// somadas, o gasto por categoria e as compras.
import { computed, ref, watch } from "vue";
import Icone from "./Icone.vue";
import ResumoCompras from "./ResumoCompras.vue";
import * as api from "../services/api.js";
import { faturas, nomeDoCartao, quantidadeSugestoes, recarregarFaturas } from "../composables/useDados.js";
import { caminhoFatura, ir } from "../composables/useRota.js";
import { avisarErro } from "../composables/useAviso.js";
import { competenciaLonga, dinheiro, plural } from "../formatar.js";

const props = defineProps({ mes: { type: String, default: null } });

const competencias = computed(() => [...new Set((faturas.value ?? []).map((f) => f.competencia))].sort().reverse());
const mesAtual = computed(() => props.mes ?? competencias.value[0] ?? null);
const indice = computed(() => competencias.value.indexOf(mesAtual.value));
const anterior = computed(() => competencias.value[indice.value + 1] ?? null);
const seguinte = computed(() => (indice.value > 0 ? competencias.value[indice.value - 1] : null));

const doMes = computed(() => (faturas.value ?? []).filter((f) => f.competencia === mesAtual.value));
const compras = ref(null);

// Recarrega quando muda o mês ou quando alguma fatura do mês foi atualizada (importação).
const versao = computed(() => doMes.value.map((f) => `${f.id}@${f.atualizadoEm}`).join("|"));
let pedido = 0;
watch(
  versao,
  async () => {
    const meu = ++pedido;
    if (!doMes.value.length) return (compras.value = []);
    compras.value = null;
    try {
      const respostas = await Promise.all(doMes.value.map((f) => api.buscarFatura(f.id)));
      if (meu === pedido) compras.value = respostas.flatMap((r) => r.compras);
    } catch (erro) {
      avisarErro(erro);
    }
  },
  { immediate: true }
);

function alterada(compra) {
  compras.value = compras.value.map((c) => (c.id === compra.id ? compra : c));
  if (compra.origem === "manual") recarregarFaturas(); // valor pode ter mudado o total
}

function excluida(compra) {
  compras.value = compras.value.filter((c) => c.id !== compra.id);
  recarregarFaturas();
}
</script>

<template>
  <p v-if="faturas === null" class="vazio">Carregando faturas…</p>

  <section v-else-if="!faturas.length" class="cartao vazio">
    <button class="botao-redondo" aria-label="Importar OFX" @click="ir('/importar')">
      <Icone nome="upload_file" />
    </button>
    <p>
      Nenhuma fatura ainda. Baixe o OFX da fatura do cartão no site do banco (pelo computador)
      e importe pelo botão acima ou pelo ícone <Icone nome="upload_file" class="icone-texto" /> na barra.
    </p>
  </section>

  <template v-else>
    <nav class="navegacao-mes" aria-label="Mês">
      <button class="botao-icone" :disabled="!anterior" aria-label="Mês anterior" @click="ir(`/mes/${anterior}`)">
        <Icone nome="chevron_left" />
      </button>
      <h2 class="mes">{{ competenciaLonga(mesAtual) }}</h2>
      <button class="botao-icone" :disabled="!seguinte" aria-label="Mês seguinte" @click="ir(`/mes/${seguinte}`)">
        <Icone nome="chevron_right" />
      </button>
    </nav>

    <ul class="linhas faturas-do-mes">
      <li v-for="f in doMes" :key="f.id" class="linha">
        <button class="linha-principal" @click="ir(caminhoFatura(f.id))">
          <Icone nome="credit_card" />
          <span class="compra-texto">
            <span class="reticencias">{{ nomeDoCartao(f.cartaoId) }}</span>
            <span class="compra-sub">{{ plural(f.quantidade, "compra", "compras") }} · fatura {{ f.situacao }}</span>
          </span>
          <span class="compra-valor">{{ dinheiro(f.totalCompras) }}</span>
          <Icone nome="chevron_right" />
        </button>
      </li>
    </ul>

    <button v-if="quantidadeSugestoes" class="cartao aviso-lojas" @click="ir('/lojas')">
      <Icone nome="storefront" />
      <span>
        {{ plural(quantidadeSugestoes, "compra está", "compras estão") }} sem loja (e sem categoria).
        <strong>Ver sugestões</strong>
      </span>
    </button>

    <p v-if="compras === null" class="vazio">Carregando compras…</p>
    <ResumoCompras v-else :compras="compras" :mostrar-cartao="doMes.length > 1" @alterada="alterada" @excluida="excluida" />
  </template>
</template>
