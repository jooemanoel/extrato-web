<script setup>
// Detalhe e edição de uma compra: apelido, loja escolhida à mão e exclusão.
// Data e valor só mudam em compras digitadas à mão (as do OFX voltariam ao original
// na próxima importação).
import { computed, ref, watch } from "vue";
import Icone from "./Icone.vue";
import * as api from "../services/api.js";
import { lojas, nomeDoCartao, recarregarContagem } from "../composables/useDados.js";
import { ir } from "../composables/useRota.js";
import { avisar, avisarErro } from "../composables/useAviso.js";
import { dataCurta, dinheiro, dinheiroAbsoluto, lerDinheiro } from "../formatar.js";

const props = defineProps({ compra: { type: Object, default: null } });
const emit = defineEmits(["fechar", "alterada", "excluida"]);

const dialogo = ref(null);
const descricao = ref("");
const lojaId = ref("");
const data = ref("");
const valor = ref("");
const estorno = ref(false);
const enviando = ref(false);

const manual = computed(() => props.compra?.origem === "manual");
const lojasOrdenadas = computed(() => [...lojas.value].sort((a, b) => a.nome.localeCompare(b.nome)));

watch(
  () => props.compra,
  (c) => {
    if (!c) return dialogo.value?.close();
    descricao.value = c.descricao ?? "";
    lojaId.value = c.lojaManual ? c.lojaId : "";
    data.value = c.data;
    valor.value = (Math.abs(c.valor) / 100).toFixed(2).replace(".", ",");
    estorno.value = c.valor > 0;
    if (!dialogo.value.open) dialogo.value.showModal();
  },
  { flush: "post" }
);

/** Só os campos que mudaram. */
function alteracoes() {
  const c = props.compra;
  const campos = {};
  const novaDescricao = descricao.value.trim() || null;
  if (novaDescricao !== (c.descricao ?? null)) campos.descricao = novaDescricao;

  const escolhida = lojaId.value || null;
  if (escolhida && (escolhida !== c.lojaId || !c.lojaManual)) campos.lojaId = escolhida;
  if (!escolhida && c.lojaManual) campos.lojaId = null;

  if (manual.value) {
    if (data.value !== c.data) campos.data = data.value;
    const centavos = lerDinheiro(valor.value);
    if (!centavos) throw new Error("Informe um valor válido, como 12,34.");
    const novoValor = estorno.value ? centavos : -centavos;
    if (novoValor !== c.valor) campos.valor = novoValor;
  }
  return campos;
}

async function salvar() {
  let campos;
  try {
    campos = alteracoes();
  } catch (erro) {
    return avisar(erro.message, "erro");
  }
  if (!Object.keys(campos).length) return emit("fechar");
  enviando.value = true;
  try {
    const alterada = await api.alterarCompra(props.compra.id, campos);
    emit("alterada", alterada);
    if ("lojaId" in campos) recarregarContagem();
    avisar("Compra alterada.");
  } catch (erro) {
    avisarErro(erro);
  } finally {
    enviando.value = false;
  }
}

async function excluir() {
  const c = props.compra;
  const aviso =
    c.origem === "ofx" ? "\n\nEla volta se o mesmo arquivo OFX for importado de novo." : "";
  if (!confirm(`Excluir a compra ${c.descricao || c.nomeEstabelecimento} (${dinheiroAbsoluto(c.valor)})?${aviso}`)) return;
  enviando.value = true;
  try {
    await api.excluirCompra(c.id);
    emit("excluida", c);
    recarregarContagem();
    avisar("Compra excluída.");
  } catch (erro) {
    avisarErro(erro);
  } finally {
    enviando.value = false;
  }
}

function criarLoja() {
  emit("fechar");
  ir("/lojas");
}
</script>

<template>
  <dialog ref="dialogo" class="dialogo" aria-labelledby="titulo-compra" @close="$emit('fechar')">
    <form v-if="compra" class="formulario" method="dialog" @submit.prevent="salvar">
      <header class="dialogo-cabecalho">
        <h2 id="titulo-compra" class="titulo-cartao">Compra</h2>
        <button type="button" class="botao-icone" aria-label="Fechar" @click="$emit('fechar')">
          <Icone nome="close" />
        </button>
      </header>

      <dl class="detalhes">
        <div>
          <dt>Estabelecimento</dt>
          <dd>{{ compra.nomeEstabelecimento }}</dd>
        </div>
        <div v-if="!manual">
          <dt>Data</dt>
          <dd>{{ dataCurta(compra.data, { comAno: true }) }}</dd>
        </div>
        <div v-if="!manual">
          <dt>Valor</dt>
          <dd :class="{ credito: compra.valor > 0 }">{{ dinheiro(compra.valor) }}</dd>
        </div>
        <div v-if="compra.parcela">
          <dt>Parcela</dt>
          <dd>{{ compra.parcela.numero }} de {{ compra.parcela.total }}</dd>
        </div>
        <div>
          <dt>Cartão</dt>
          <dd>{{ nomeDoCartao(compra.cartaoId) }}</dd>
        </div>
        <div>
          <dt>Origem</dt>
          <dd>{{ manual ? "digitada à mão" : "arquivo OFX" }}</dd>
        </div>
      </dl>

      <template v-if="manual">
        <label class="campo">
          <span>Data</span>
          <input v-model="data" type="date" required />
        </label>
        <div class="campo-linha">
          <label class="campo">
            <span>Valor (R$)</span>
            <input v-model="valor" type="text" inputmode="decimal" required />
          </label>
          <label class="opcao">
            <input v-model="estorno" type="checkbox" />
            <span>Estorno (crédito)</span>
          </label>
        </div>
      </template>

      <label class="campo">
        <span>Apelido</span>
        <input v-model="descricao" type="text" maxlength="80" :placeholder="compra.loja?.nome || compra.nomeEstabelecimento" />
      </label>

      <label class="campo">
        <span>Loja</span>
        <select v-model="lojaId">
          <option value="">Automática{{ !compra.lojaManual ? `: ${compra.loja?.nome ?? "nenhuma"}` : "" }}</option>
          <option v-for="l in lojasOrdenadas" :key="l.id" :value="l.id">{{ l.nome }}</option>
        </select>
      </label>
      <p class="dica">
        A categoria vem da loja. "Automática" usa os padrões das lojas; escolher uma loja aqui vale só para esta compra.
      </p>
      <button v-if="compra.pendente" type="button" class="botao-texto" @click="criarLoja">
        <Icone nome="storefront" /> Ver sugestões de loja
      </button>

      <div class="acoes-dialogo">
        <button type="button" class="botao-secundario perigo" :disabled="enviando" @click="excluir">Excluir</button>
        <button type="submit" class="botao-principal" :disabled="enviando">Salvar</button>
      </div>
    </form>
  </dialog>
</template>
