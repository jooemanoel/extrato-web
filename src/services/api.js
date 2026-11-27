// Camada de acesso à fatura-api.
// Os componentes não chamam fetch diretamente: pedem os dados a estas funções.
import { computed, ref } from "vue";
import { encerrarSessao, token } from "../composables/useSessao.js";

const API_URL = (import.meta.env.VITE_API_URL || "http://localhost:3000").replace(/\/$/, "");

export class ErroApi extends Error {
  constructor(status, mensagem, detalhes) {
    super(mensagem);
    this.status = status;
    this.detalhes = detalhes ?? null;
  }
}

// A função na Vercel pode demorar a "acordar"; a importação e as mudanças de loja
// recalculam muitas compras.
const TEMPO_LIMITE = 30000; // ms

/** Requisições em andamento: alimenta o indicador de carregamento da barra superior. */
const pendentes = ref(0);
export const ocupado = computed(() => pendentes.value > 0);

async function chamar(metodo, caminho, corpo) {
  const headers = {};
  if (corpo !== undefined) headers["Content-Type"] = "application/json";
  if (token.value) headers.Authorization = `Bearer ${token.value}`;

  pendentes.value++;
  try {
    let resposta;
    try {
      resposta = await fetch(API_URL + caminho, {
        method: metodo,
        headers,
        body: corpo === undefined ? undefined : JSON.stringify(corpo),
        signal: AbortSignal.timeout(TEMPO_LIMITE),
      });
    } catch {
      throw new ErroApi(0, "Sem conexão com o servidor. Verifique a internet.");
    }

    if (resposta.status === 204) return null;
    const dados = await resposta.json().catch(() => null);

    if (!resposta.ok) {
      // Token vencido ou inválido: volta para a tela de login.
      if (resposta.status === 401 && headers.Authorization) encerrarSessao();
      throw new ErroApi(resposta.status, dados?.erro || `Erro inesperado (HTTP ${resposta.status})`, dados?.detalhes);
    }
    return dados;
  } finally {
    pendentes.value--;
  }
}

const id = encodeURIComponent;

// Sessão
export const entrar = (nome, senha) => chamar("POST", "/auth/login", { nome, senha });
export const cadastrar = (nome, senha) => chamar("POST", "/auth/cadastro", { nome, senha });

// Sincronização (modo offline): ver sincronizacao/nucleo.js
export const buscarMudancas = (desde) =>
  chamar("GET", `/sincronizacao${desde ? `?desde=${encodeURIComponent(desde)}` : ""}`);
export const enviarOperacoes = (operacoes) => chamar("POST", "/sincronizacao", { operacoes });

// Categorias, cartões e faturas
export const buscarCategorias = () => chamar("GET", "/categorias");
export const buscarCartoes = () => chamar("GET", "/cartoes");
export const renomearCartao = (cartaoId, nome) => chamar("PATCH", `/cartoes/${id(cartaoId)}`, { nome });
export const buscarFaturas = () => chamar("GET", "/faturas");
/** { fatura, compras } */
export const buscarFatura = (faturaId) => chamar("GET", `/faturas/${id(faturaId)}`);
export const excluirFatura = (faturaId) => chamar("DELETE", `/faturas/${id(faturaId)}`);

// Importação: { nomeArquivo, conteudo, competencia?, removerAusentes? }
export const previaImportacao = (dados) => chamar("POST", "/importacoes/previa", dados);
export const importar = (dados) => chamar("POST", "/importacoes", dados);

// Compras
export const criarCompra = (dados) => chamar("POST", "/compras", dados);
export const alterarCompra = (compraId, campos) => chamar("PATCH", `/compras/${id(compraId)}`, campos);
export const excluirCompra = (compraId) => chamar("DELETE", `/compras/${id(compraId)}`);

// Lojas (compartilhadas entre os usuários)
export const buscarLojas = () => chamar("GET", "/lojas");
export const buscarSugestoes = () => chamar("GET", "/lojas/sugestoes");
/** { padroes, lojaId? } -> { captura, tomadasDeOutrasLojas, perdidas, conflitos } */
export const previaLoja = (dados) => chamar("POST", "/lojas/previa", dados);
export const criarLoja = (dados) => chamar("POST", "/lojas", dados);
export const alterarLoja = (lojaId, campos) => chamar("PATCH", `/lojas/${id(lojaId)}`, campos);
export const excluirLoja = (lojaId) => chamar("DELETE", `/lojas/${id(lojaId)}`);
export const juntarLojas = (destinoId, origemId) => chamar("POST", `/lojas/${id(destinoId)}/juntar`, { origemId });

// Estabelecimentos ignorados (compras avulsas, sem loja)
export const buscarIgnorados = () => chamar("GET", "/ignorados");
export const ignorar = (estabelecimento) => chamar("POST", "/ignorados", { estabelecimento });
export const desfazerIgnorado = (estabelecimento) => chamar("DELETE", `/ignorados/${id(estabelecimento)}`);
