<script setup>
// Lojas, em três abas: sugestões (compras sem loja agrupadas), lojas cadastradas e
// estabelecimentos ignorados. As lojas são compartilhadas entre todos os usuários.
import { computed, ref, watch } from "vue";
import Icone from "./Icone.vue";
import CartaoSugestao from "./CartaoSugestao.vue";
import DialogoLoja from "./DialogoLoja.vue";
import * as api from "../services/api.js";
import {
  aplicarPendencias,
  categoriaPorId,
  lojas,
  quantidadeSugestoes,
  recarregarSugestoes,
  sincronizar,
  sugestoes,
} from "../composables/useDados.js";
import { substituir } from "../composables/useRota.js";
import { usuario } from "../composables/useSessao.js";
import { avisar, avisarErro } from "../composables/useAviso.js";
import { dataHora, normalizar, plural } from "../formatar.js";

const props = defineProps({ aba: { type: String, default: "sugestoes" } });

const ABAS = [
  { id: "sugestoes", rotulo: "Sugestões", caminho: "/lojas" },
  { id: "todas", rotulo: "Lojas", caminho: "/lojas/todas" },
  { id: "ignoradas", rotulo: "Ignoradas", caminho: "/lojas/ignoradas" },
];

// Ao abrir a tela, atualiza: outro usuário pode ter mexido nas lojas.
// Lojas e compras vêm pela sincronização; as sugestões, só da API (precisam de internet).
sincronizar();
recarregarSugestoes();

// ---------- sugestões ----------
const aberta = ref(null);
const chaveDe = (s) => `${s.tipo}:${s.lojaId ?? ""}:${s.padrao.tipo}:${s.padrao.texto}`;
// Uma resolvida some da lista; abre a seguinte para seguir no mesmo ritmo.
// A resposta da API diz quais compras saíram das pendentes: a lista é acertada aqui, sem
// reler as sugestões (cada leitura passa por todas as compras sem loja). A loja nova e as
// compras reconhecidas chegam ao aparelho pela sincronização.
async function resolvida(s, { pendencias }) {
  const lista = sugestoes.value ?? [];
  const proxima = lista[lista.findIndex((x) => chaveDe(x) === chaveDe(s)) + 1];
  await Promise.all([aplicarPendencias(pendencias), sincronizar()]);
  aberta.value = proxima && sugestoes.value?.some((x) => chaveDe(x) === chaveDe(proxima)) ? chaveDe(proxima) : null;
}

// ---------- lojas ----------
const busca = ref("");
const editando = ref(null);
const lojasVisiveis = computed(() => {
  const termo = normalizar(busca.value);
  return [...lojas.value]
    .filter((l) => !termo || l.nomeNormalizado?.includes(termo) || normalizar(l.nome).includes(termo) || l.padroes.some((p) => p.texto.includes(termo)))
    .sort((a, b) => a.nome.localeCompare(b.nome));
});

async function lojaAlterada(resposta) {
  editando.value = null;
  await Promise.all([sincronizar(), aplicarPendencias(resposta?.pendencias)]);
}

// ---------- ignoradas ----------
const ignorados = ref(null);
async function carregarIgnorados() {
  try {
    ignorados.value = (await api.buscarIgnorados()).sort((a, b) => a.estabelecimento.localeCompare(b.estabelecimento));
  } catch (erro) {
    avisarErro(erro);
  }
}
watch(
  () => props.aba,
  (aba) => aba === "ignoradas" && carregarIgnorados(),
  { immediate: true }
);

async function desfazer(i) {
  try {
    const resposta = await api.desfazerIgnorado(i.estabelecimento);
    avisar(`${i.estabelecimento} voltou: ${plural(resposta.comprasAtualizadas, "compra atualizada", "compras atualizadas")}.`);
    await Promise.all([carregarIgnorados(), aplicarPendencias(resposta.pendencias), sincronizar()]);
  } catch (erro) {
    avisarErro(erro);
  }
}
</script>

<template>
  <nav class="abas" aria-label="Seções de lojas">
    <button
      v-for="a in ABAS"
      :key="a.id"
      class="aba"
      :aria-current="aba === a.id ? 'page' : undefined"
      @click="substituir(a.caminho)"
    >
      {{ a.rotulo }}
      <span v-if="a.id === 'sugestoes' && quantidadeSugestoes" class="contagem">{{ quantidadeSugestoes }}</span>
      <span v-if="a.id === 'todas' && lojas.length" class="contagem">{{ lojas.length }}</span>
    </button>
  </nav>

  <!-- Sugestões -->
  <template v-if="aba === 'sugestoes'">
    <p v-if="sugestoes === null" class="vazio">Carregando sugestões…</p>
    <section v-else-if="!sugestoes.length" class="cartao vazio">
      <Icone nome="check_circle" class="icone-grande" />
      <p>Todas as suas compras têm loja (ou foram ignoradas).</p>
    </section>
    <template v-else>
      <p class="dica dica-topo">
        Compras sem loja, agrupadas. Corrija o nome se precisar (o padrão acompanha), confira a
        prévia e crie a loja. Compras avulsas podem ser ignoradas.
      </p>
      <ul class="linhas">
        <CartaoSugestao
          v-for="s in sugestoes"
          :key="chaveDe(s)"
          :sugestao="s"
          :aberta="aberta === chaveDe(s)"
          @abrir="aberta = aberta === chaveDe(s) ? null : chaveDe(s)"
          @resolvida="(resposta) => resolvida(s, resposta)"
        />
      </ul>
    </template>
  </template>

  <!-- Lojas cadastradas -->
  <template v-else-if="aba === 'todas'">
    <div class="barra-busca">
      <label class="busca">
        <Icone nome="search" />
        <span class="oculto">Buscar loja</span>
        <input v-model="busca" type="search" placeholder="Buscar loja ou padrão" />
      </label>
      <button class="botao-icone destaque" aria-label="Nova loja" title="Nova loja" @click="editando = {}">
        <Icone nome="add" />
      </button>
    </div>
    <p v-if="!lojasVisiveis.length" class="vazio">{{ busca ? "Nenhuma loja encontrada." : "Nenhuma loja cadastrada." }}</p>
    <ul v-else class="linhas">
      <li v-for="l in lojasVisiveis" :key="l.id" class="linha">
        <button class="linha-principal" @click="editando = l">
          <Icone :nome="categoriaPorId(l.categoria)?.icone ?? 'sell'" />
          <span class="compra-texto">
            <span class="reticencias compra-nome">{{ l.nome }}</span>
            <span class="reticencias compra-sub">
              {{ categoriaPorId(l.categoria)?.nome ?? "sem categoria" }} ·
              {{ l.padroes.map((p) => (p.tipo === "contem" ? `*${p.texto}*` : `${p.texto}*`)).join(", ") }}
            </span>
          </span>
          <Icone nome="chevron_right" />
        </button>
      </li>
    </ul>
    <p class="dica dica-topo">As lojas valem para todos os usuários do app.</p>
  </template>

  <!-- Ignoradas -->
  <template v-else>
    <p v-if="ignorados === null" class="vazio">Carregando…</p>
    <p v-else-if="!ignorados.length" class="vazio">Nenhum estabelecimento ignorado.</p>
    <template v-else>
      <p class="dica dica-topo">Compras destes estabelecimentos ficam sem loja e fora das sugestões.</p>
      <ul class="linhas">
        <li v-for="i in ignorados" :key="i.estabelecimento" class="linha">
          <span class="linha-principal estatica">
            <span class="compra-texto">
              <span class="reticencias compra-nome">{{ i.estabelecimento }}</span>
              <span class="compra-sub">{{ i.ignoradoPor === usuario?.id ? "por você" : "por outro usuário" }} em {{ dataHora(i.em) }}</span>
            </span>
          </span>
          <button class="botao-icone" :aria-label="`Desfazer: voltar a sugerir ${i.estabelecimento}`" title="Desfazer" @click="desfazer(i)">
            <Icone nome="undo" />
          </button>
        </li>
      </ul>
    </template>
  </template>

  <DialogoLoja :loja="editando" @fechar="editando = null" @alterada="lojaAlterada" />
</template>
