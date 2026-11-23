<script setup>
// Faixa no alto do conteúdo quando os dados na tela podem estar desatualizados:
// sem internet (com a hora da última sincronização), alterações ainda não enviadas
// ou falha ao sincronizar. Com tudo em dia, não aparece.
import { computed } from "vue";
import Icone from "./Icone.vue";
import { aEnviar, conexao, erroDeSincronizacao, faturas, sincronizadoEm, sincronizar } from "../composables/useDados.js";
import { dataHora, plural } from "../formatar.js";

const pendentes = computed(() =>
  aEnviar.value ? plural(aEnviar.value, "alteração ainda não enviada", "alterações ainda não enviadas") : ""
);

const texto = computed(() => {
  if (conexao.value === "offline") {
    if (faturas.value === null) return "Sem internet. Os dados aparecem depois da primeira sincronização.";
    const quando = sincronizadoEm.value ? ` · dados de ${dataHora(sincronizadoEm.value)}` : "";
    return `Sem internet${quando}${pendentes.value ? ` · ${pendentes.value}` : ""}.`;
  }
  if (conexao.value === "erro") return `Não foi possível sincronizar: ${erroDeSincronizacao.value}`;
  return "";
});
</script>

<template>
  <p v-if="texto" class="aviso-conexao" role="status">
    <Icone v-if="conexao === 'erro'" nome="warning" />
    <span>{{ texto }}</span>
    <button v-if="conexao === 'erro'" class="botao-texto" @click="sincronizar">Tentar de novo</button>
  </p>
</template>
