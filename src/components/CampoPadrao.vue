<script setup>
// Um padrão de loja: "começa com" (prefixo) ou "contém", sobre o nome do estabelecimento
// normalizado (só A-Z e 0-9: "Cia dos Calçados" vira "CIADOSCALCADOS").
import { normalizar } from "../formatar.js";

const padrao = defineModel({ type: Object, required: true });
defineProps({ rotulo: { type: String, default: "Padrão" } });

function texto(evento) {
  padrao.value = { ...padrao.value, texto: normalizar(evento.target.value) };
}
</script>

<template>
  <div class="campo">
    <span>{{ rotulo }}</span>
    <span class="campo-padrao">
      <select
        :value="padrao.tipo"
        aria-label="Tipo do padrão"
        @change="padrao = { ...padrao, tipo: $event.target.value }"
      >
        <option value="prefixo">começa com</option>
        <option value="contem">contém</option>
      </select>
      <input
        type="text"
        :value="padrao.texto"
        maxlength="40"
        autocapitalize="characters"
        spellcheck="false"
        aria-label="Texto do padrão"
        @change="texto"
      />
    </span>
  </div>
</template>
