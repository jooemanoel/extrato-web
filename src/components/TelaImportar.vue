<script setup>
// Importação de faturas OFX: escolhe um ou mais arquivos, mostra a prévia de cada um
// (nada é gravado) e importa depois da confirmação. O arquivo diz o cartão, o mês e se a
// fatura está aberta ou fechada; compras que já estão no banco não entram de novo.
import { computed, reactive, ref } from "vue";
import Icone from "./Icone.vue";
import * as api from "../services/api.js";
import { sincronizar } from "../composables/useDados.js";
import { caminhoFatura, ir } from "../composables/useRota.js";
import { avisar } from "../composables/useAviso.js";
import { competenciaLonga, dataCurta, dinheiro, plural } from "../formatar.js";

const itens = ref([]);
const arrastando = ref(false);
const seletor = ref(null);

// O BB grava o OFX em windows-1252 (acentos como "Próxima" e "CARTÃO").
const lerArquivo = async (arquivo) => new TextDecoder("windows-1252").decode(await arquivo.arrayBuffer());

async function adicionar(arquivos) {
  for (const arquivo of arquivos) {
    if (arquivo.size > 1_000_000) {
      avisar(`${arquivo.name}: arquivo grande demais para uma fatura.`, "erro");
      continue;
    }
    const item = reactive({
      chave: `${arquivo.name}-${arquivo.lastModified}-${Math.random()}`,
      nomeArquivo: arquivo.name,
      conteudo: await lerArquivo(arquivo),
      competencia: null,
      removerAusentes: false,
      estado: "carregando", // carregando | previa | importando | importado | erro
      resumo: null,
      erro: null,
    });
    itens.value.push(item);
    previa(item);
  }
}

const corpo = (item) => ({
  nomeArquivo: item.nomeArquivo,
  conteudo: item.conteudo,
  competencia: item.competencia ?? undefined,
  removerAusentes: item.removerAusentes,
});

async function previa(item) {
  item.estado = "carregando";
  item.erro = null;
  try {
    item.resumo = await api.previaImportacao(corpo(item));
    item.estado = "previa";
  } catch (erro) {
    item.erro = erro.message;
    item.estado = "erro";
  }
}

async function importar(item) {
  item.estado = "importando";
  try {
    item.resumo = await api.importar(corpo(item));
    item.estado = "importado";
    item.conteudo = ""; // não precisa mais do texto na memória
  } catch (erro) {
    item.erro = erro.message;
    item.estado = "erro";
  }
}

const prontos = computed(() => itens.value.filter((i) => i.estado === "previa"));

async function importarTodos() {
  for (const item of prontos.value) await importar(item);
  await terminar();
}

async function importarUm(item) {
  await importar(item);
  await terminar();
}

async function terminar() {
  await sincronizar(); // traz para o aparelho as faturas e compras importadas
  const feitos = itens.value.filter((i) => i.estado === "importado").length;
  if (feitos) avisar(`${plural(feitos, "arquivo importado", "arquivos importados")}.`);
}

function trocarCompetencia(item, valor) {
  if (!/^\d{4}-\d{2}$/.test(valor)) return;
  item.competencia = valor;
  previa(item);
}

function alternarAusentes(item) {
  item.removerAusentes = !item.removerAusentes;
  previa(item);
}

function remover(item) {
  itens.value = itens.value.filter((i) => i !== item);
}

function escolher(evento) {
  adicionar([...evento.target.files]);
  evento.target.value = "";
}

function soltar(evento) {
  arrastando.value = false;
  adicionar([...evento.dataTransfer.files].filter((f) => /\.ofx$/i.test(f.name)));
}

const ORIGEM = {
  arquivo: "pelo nome do arquivo",
  datas: "pelas datas das compras: confira",
  informada: "informada por você",
};
</script>

<template>
  <section
    class="cartao area-arquivo"
    :class="{ arrastando }"
    @dragover.prevent="arrastando = true"
    @dragleave="arrastando = false"
    @drop.prevent="soltar"
  >
    <Icone nome="upload_file" class="icone-grande" />
    <p>
      Escolha os arquivos <strong>.ofx</strong> das faturas do cartão (pode ser mais de um, e a
      fatura aberta quantas vezes quiser). Antes de gravar, o app mostra o que vai entrar.
    </p>
    <input ref="seletor" class="oculto" type="file" accept=".ofx,.OFX" multiple @change="escolher" />
    <button class="botao-principal" @click="seletor.click()">Escolher arquivos</button>
  </section>

  <section v-for="item in itens" :key="item.chave" class="cartao importacao" :class="item.estado">
    <header class="dialogo-cabecalho">
      <h2 class="titulo-arquivo reticencias" :title="item.nomeArquivo">{{ item.nomeArquivo }}</h2>
      <button
        v-if="item.estado !== 'importando'"
        class="botao-icone"
        :aria-label="`Tirar ${item.nomeArquivo} da lista`"
        @click="remover(item)"
      >
        <Icone nome="close" />
      </button>
    </header>

    <p v-if="item.estado === 'carregando'" class="dica">Lendo o arquivo…</p>
    <p v-else-if="item.estado === 'importando'" class="dica">Importando…</p>
    <template v-else-if="item.estado === 'erro'">
      <p class="conferencia" role="alert"><Icone nome="warning" /> {{ item.erro }}</p>
      <div v-if="item.conteudo" class="acoes-cartao">
        <button class="botao-secundario" @click="previa(item)">Tentar de novo</button>
      </div>
    </template>

    <template v-if="item.resumo && item.estado !== 'carregando' && item.estado !== 'erro'">
      <div class="resumo-fatura-topo">
        <div>
          <p class="titulo-cartao">{{ item.resumo.cartao.nome }}</p>
          <p class="compra-sub">
            {{ item.resumo.cartao.novo ? "cartão novo" : "cartão já cadastrado" }} ·
            {{ item.resumo.fatura.nova ? "fatura nova" : "fatura já existente" }}
          </p>
        </div>
        <span class="chip" :class="item.resumo.fatura.situacao">{{ item.resumo.fatura.situacao }}</span>
      </div>

      <label v-if="item.estado === 'previa'" class="campo">
        <span>Mês da fatura (vencimento) — {{ ORIGEM[item.resumo.fatura.origemCompetencia] }}</span>
        <input
          type="month"
          :value="item.resumo.fatura.competencia"
          required
          @change="trocarCompetencia(item, $event.target.value)"
        />
      </label>
      <p v-else class="compra-sub">{{ competenciaLonga(item.resumo.fatura.competencia) }}</p>

      <ul class="numeros">
        <li><strong>{{ item.resumo.lancamentos }}</strong> lançamentos no arquivo</li>
        <li><strong>{{ item.resumo.novas.length }}</strong> {{ item.estado === "importado" ? "incluídas" : "novas" }}</li>
        <li><strong>{{ item.resumo.existentes }}</strong> já estavam na fatura</li>
        <li v-if="item.resumo.movidas.length">
          <strong>{{ item.resumo.movidas.length }}</strong> {{ item.estado === "importado" ? "movidas" : "serão movidas" }} de outra fatura
        </li>
        <li v-if="item.resumo.emOutraFatura.length">
          <strong>{{ item.resumo.emOutraFatura.length }}</strong> já estão em outra fatura e ficam lá
        </li>
        <li>
          Total da fatura: <strong>{{ dinheiro(item.resumo.fatura.totalCompras) }}</strong>
          ({{ plural(item.resumo.fatura.quantidade, "compra", "compras") }})
        </li>
      </ul>

      <p v-if="item.resumo.conferencia?.confere" class="conferencia ok">
        <Icone nome="check_circle" /> Confere com o total do banco ({{ dinheiro(item.resumo.conferencia.totalBanco) }}).
      </p>
      <p v-else-if="item.resumo.conferencia" class="conferencia">
        <Icone nome="warning" /> Não confere: banco {{ dinheiro(item.resumo.conferencia.totalBanco) }},
        compras {{ dinheiro(item.resumo.conferencia.totalCompras) }}.
      </p>

      <p v-if="item.resumo.pagamento" class="dica">
        Pagamento da fatura anterior: {{ dinheiro(-Math.abs(item.resumo.pagamento.valor)) }} em
        {{ dataCurta(item.resumo.pagamento.data, { comAno: true }) }}
        {{ item.resumo.pagamento.aplicado ? "" : "(a fatura anterior não foi importada; fica sem registro)" }}
      </p>

      <details v-if="item.resumo.ausentes.length" class="historico" open>
        <summary>
          {{ plural(item.resumo.ausentes.length, "compra da fatura não está", "compras da fatura não estão") }} neste arquivo
        </summary>
        <p class="dica">
          Pode ser um lançamento que o banco tirou entre a fatura aberta e a fechada, ou uma compra
          que mudou de data. Confira antes de remover.
        </p>
        <ul>
          <li v-for="c in item.resumo.ausentes" :key="c.id">
            {{ dataCurta(c.data) }} {{ c.nomeEstabelecimento }} {{ dinheiro(c.valor) }}
          </li>
        </ul>
        <label v-if="item.estado === 'previa'" class="opcao">
          <input type="checkbox" :checked="item.removerAusentes" @change="alternarAusentes(item)" />
          <span>Remover essas compras ao importar</span>
        </label>
      </details>

      <details v-if="item.resumo.novas.length" class="historico">
        <summary>{{ item.estado === "importado" ? "Compras incluídas" : "Compras novas" }}</summary>
        <ul>
          <li v-for="c in item.resumo.novas" :key="c.id">
            {{ dataCurta(c.data) }} {{ c.nomeEstabelecimento }}
            <template v-if="c.parcela">{{ c.parcela.numero }}/{{ c.parcela.total }}</template>
            {{ dinheiro(c.valor) }}
          </li>
        </ul>
      </details>

      <div class="acoes-cartao">
        <button v-if="item.estado === 'previa'" class="botao-principal" @click="importarUm(item)">Importar</button>
        <button v-if="item.estado === 'importado'" class="botao-secundario" @click="ir(caminhoFatura(item.resumo.fatura.id))">
          Ver fatura
        </button>
      </div>
    </template>
  </section>

  <div v-if="prontos.length > 1" class="acoes-cartao">
    <button class="botao-principal" @click="importarTodos">Importar os {{ prontos.length }} arquivos</button>
  </div>
</template>
