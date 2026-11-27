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
import AvisoConexao from "./components/AvisoConexao.vue";
import { encerrarSessao, usuario } from "./composables/useSessao.js";
import { rota } from "./composables/useRota.js";
import { aEnviar, apagarDoAparelho, encerrar, iniciar } from "./composables/useDados.js";
import { plural } from "./formatar.js";
import { aviso } from "./composables/useAviso.js";

const tituloFatura = ref("");

const titulo = computed(() => {
  if (!usuario.value) return "Fatura";
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

// Ao entrar (ou abrir o app já logado), mostra o que o aparelho guardou e sincroniza.
// Se a sessão vence, os dados somem da tela mas continuam no aparelho (com as alterações
// ainda não enviadas): ao entrar de novo com o mesmo usuário, voltam.
watch(
  usuario,
  (atual, anterior) => {
    if (atual?.id === anterior?.id) return;
    encerrar();
    if (atual) iniciar(atual.id);
  },
  { immediate: true }
);

watch(titulo, (t) => (document.title = t === "Fatura" ? "Fatura" : `${t} · Fatura`), { immediate: true });

/** Sair apaga do aparelho os dados desta conta. */
async function sair() {
  const n = aEnviar.value;
  const texto = n
    ? `${plural(n, "alteração ainda não foi enviada", "alterações ainda não foram enviadas")} ao servidor ` +
      "e vai se perder. Sair mesmo assim?"
    : "Sair? As faturas guardadas neste aparelho são apagadas (voltam ao entrar de novo, com internet).";
  if (!confirm(texto)) return;
  const id = usuario.value.id;
  encerrarSessao();
  await apagarDoAparelho(id);
  location.hash = "";
}
</script>

<template>
  <BarraSuperior :titulo="titulo" :logado="!!usuario" @sair="sair" />

  <main class="conteudo">
    <AvisoConexao v-if="usuario" />
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
