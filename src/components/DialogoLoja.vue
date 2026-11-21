<script setup>
// Criar ou editar uma loja: nome, categoria e padrões, com prévia do que os padrões
// reconhecem. Também junta duas lojas e exclui. Lojas valem para todos os usuários.
import { computed, ref, watch } from "vue";
import Icone from "./Icone.vue";
import CampoPadrao from "./CampoPadrao.vue";
import PreviaPadroes from "./PreviaPadroes.vue";
import * as api from "../services/api.js";
import { categorias, lojas } from "../composables/useDados.js";
import { avisar, avisarErro } from "../composables/useAviso.js";
import { plural } from "../formatar.js";

// loja: objeto da loja, { } para criar uma nova, ou null (fechado)
const props = defineProps({ loja: { type: Object, default: null } });
const emit = defineEmits(["fechar", "alterada"]);

const dialogo = ref(null);
const nome = ref("");
const categoria = ref("");
const padroes = ref([]);
const resultado = ref(null);
const conferindo = ref(false);
const enviando = ref(false);
const origemId = ref("");

const nova = computed(() => !props.loja?.id);
const outras = computed(() =>
  lojas.value.filter((l) => l.id !== props.loja?.id).sort((a, b) => a.nome.localeCompare(b.nome))
);
const validos = computed(() => padroes.value.filter((p) => p.texto.length >= (p.tipo === "prefixo" ? 2 : 3)));
const padroesMudaram = computed(
  () => JSON.stringify(validos.value) !== JSON.stringify(props.loja?.padroes ?? [])
);

watch(
  () => props.loja,
  (l) => {
    if (!l) return dialogo.value?.close();
    nome.value = l.nome ?? "";
    categoria.value = l.categoria ?? "";
    padroes.value = (l.padroes ?? [{ tipo: "prefixo", texto: "" }]).map((p) => ({ ...p }));
    resultado.value = null;
    origemId.value = "";
    if (!dialogo.value.open) dialogo.value.showModal();
  },
  { flush: "post" }
);

let espera;
watch(
  () => JSON.stringify(validos.value),
  () => {
    clearTimeout(espera);
    resultado.value = null;
    if (!props.loja || !padroesMudaram.value || !validos.value.length) return;
    espera = setTimeout(conferir, 400);
  }
);

async function conferir() {
  conferindo.value = true;
  try {
    resultado.value = await api.previaLoja({ padroes: validos.value, lojaId: props.loja?.id });
  } catch (erro) {
    avisarErro(erro);
  } finally {
    conferindo.value = false;
  }
}

function trocarPadrao(i, p) {
  padroes.value = padroes.value.map((q, j) => (j === i ? p : q));
}

async function salvar() {
  if (!validos.value.length) return avisar("A loja precisa de ao menos um padrão.", "erro");
  enviando.value = true;
  try {
    let resposta;
    if (nova.value) {
      resposta = await api.criarLoja({ nome: nome.value, categoria: categoria.value || null, padroes: validos.value });
    } else {
      const campos = {};
      if (nome.value.trim() !== props.loja.nome) campos.nome = nome.value;
      if ((categoria.value || null) !== (props.loja.categoria ?? null)) campos.categoria = categoria.value || null;
      if (padroesMudaram.value) campos.padroes = validos.value;
      if (!Object.keys(campos).length) return emit("fechar");
      resposta = await api.alterarLoja(props.loja.id, campos);
    }
    const n = resposta.comprasAtualizadas;
    avisar(`Loja ${resposta.loja.nome} ${nova.value ? "criada" : "salva"}${n ? `: ${plural(n, "compra atualizada", "compras atualizadas")}` : ""}.`);
    emit("alterada");
  } catch (erro) {
    avisarErro(erro);
  } finally {
    enviando.value = false;
  }
}

async function juntar() {
  const origem = outras.value.find((l) => l.id === origemId.value);
  if (!origem) return;
  const texto =
    `Juntar ${origem.nome} em ${props.loja.nome}?\n\n` +
    `${origem.nome} deixa de existir: os padrões e as compras dela passam para ${props.loja.nome}, para todos os usuários.`;
  if (!confirm(texto)) return;
  enviando.value = true;
  try {
    const resposta = await api.juntarLojas(props.loja.id, origem.id);
    avisar(`${origem.nome} juntada a ${resposta.loja.nome}.`);
    emit("alterada");
  } catch (erro) {
    avisarErro(erro);
  } finally {
    enviando.value = false;
  }
}

async function excluir() {
  if (!confirm(`Excluir a loja ${props.loja.nome}? As compras dela voltam a ficar sem loja, para todos os usuários.`)) return;
  enviando.value = true;
  try {
    const resposta = await api.excluirLoja(props.loja.id);
    avisar(`Loja excluída: ${plural(resposta.comprasAtualizadas, "compra ficou", "compras ficaram")} sem loja.`);
    emit("alterada");
  } catch (erro) {
    avisarErro(erro);
  } finally {
    enviando.value = false;
  }
}
</script>

<template>
  <dialog ref="dialogo" class="dialogo" aria-labelledby="titulo-loja" @close="$emit('fechar')">
    <form v-if="loja" class="formulario" @submit.prevent="salvar">
      <header class="dialogo-cabecalho">
        <h2 id="titulo-loja" class="titulo-cartao">{{ nova ? "Nova loja" : "Loja" }}</h2>
        <button type="button" class="botao-icone" aria-label="Fechar" @click="$emit('fechar')">
          <Icone nome="close" />
        </button>
      </header>

      <label class="campo">
        <span>Nome</span>
        <input v-model="nome" type="text" maxlength="60" required />
      </label>
      <label class="campo">
        <span>Categoria</span>
        <select v-model="categoria">
          <option value="">Sem categoria</option>
          <option v-for="c in categorias" :key="c.id" :value="c.id">{{ c.nome }}</option>
        </select>
      </label>

      <fieldset class="padroes">
        <legend>Reconhecer compras cujo estabelecimento</legend>
        <div v-for="(p, i) in padroes" :key="i" class="padrao-linha">
          <CampoPadrao :model-value="p" :rotulo="`Padrão ${i + 1}`" @update:model-value="trocarPadrao(i, $event)" />
          <button
            type="button"
            class="botao-icone"
            :aria-label="`Remover o padrão ${p.texto}`"
            :disabled="padroes.length === 1"
            @click="padroes.splice(i, 1)"
          >
            <Icone nome="delete" />
          </button>
        </div>
        <button type="button" class="botao-texto" @click="padroes.push({ tipo: 'prefixo', texto: '' })">
          <Icone nome="add" /> Outro padrão
        </button>
        <p class="dica">
          Só letras e números contam ("Cia dos Calçados" vira CIADOSCALCADOS). Quando dois padrões
          reconhecem a mesma compra, vale o mais longo.
        </p>
      </fieldset>

      <PreviaPadroes v-if="padroesMudaram" :resultado="resultado" :carregando="conferindo" />

      <div class="acoes-dialogo">
        <button v-if="!nova" type="button" class="botao-secundario perigo" :disabled="enviando" @click="excluir">Excluir</button>
        <button type="submit" class="botao-principal" :disabled="enviando || !!resultado?.conflitos.length">
          {{ nova ? "Criar" : "Salvar" }}
        </button>
      </div>

      <div v-if="!nova && outras.length" class="juntar">
        <label class="campo">
          <span>Juntar outra loja nesta (ex.: a mesma loja cadastrada duas vezes)</span>
          <span class="campo-padrao">
            <select v-model="origemId">
              <option value="">Escolher loja…</option>
              <option v-for="l in outras" :key="l.id" :value="l.id">{{ l.nome }}</option>
            </select>
            <button type="button" class="botao-secundario" :disabled="!origemId || enviando" @click="juntar">
              <Icone nome="merge" /> Juntar
            </button>
          </span>
        </label>
      </div>
    </form>
  </dialog>
</template>
