<script setup>
// Barra superior: título e, com o usuário logado, os atalhos das telas principais.
import Icone from "./Icone.vue";
import { ocupado } from "../services/api.js";
import { rota, ir } from "../composables/useRota.js";
import { quantidadeSugestoes } from "../composables/useDados.js";

defineProps({
  titulo: { type: String, required: true },
  logado: { type: Boolean, default: false },
});
defineEmits(["sair"]);

const ATALHOS = [
  { tela: "inicio", caminho: "/", icone: "home", rotulo: "Início" },
  { tela: "faturas", caminho: "/faturas", icone: "receipt_long", rotulo: "Faturas" },
  { tela: "importar", caminho: "/importar", icone: "upload_file", rotulo: "Importar OFX" },
  { tela: "lojas", caminho: "/lojas", icone: "storefront", rotulo: "Lojas" },
];

const atual = (a) => rota.value.tela === a.tela || (a.tela === "faturas" && rota.value.tela === "fatura");
</script>

<template>
  <header class="barra">
    <h1 class="titulo reticencias">{{ titulo }}</h1>

    <span class="carregando" :class="{ visivel: ocupado }" role="status">
      <span v-if="ocupado" class="oculto">Carregando…</span>
    </span>

    <nav v-if="logado" class="acoes-barra" aria-label="Menu principal">
      <button
        v-for="a in ATALHOS"
        :key="a.tela"
        class="botao-icone"
        :title="a.rotulo"
        :aria-label="a.tela === 'lojas' && quantidadeSugestoes ? `${a.rotulo} (${quantidadeSugestoes} compras sem loja)` : a.rotulo"
        :aria-current="atual(a) ? 'page' : undefined"
        @click="ir(a.caminho)"
      >
        <Icone :nome="a.icone" />
        <span v-if="a.tela === 'lojas' && quantidadeSugestoes" class="selo" aria-hidden="true">
          {{ quantidadeSugestoes > 99 ? "99+" : quantidadeSugestoes }}
        </span>
      </button>
      <button class="botao-icone" title="Sair" aria-label="Sair" @click="$emit('sair')">
        <Icone nome="logout" />
      </button>
    </nav>
  </header>
</template>
