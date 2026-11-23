// Dados compartilhados entre as telas: categorias, cartões, faturas, compras e lojas.
//
// Ficam guardados no aparelho (modo offline) e são sincronizados com a API pelo núcleo
// (sincronizacao/nucleo.js). As telas leem daqui, com ou sem internet. Alterações de
// compras vão para uma fila e são enviadas assim que der. O que depende da API
// (importar, sugestões e mudanças de loja, excluir fatura, renomear cartão) continua
// pedindo internet, e depois chama sincronizar() para trazer o resultado.
import { computed, ref, shallowRef } from "vue";
import * as api from "../services/api.js";
import { criarNucleo, novoId as novoIdDeCompra } from "../sincronizacao/nucleo.js";
import { armazemNavegador } from "../sincronizacao/armazemNavegador.js";
import { avisar, avisarErro } from "./useAviso.js";
import { renovarToken } from "./useSessao.js";
import { normalizar, plural } from "../formatar.js";

const NOVA_TENTATIVA = 30_000; // ms entre tentativas, offline com alterações por enviar

const nucleo = criarNucleo({
  armazem: armazemNavegador,
  api: { buscarMudancas: api.buscarMudancas, enviarOperacoes: api.enviarOperacoes },
  aoMudar: () => (estado.value = nucleo.estado()),
  aoRenovarToken: renovarToken,
  aoRecusar: (recusadas) =>
    avisar(
      `${plural(recusadas.length, "alteração não foi aceita", "alterações não foram aceitas")} pelo servidor: ${recusadas[0].motivo}`,
      "erro",
      8000
    ),
});
const estado = shallowRef(nucleo.estado());

// ---------- dados ----------

export const categorias = computed(() => estado.value.categorias);
export const cartoes = computed(() => Object.values(estado.value.cartoes));
export const lojas = computed(() => Object.values(estado.value.lojas));

/** null = ainda sem dados no aparelho (antes da primeira sincronização). */
export const faturas = computed(() =>
  estado.value.carregado
    ? Object.values(estado.value.faturas).sort(
        (a, b) => b.competencia.localeCompare(a.competencia) || a.cartaoId.localeCompare(b.cartaoId)
      )
    : null
);

/** Compras com a loja e a categoria resolvidas (a categoria é sempre a da loja), da mais recente para a mais antiga. */
export const compras = computed(() => {
  const lojasPorId = estado.value.lojas;
  return Object.values(estado.value.compras)
    .map((c) => {
      const loja = c.lojaId ? lojasPorId[c.lojaId] : null;
      return { ...c, loja: loja ? { id: loja.id, nome: loja.nome } : null, categoria: loja?.categoria ?? null };
    })
    .sort((a, b) => b.data.localeCompare(a.data) || a.id.localeCompare(b.id));
});

// ---------- situação da sincronização ----------

/** "parado" | "sincronizando" | "online" | "offline" | "erro" */
export const conexao = computed(() => estado.value.situacao);
export const erroDeSincronizacao = computed(() => estado.value.erro);
export const sincronizadoEm = computed(() => estado.value.sincronizadoEm);
export const aEnviar = computed(() => estado.value.fila.length);

// ---------- grupos e nomes ----------

// Grupos extras, além das categorias da API.
export const SEM_LOJA = { id: "sem-loja", nome: "SEM LOJA", icone: "help" };
export const SEM_CATEGORIA = { id: "sem-categoria", nome: "SEM CATEGORIA", icone: "sell" };
export const AVULSAS = { id: "avulsa", nome: "AVULSAS", icone: "block" };

const categoriasPorId = computed(() => new Map(categorias.value.map((c) => [c.id, c])));
export const categoriaPorId = (id) => categoriasPorId.value.get(id) ?? null;

/** Em que grupo a compra aparece no resumo por categoria. */
export function grupoDaCompra(compra) {
  if (compra.loja) return compra.categoria ? compra.categoria : SEM_CATEGORIA.id;
  return compra.ignorado ? AVULSAS.id : SEM_LOJA.id;
}

/** Todos os grupos possíveis, na ordem de exibição. */
export const grupos = computed(() => [...categorias.value, SEM_CATEGORIA, AVULSAS, SEM_LOJA]);

/** Nome exibido da compra: o apelido, senão a loja, senão o estabelecimento do OFX. */
export const nomeDaCompra = (c) => c.descricao || c.loja?.nome || c.nomeEstabelecimento;

export const nomeDoCartao = (id) => estado.value.cartoes[id]?.nome ?? `Cartão ${id}`;

// ---------- sugestões de loja (só online, na tela de lojas) ----------

// Lidas só na tela de lojas (cada leitura passa por todas as compras sem loja no servidor).
export const sugestoes = ref(null); // null = não carregadas (ou velhas)

/** Compras sem loja, contadas no aparelho. */
export const quantidadeSugestoes = computed(() => Object.values(estado.value.compras).filter((c) => c.pendente).length);

async function tentar(promessa, aplicar) {
  try {
    aplicar(await promessa);
  } catch (erro) {
    avisarErro(erro);
  }
}

export const recarregarSugestoes = () => tentar(api.buscarSugestoes(), (v) => (sugestoes.value = v));

/**
 * Atualiza as sugestões com o que a API informou depois de uma mudança de loja ou de ignorados:
 *   { resolvidas: [{ estabelecimento, quantidade, total }], novas }
 * As compras resolvidas saem dos grupos. Se alguma compra voltou a ficar sem loja (novas), ou
 * um estabelecimento aparece em mais de um grupo, relê tudo: aí não dá para acertar localmente.
 */
export function aplicarPendencias(pendencias) {
  if (!pendencias || !sugestoes.value || pendencias.novas) return recarregarSugestoes();
  const resolvidas = new Map(pendencias.resolvidas.map((r) => [r.estabelecimento, r]));
  if (!resolvidas.size) return;

  const afetados = sugestoes.value.filter((g) => g.estabelecimentos.some((e) => resolvidas.has(e)));
  const vezes = new Map();
  for (const g of afetados) for (const e of g.estabelecimentos) vezes.set(e, (vezes.get(e) ?? 0) + 1);
  if ([...resolvidas.keys()].some((e) => (vezes.get(e) ?? 0) > 1)) return recarregarSugestoes();

  sugestoes.value = sugestoes.value.flatMap((g) => {
    const saem = g.estabelecimentos.filter((e) => resolvidas.has(e));
    if (!saem.length) return [g];
    const estabelecimentos = g.estabelecimentos.filter((e) => !resolvidas.has(e));
    const quantidade = g.quantidade - saem.reduce((s, e) => s + resolvidas.get(e).quantidade, 0);
    if (!estabelecimentos.length || quantidade <= 0) return [];
    const total = g.total - saem.reduce((s, e) => s + resolvidas.get(e).total, 0);
    // Exemplos são o nome como veio no OFX ("AMERICANAS F485BA" ~ "AMERICANASF485BA").
    const exemplos = g.exemplos.filter((x) => {
      const n = normalizar(x);
      return estabelecimentos.some((e) => n.startsWith(e) || e.startsWith(n));
    });
    return [{ ...g, estabelecimentos, quantidade, total, exemplos: exemplos.length ? exemplos : g.exemplos }];
  });
}

// ---------- sincronização ----------

/** Envia o que está na fila e traz o que mudou no servidor. */
export const sincronizar = () => nucleo.sincronizar();

let temporizador = null;
function tentarDeNovoMaisTarde() {
  clearInterval(temporizador);
  temporizador = setInterval(() => {
    if (estado.value.situacao === "offline" || estado.value.fila.length) sincronizar();
    else clearInterval(temporizador);
  }, NOVA_TENTATIVA);
}

// A internet voltou, ou o app voltou para a frente: sincroniza.
if (typeof window !== "undefined") {
  window.addEventListener("online", () => sincronizar());
  document.addEventListener("visibilitychange", () => document.visibilityState === "visible" && sincronizar());
}

/** Depois de entrar (ou ao abrir o app já logado): mostra o que está guardado e sincroniza. */
export async function iniciar(usuarioId) {
  sugestoes.value = null;
  await nucleo.abrir(usuarioId);
  await sincronizar();
  tentarDeNovoMaisTarde();
}

/** Sessão encerrada (ou vencida): some da memória; o que está guardado no aparelho continua. */
export function encerrar() {
  clearInterval(temporizador);
  sugestoes.value = null;
  nucleo.fechar();
}

/** Ao sair da conta: apaga do aparelho os dados e as alterações ainda não enviadas. */
export const apagarDoAparelho = (usuarioId) => nucleo.apagar(usuarioId);

// ---------- alterações de compras (funcionam offline) ----------

function enfileirar(op) {
  nucleo.enfileirar(op);
  sincronizar();
  tentarDeNovoMaisTarde();
}

/** { faturaId, data, valor, descricao } */
export const criarCompra = (dados) => enfileirar({ tipo: "criarCompra", compraId: novoIdDeCompra(), ...dados });
/** campos: { descricao?, lojaId?, data?, valor? } */
export const alterarCompra = (compraId, campos) => enfileirar({ tipo: "alterarCompra", compraId, campos });
export const excluirCompra = (compraId) => enfileirar({ tipo: "excluirCompra", compraId });
