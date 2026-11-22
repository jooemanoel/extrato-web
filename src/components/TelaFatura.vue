<script setup>
// Uma fatura: totais, conferência com o banco, pagamento, histórico de importações,
// gasto por categoria e as compras. Permite digitar uma compra à mão e excluir a fatura.
import { computed, ref, watch } from "vue";
import Icone from "./Icone.vue";
import ResumoCompras from "./ResumoCompras.vue";
import * as api from "../services/api.js";
import { nomeDoCartao, recarregarFaturas, recarregarContagem } from "../composables/useDados.js";
import { substituir } from "../composables/useRota.js";
import { avisar, avisarErro } from "../composables/useAviso.js";
import { competenciaCurta, competenciaLonga, dataCurta, dataHora, dinheiro, hoje, lerDinheiro, plural } from "../formatar.js";

const props = defineProps({ id: { type: String, required: true } });
const emit = defineEmits(["titulo"]);

const fatura = ref(null);
const compras = ref(null);
const naoEncontrada = ref(false);

async function carregar() {
  try {
    const resposta = await api.buscarFatura(props.id);
    fatura.value = resposta.fatura;
    compras.value = resposta.compras;
  } catch (erro) {
    if (erro.status === 404) naoEncontrada.value = true;
    else avisarErro(erro);
  }
}
carregar();

watch(fatura, (f) => emit("titulo", f ? `${nomeDoCartao(f.cartaoId)} · ${competenciaCurta(f.competencia)}` : ""), {
  immediate: true,
});

const conferencia = computed(() => {
  const f = fatura.value;
  if (!f || f.situacao !== "fechada" || f.totalBanco == null) return null;
  return { confere: f.totalBanco === f.totalCompras, diferenca: f.totalCompras - f.totalBanco };
});

const periodo = computed(() =>
  fatura.value?.inicio ? `${dataCurta(fatura.value.inicio, { comAno: true })} a ${dataCurta(fatura.value.fim, { comAno: true })}` : ""
);

function alterada(compra) {
  compras.value = compras.value.map((c) => (c.id === compra.id ? compra : c));
  if (compra.origem === "manual") atualizarTotais();
}

function excluida(compra) {
  compras.value = compras.value.filter((c) => c.id !== compra.id);
  atualizarTotais();
}

/** Os totais da fatura mudam no servidor; relê a fatura e a lista. */
async function atualizarTotais() {
  await carregar();
  recarregarFaturas();
}

async function excluirFatura() {
  const f = fatura.value;
  const texto =
    `Excluir a fatura ${competenciaLonga(f.competencia)} de ${nomeDoCartao(f.cartaoId)} ` +
    `e as ${plural(compras.value.length, "compra", "compras")} dela?\n\n` +
    "Apelidos e lojas escolhidas à mão nessas compras se perdem. Importar o arquivo de novo recria a fatura.";
  if (!confirm(texto)) return;
  try {
    await api.excluirFatura(f.id);
    await recarregarFaturas();
    recarregarContagem();
    avisar("Fatura excluída.");
    substituir("/faturas");
  } catch (erro) {
    avisarErro(erro);
  }
}

// ---------- compra digitada à mão ----------
const dialogoNova = ref(null);
const nova = ref({ data: "", valor: "", descricao: "", estorno: false });
const enviando = ref(false);

function abrirNova() {
  nova.value = { data: hoje(), valor: "", descricao: "", estorno: false };
  dialogoNova.value.showModal();
}

async function criar() {
  const centavos = lerDinheiro(nova.value.valor);
  if (!centavos) return avisar("Informe um valor válido, como 12,34.", "erro");
  enviando.value = true;
  try {
    await api.criarCompra({
      faturaId: fatura.value.id,
      data: nova.value.data,
      valor: nova.value.estorno ? centavos : -centavos,
      descricao: nova.value.descricao,
    });
    dialogoNova.value.close();
    avisar("Compra incluída.");
    await atualizarTotais();
    recarregarContagem();
  } catch (erro) {
    avisarErro(erro);
  } finally {
    enviando.value = false;
  }
}
</script>

<template>
  <section v-if="naoEncontrada" class="cartao vazio">
    <p>Fatura não encontrada. Ela pode ter sido excluída.</p>
  </section>
  <p v-else-if="!fatura" class="vazio">Carregando fatura…</p>

  <template v-else>
    <section class="cartao resumo-fatura">
      <div class="resumo-fatura-topo">
        <div>
          <h2 class="titulo-cartao">{{ competenciaLonga(fatura.competencia) }}</h2>
          <p class="compra-sub">{{ nomeDoCartao(fatura.cartaoId) }} · final {{ fatura.cartaoId.slice(-4) }}</p>
        </div>
        <span class="chip" :class="fatura.situacao">{{ fatura.situacao }}</span>
      </div>

      <dl class="detalhes">
        <div>
          <dt>Total das compras</dt>
          <dd class="destaque-valor">{{ dinheiro(fatura.totalCompras) }}</dd>
        </div>
        <div v-if="fatura.totalBanco != null">
          <dt>Total do banco</dt>
          <dd>{{ dinheiro(fatura.totalBanco) }}</dd>
        </div>
        <div v-if="periodo">
          <dt>Compras de</dt>
          <dd>{{ periodo }}</dd>
        </div>
        <div v-if="fatura.pagamento">
          <dt>Pagamento</dt>
          <dd>{{ dinheiro(-Math.abs(fatura.pagamento.valor)) }} em {{ dataCurta(fatura.pagamento.data, { comAno: true }) }}</dd>
        </div>
      </dl>

      <p v-if="conferencia?.confere" class="conferencia ok">
        <Icone nome="check_circle" /> O total das compras confere com o do banco.
      </p>
      <p v-else-if="conferencia" class="conferencia">
        <Icone nome="warning" />
        Diferença de {{ dinheiro(-Math.abs(conferencia.diferenca)) }} em relação ao banco.
        Pode ser uma compra excluída ou digitada à mão.
      </p>
      <p v-if="fatura.situacao === 'aberta'" class="dica">
        Fatura aberta: importe o arquivo de novo para trazer as compras novas. Quando ela fechar,
        importe o arquivo da fatura fechada para conferir o total.
      </p>

      <details v-if="fatura.importacoes?.length" class="historico">
        <summary>Importações ({{ fatura.importacoes.length }})</summary>
        <ol>
          <li v-for="(i, n) in [...fatura.importacoes].reverse()" :key="n">
            <span class="compra-sub">{{ dataHora(i.em) }}</span>
            {{ i.situacao }}: {{ plural(i.novas, "nova", "novas") }}, {{ i.existentes }} já existentes
            <template v-if="i.movidas">, {{ i.movidas }} movidas</template>
            <template v-if="i.ausentes">, {{ i.ausentes }} ausentes</template>
            <template v-if="i.removidas"> ({{ i.removidas }} removidas)</template>
          </li>
        </ol>
      </details>

      <div class="acoes-cartao">
        <button class="botao-secundario perigo" @click="excluirFatura">
          <Icone nome="delete" /> Excluir fatura
        </button>
        <button class="botao-secundario" @click="abrirNova"><Icone nome="add" /> Compra à mão</button>
      </div>
    </section>

    <ResumoCompras :compras="compras" @alterada="alterada" @excluida="excluida" />
  </template>

  <dialog ref="dialogoNova" class="dialogo" aria-labelledby="titulo-nova">
    <form class="formulario" @submit.prevent="criar">
      <header class="dialogo-cabecalho">
        <h2 id="titulo-nova" class="titulo-cartao">Compra à mão</h2>
        <button type="button" class="botao-icone" aria-label="Fechar" @click="dialogoNova.close()">
          <Icone nome="close" />
        </button>
      </header>
      <p class="dica">Para lançamentos que não vieram no OFX (por exemplo, vistos só no PDF da fatura).</p>
      <label class="campo">
        <span>Descrição</span>
        <input v-model="nova.descricao" type="text" maxlength="80" required />
      </label>
      <label class="campo">
        <span>Data</span>
        <input v-model="nova.data" type="date" required />
      </label>
      <div class="campo-linha">
        <label class="campo">
          <span>Valor (R$)</span>
          <input v-model="nova.valor" type="text" inputmode="decimal" placeholder="0,00" required />
        </label>
        <label class="opcao">
          <input v-model="nova.estorno" type="checkbox" />
          <span>Estorno (crédito)</span>
        </label>
      </div>
      <div class="acoes-dialogo">
        <button type="submit" class="botao-principal" :disabled="enviando">Incluir</button>
      </div>
    </form>
  </dialog>
</template>
