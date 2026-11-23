<script setup>
// Início: o mês (competência = mês de vencimento) com as faturas de todos os cartões
// somadas, o gasto por categoria e as compras.
import { computed } from "vue";
import Icone from "./Icone.vue";
import ResumoCompras from "./ResumoCompras.vue";
import { compras as todasAsCompras, faturas, nomeDoCartao, quantidadeSugestoes } from "../composables/useDados.js";
import { caminhoFatura, ir } from "../composables/useRota.js";
import { competenciaLonga, dinheiro, plural } from "../formatar.js";

const props = defineProps({ mes: { type: String, default: null } });

const competencias = computed(() => [...new Set((faturas.value ?? []).map((f) => f.competencia))].sort().reverse());
const mesAtual = computed(() => props.mes ?? competencias.value[0] ?? null);
const indice = computed(() => competencias.value.indexOf(mesAtual.value));
const anterior = computed(() => competencias.value[indice.value + 1] ?? null);
const seguinte = computed(() => (indice.value > 0 ? competencias.value[indice.value - 1] : null));

const doMes = computed(() => (faturas.value ?? []).filter((f) => f.competencia === mesAtual.value));

// As compras ficam no aparelho: trocar de mês não pede nada ao servidor.
const compras = computed(() => {
  const ids = new Set(doMes.value.map((f) => f.id));
  return todasAsCompras.value.filter((c) => ids.has(c.faturaId));
});
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

    <ResumoCompras :compras="compras" :mostrar-cartao="doMes.length > 1" />
  </template>
</template>
