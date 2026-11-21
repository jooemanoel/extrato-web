<script setup>
// Componente raiz: escolhe a tela pela sessão e pela rota (#/...).
import { computed, ref, watch } from "vue";
import BarraSuperior from "./components/BarraSuperior.vue";
import TelaLogin from "./components/TelaLogin.vue";
import TelaInicio from "./components/TelaInicio.vue";
import TelaFaturas from "./components/TelaFaturas.vue";
import TelaFatura from "./components/TelaFatura.vue";
import TelaImportar from "./components/TelaImportar.vue";
import TelaLojas from "./components/TelaLojas.vue";
import { encerrarSessao, usuario } from "./composables/useSessao.js";
import { rota } from "./composables/useRota.js";
import { carregarTudo, descarregar } from "./composables/useDados.js";
import { aviso } from "./composables/useAviso.js";

const tituloFatura = ref("");

const titulo = computed(() => {
  if (!usuario.value) return "Extrato";
  switch (rota.value.tela) {
    case "faturas":
      return "Faturas";
    case "fatura":
      return tituloFatura.value || "Fatura";
    case "importar":
      return "Importar OFX";
    case "lojas":
      return "Lojas";
    default:
      return usuario.value.nome;
  }
});

// Ao entrar (ou abrir o app já logado), carrega o que as telas usam. Ao sair ou
// expirar a sessão, esquece tudo.
watch(
  usuario,
  (atual, anterior) => {
    if (atual?.id === anterior?.id) return;
    descarregar();
    if (atual) carregarTudo();
  },
  { immediate: true }
);

watch(titulo, (t) => (document.title = t === "Extrato" ? "Extrato" : `${t} · Extrato`), { immediate: true });

function sair() {
  encerrarSessao();
  location.hash = "";
}
</script>

<template>
  <BarraSuperior :titulo="titulo" :logado="!!usuario" @sair="sair" />

  <main class="conteudo">
    <TelaLogin v-if="!usuario" />
    <TelaFaturas v-else-if="rota.tela === 'faturas'" />
    <TelaFatura v-else-if="rota.tela === 'fatura'" :id="rota.id" :key="rota.id" @titulo="tituloFatura = $event" />
    <TelaImportar v-else-if="rota.tela === 'importar'" />
    <TelaLojas v-else-if="rota.tela === 'lojas'" :aba="rota.aba" />
    <TelaInicio v-else :mes="rota.mes" />
  </main>

  <Transition name="aviso">
    <p v-if="aviso" class="aviso" :class="aviso.tipo" role="status" aria-live="polite">{{ aviso.texto }}</p>
  </Transition>
</template>
