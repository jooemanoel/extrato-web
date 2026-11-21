<script setup>
// Resultado de POST /lojas/previa: o que os padrões reconheceriam nas suas compras.
import { computed } from "vue";
import Icone from "./Icone.vue";
import { plural } from "../formatar.js";

const props = defineProps({
  resultado: { type: Object, default: null },
  carregando: { type: Boolean, default: false },
});

const total = (lista) => lista.reduce((s, g) => s + g.quantidade, 0);
const capturadas = computed(() => (props.resultado ? total(props.resultado.captura) : 0));
const perdidas = computed(() => (props.resultado ? total(props.resultado.perdidas) : 0));
</script>

<template>
  <div v-if="carregando || resultado" class="previa" aria-live="polite">
    <p v-if="carregando" class="dica">Conferindo o que o padrão reconhece…</p>
    <template v-else>
      <p v-for="c in resultado.conflitos" :key="c.padrao.tipo + c.padrao.texto" class="conferencia" role="alert">
        <Icone nome="warning" /> O padrão "{{ c.padrao.texto }}" já é da loja {{ c.loja.nome }}.
      </p>

      <p class="previa-titulo">
        Reconhece {{ plural(capturadas, "compra sua", "compras suas") }}
        <template v-if="resultado.tomadasDeOutrasLojas">
          — {{ resultado.tomadasDeOutrasLojas }} hoje {{ resultado.tomadasDeOutrasLojas === 1 ? "está" : "estão" }} em outra loja
        </template>
      </p>
      <ul v-if="resultado.captura.length" class="previa-lista">
        <li v-for="g in resultado.captura" :key="g.estabelecimento + (g.lojaAtual?.id ?? '')" :class="{ alerta: g.lojaAtual }">
          <span class="reticencias">{{ g.nomeEstabelecimento }}</span>
          <span v-if="g.lojaAtual" class="compra-sub">hoje em {{ g.lojaAtual.nome }}</span>
          <span class="contagem">{{ g.quantidade }}</span>
        </li>
      </ul>

      <template v-if="perdidas">
        <p class="previa-titulo alerta">Deixa de reconhecer {{ plural(perdidas, "compra", "compras") }}</p>
        <ul class="previa-lista">
          <li v-for="g in resultado.perdidas" :key="g.estabelecimento">
            <span class="reticencias">{{ g.nomeEstabelecimento }}</span>
            <span class="contagem">{{ g.quantidade }}</span>
          </li>
        </ul>
      </template>
      <p class="dica">A prévia mostra só as suas compras; as lojas valem para todos os usuários.</p>
    </template>
  </div>
</template>
