// Sessão do usuário: o token (JWT) emitido pela extrato-api e o nome para exibir.
//
// A senha nunca fica no aparelho, nem nada que dê acesso a outra conta. O token é
// assinado pela API; alterá-lo o invalida. (As faturas e compras ficam guardadas para
// o modo offline: ver composables/useDados.js.)
import { computed, ref } from "vue";

const CHAVE = "extrato-sessao";

function ler() {
  try {
    const sessao = JSON.parse(localStorage.getItem(CHAVE));
    return sessao?.token && !expirado(sessao.token) ? sessao : null;
  } catch {
    return null;
  }
}

/** Lê a validade gravada no próprio token (sem conferir a assinatura: isso é papel da API). */
function expirado(token) {
  try {
    const carga = JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
    return typeof carga.exp === "number" && carga.exp * 1000 <= Date.now();
  } catch {
    return true;
  }
}

const sessao = ref(ler());

export const token = computed(() => sessao.value?.token ?? null);
export const usuario = computed(() => sessao.value?.usuario ?? null);

export function iniciarSessao({ token, usuario }) {
  sessao.value = { token, usuario };
  try {
    localStorage.setItem(CHAVE, JSON.stringify(sessao.value));
  } catch {}
}

/** A API mandou um token novo (o atual estava perto de vencer): troca sem sair. */
export function renovarToken(novo) {
  if (!sessao.value) return;
  iniciarSessao({ ...sessao.value, token: novo });
}

export function encerrarSessao() {
  sessao.value = null;
  try {
    localStorage.removeItem(CHAVE);
  } catch {}
}
