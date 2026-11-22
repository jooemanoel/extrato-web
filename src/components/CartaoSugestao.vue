<script setup>
// Uma sugestão de loja (compras sem loja agrupadas). O nome sugerido pode ser corrigido
// ("AMERICANAS F485BA" -> "AMERICANAS"; "CIA" -> "CIA DOS CALCADOS"): enquanto o padrão não
// for editado à mão, ele acompanha o nome, se o nome for o começo do estabelecimento.
// Antes de gravar, a prévia mostra o que o padrão reconhece.
import { computed, ref, watch } from "vue";
import Icone from "./Icone.vue";
import CampoPadrao from "./CampoPadrao.vue";
import PreviaPadroes from "./PreviaPadroes.vue";
import * as api from "../services/api.js";
import { categorias, categoriaPorId, lojas } from "../composables/useDados.js";
import { avisar, avisarErro } from "../composables/useAviso.js";
import { dinheiro, normalizar, plural } from "../formatar.js";

const props = defineProps({
  sugestao: { type: Object, required: true },
  aberta: { type: Boolean, default: false },
});
const emit = defineEmits(["abrir", "resolvida"]);

const s = props.sugestao;
const modo = ref(s.tipo); // "nova" | "adicionar"
const nome = ref(s.nome);
const categoria = ref(s.categoria ?? "");
const lojaId = ref(s.lojaId ?? "");
const padrao = ref({ ...s.padrao });
const padraoEditado = ref(false);
const resultado = ref(null);
const conferindo = ref(false);
const enviando = ref(false);

const loja = computed(() => lojas.value.find((l) => l.id === lojaId.value) ?? null);
const lojasOrdenadas = computed(() => [...lojas.value].sort((a, b) => a.nome.localeCompare(b.nome)));
const minimo = computed(() => (padrao.value.tipo === "prefixo" ? 2 : 3));
const padraoValido = computed(() => padrao.value.texto.length >= minimo.value);

// O padrão acompanha o nome: se todo estabelecimento do grupo começa com o nome, o padrão é o
// nome (reconhece qualquer filial); senão (o nome é um apelido), fica o sugerido.
watch(nome, (n) => {
  if (padraoEditado.value || modo.value !== "nova") return;
  const texto = normalizar(n);
  padrao.value =
    texto.length >= 2 && s.estabelecimentos.every((e) => e.startsWith(texto))
      ? { tipo: "prefixo", texto }
      : { ...s.padrao };
});

function editarPadrao(novo) {
  padraoEditado.value = true;
  padrao.value = novo;
}

const padroesFinais = computed(() =>
  modo.value === "adicionar" && loja.value ? [...loja.value.padroes, padrao.value] : [padrao.value]
);

// Prévia automática só no cartão aberto (cada uma relê compras no servidor). Espera a pessoa
// parar de digitar, e um padrão já conferido neste cartão não é pedido de novo.
let espera;
const previas = new Map(); // chave do pedido -> resultado
const pedidoDaPrevia = () => ({
  padroes: padroesFinais.value,
  lojaId: modo.value === "adicionar" ? lojaId.value : undefined,
});
watch(
  () => [props.aberta, modo.value, lojaId.value, padrao.value.tipo, padrao.value.texto],
  () => {
    clearTimeout(espera);
    if (!props.aberta || !padraoValido.value || (modo.value === "adicionar" && !loja.value)) return;
    const guardada = previas.get(JSON.stringify(pedidoDaPrevia()));
    if (guardada) return (resultado.value = guardada);
    espera = setTimeout(conferir, 800);
  },
  { immediate: true }
);

async function conferir() {
  const pedido = pedidoDaPrevia();
  conferindo.value = true;
  try {
    resultado.value = await api.previaLoja(pedido);
    previas.set(JSON.stringify(pedido), resultado.value);
  } catch (erro) {
    resultado.value = null;
    avisarErro(erro);
  } finally {
    conferindo.value = false;
  }
}

function adicionarA(id) {
  modo.value = "adicionar";
  lojaId.value = id;
  padraoEditado.value = true; // o nome deixa de mandar no padrão
}

function voltarParaNova() {
  modo.value = "nova";
  lojaId.value = "";
}

async function aplicar() {
  if (!padraoValido.value) return avisar(`O padrão precisa de pelo menos ${minimo.value} letras ou números.`, "erro");
  enviando.value = true;
  try {
    let resposta;
    if (modo.value === "nova") {
      resposta = await api.criarLoja({ nome: nome.value, categoria: categoria.value || null, padroes: [padrao.value] });
      avisar(`Loja ${resposta.loja.nome} criada: ${plural(resposta.comprasAtualizadas, "compra reconhecida", "compras reconhecidas")}.`);
    } else {
      resposta = await api.alterarLoja(lojaId.value, { padroes: padroesFinais.value });
      avisar(`Padrão acrescentado a ${resposta.loja.nome}: ${plural(resposta.comprasAtualizadas, "compra atualizada", "compras atualizadas")}.`);
    }
    emit("resolvida", { loja: resposta.loja, pendencias: resposta.pendencias });
  } catch (erro) {
    // Já existe loja com esse nome: oferece acrescentar o padrão a ela.
    if (erro.status === 409 && erro.detalhes?.lojaId) {
      adicionarA(erro.detalhes.lojaId);
      avisar(erro.message, "erro", 6000);
    } else {
      avisarErro(erro);
    }
  } finally {
    enviando.value = false;
  }
}

async function ignorarTodos() {
  const n = s.estabelecimentos.length;
  const texto =
    `Ignorar ${n === 1 ? "este estabelecimento" : `estes ${n} estabelecimentos`}? ` +
    "As compras ficam como avulsas (sem loja) e saem das sugestões, para todos os usuários.";
  if (!confirm(texto)) return;
  enviando.value = true;
  try {
    const pendencias = { resolvidas: [], novas: 0 };
    for (const e of s.estabelecimentos) {
      const resposta = await api.ignorar(e);
      pendencias.resolvidas.push(...resposta.pendencias.resolvidas);
      pendencias.novas += resposta.pendencias.novas;
    }
    avisar("Ignorado. Dá para desfazer na aba Ignoradas.");
    emit("resolvida", { loja: null, pendencias });
  } catch (erro) {
    avisarErro(erro);
  } finally {
    enviando.value = false;
  }
}
</script>

<template>
  <li class="sugestao" :class="{ aberta }">
    <button class="linha-principal" :aria-expanded="aberta" @click="emit('abrir')">
      <span class="compra-texto">
        <span class="reticencias compra-nome">{{ s.nome }}</span>
        <span class="reticencias compra-sub">
          {{ s.tipo === "adicionar" ? `acrescentar à loja ${s.nome}` : s.exemplos.join(" · ") }}
        </span>
      </span>
      <span class="contagem">{{ s.quantidade }}</span>
      <span class="compra-valor">{{ dinheiro(s.total) }}</span>
    </button>

    <form v-if="aberta" class="formulario sugestao-editor" @submit.prevent="aplicar">
      <p class="compra-sub">
        {{ plural(s.quantidade, "compra", "compras") }}: {{ s.exemplos.join(" · ") }}
      </p>

      <template v-if="modo === 'nova'">
        <label class="campo">
          <span>Nome da loja</span>
          <input v-model="nome" type="text" maxlength="60" required />
        </label>
        <label class="campo">
          <span>Categoria</span>
          <select v-model="categoria">
            <option value="">Sem categoria</option>
            <option v-for="c in categorias" :key="c.id" :value="c.id">{{ c.nome }}</option>
          </select>
        </label>
        <div v-if="s.parecidas.length" class="parecidas">
          <span class="compra-sub">Lojas parecidas:</span>
          <button v-for="p in s.parecidas" :key="p.id" type="button" class="chip-botao" @click="adicionarA(p.id)">
            <Icone nome="merge" /> {{ p.nome }}
          </button>
        </div>
        <label class="campo">
          <span>Ou acrescentar a uma loja que já existe</span>
          <select :value="''" @change="$event.target.value && adicionarA($event.target.value)">
            <option value="">Escolher loja…</option>
            <option v-for="l in lojasOrdenadas" :key="l.id" :value="l.id">{{ l.nome }}</option>
          </select>
        </label>
      </template>

      <template v-else>
        <label class="campo">
          <span>Acrescentar à loja</span>
          <select v-model="lojaId" required>
            <option v-for="l in lojasOrdenadas" :key="l.id" :value="l.id">{{ l.nome }}</option>
          </select>
        </label>
        <p class="dica">
          Categoria: {{ categoriaPorId(loja?.categoria)?.nome ?? "sem categoria" }} (da loja).
          <button type="button" class="botao-texto" @click="voltarParaNova">Criar uma loja nova</button>
        </p>
      </template>

      <CampoPadrao :model-value="padrao" rotulo="Reconhecer compras cujo estabelecimento" @update:model-value="editarPadrao" />
      <p class="dica">
        Estabelecimento{{ s.estabelecimentos.length > 1 ? "s" : "" }}: {{ s.estabelecimentos.join(", ") }}
      </p>

      <PreviaPadroes :resultado="resultado" :carregando="conferindo" />

      <div class="acoes-dialogo">
        <button type="button" class="botao-secundario" :disabled="enviando" @click="ignorarTodos">
          <Icone nome="block" /> Ignorar
        </button>
        <button type="submit" class="botao-principal" :disabled="enviando || !padraoValido || !!resultado?.conflitos.length">
          {{ modo === "nova" ? "Criar loja" : "Acrescentar" }}
        </button>
      </div>
    </form>
  </li>
</template>
