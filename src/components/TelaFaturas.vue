<script setup>
// Faturas agrupadas por cartão, da mais recente para a mais antiga.
// Fatura fechada mostra se o total das compras confere com o total informado pelo banco.
import { computed } from "vue";
import Icone from "./Icone.vue";
import * as api from "../services/api.js";
import { faturas, nomeDoCartao, sincronizar } from "../composables/useDados.js";
import { caminhoFatura, ir } from "../composables/useRota.js";
import { avisar, avisarErro } from "../composables/useAviso.js";
import { competenciaCurta, dinheiro, plural } from "../formatar.js";

const porCartao = computed(() => {
  const grupos = new Map();
  for (const f of faturas.value ?? []) {
    if (!grupos.has(f.cartaoId)) grupos.set(f.cartaoId, []);
    grupos.get(f.cartaoId).push(f);
  }
  return [...grupos.entries()]
    .map(([cartaoId, lista]) => ({ cartaoId, nome: nomeDoCartao(cartaoId), faturas: lista }))
    .sort((a, b) => a.nome.localeCompare(b.nome));
});

const confere = (f) => (f.situacao === "fechada" && f.totalBanco != null ? f.totalBanco === f.totalCompras : null);

/** Precisa de internet. */
async function renomear(cartaoId) {
  const atual = nomeDoCartao(cartaoId);
  const nome = prompt("Nome do cartão:", atual)?.trim();
  if (!nome || nome === atual) return;
  try {
    await api.renomearCartao(cartaoId, nome);
    await sincronizar();
    avisar("Cartão renomeado.");
  } catch (erro) {
    avisarErro(erro);
  }
}
</script>

<template>
  <p v-if="faturas === null" class="vazio">Carregando faturas…</p>
  <section v-else-if="!faturas.length" class="cartao vazio">
    <button class="botao-redondo" aria-label="Importar OFX" @click="ir('/importar')">
      <Icone nome="upload_file" />
    </button>
    <p>Nenhuma fatura ainda. As faturas são criadas ao importar o arquivo OFX.</p>
  </section>

  <template v-else>
  <section v-for="grupo in porCartao" :key="grupo.cartaoId" class="grupo">
    <div class="cabecalho-lista">
      <h2 class="subtitulo reticencias">{{ grupo.nome }}</h2>
      <span class="numero-cartao">final {{ grupo.cartaoId.slice(-4) }}</span>
      <button class="botao-icone pequeno" :aria-label="`Renomear o cartão ${grupo.nome}`" title="Renomear cartão" @click="renomear(grupo.cartaoId)">
        <Icone nome="edit" />
      </button>
    </div>
    <ul class="linhas">
      <li v-for="f in grupo.faturas" :key="f.id" class="linha">
        <button class="linha-principal" @click="ir(caminhoFatura(f.id))">
          <span class="compra-texto">
            <span class="competencia">{{ competenciaCurta(f.competencia) }}</span>
            <span class="compra-sub">
              {{ plural(f.quantidade, "compra", "compras") }}
              <template v-if="f.pagamento"> · paga {{ dinheiro(-Math.abs(f.pagamento.valor)) }}</template>
            </span>
          </span>
          <span class="chip" :class="f.situacao">{{ f.situacao }}</span>
          <span
            v-if="confere(f) !== null"
            class="conferencia"
            :class="{ ok: confere(f) }"
            :title="confere(f) ? 'Confere com o total do banco' : `Banco: ${dinheiro(f.totalBanco)}`"
          >
            <Icone :nome="confere(f) ? 'check_circle' : 'warning'" />
            <span class="oculto">{{ confere(f) ? "confere com o banco" : "não confere com o banco" }}</span>
          </span>
          <span class="compra-valor">{{ dinheiro(f.totalCompras) }}</span>
        </button>
      </li>
    </ul>
  </section>
  </template>
</template>
