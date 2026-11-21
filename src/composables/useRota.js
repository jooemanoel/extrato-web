// Navegação pelo "#" do endereço (funciona no GitHub Pages sem configuração).
//   #/                 -> início (mês mais recente)
//   #/mes/AAAA-MM      -> início em um mês
//   #/faturas          -> faturas por cartão
//   #/fatura/<id>      -> uma fatura e as compras dela
//   #/importar         -> importar arquivos OFX
//   #/lojas            -> sugestões de loja
//   #/lojas/todas      -> lojas cadastradas
//   #/lojas/ignoradas  -> estabelecimentos ignorados
// O botão "voltar" do navegador/Android e o recarregamento da página mantêm a tela.
import { computed, ref } from "vue";

const hash = ref(location.hash);
window.addEventListener("hashchange", () => (hash.value = location.hash));

export const rota = computed(() => {
  const [tela, parametro] = hash.value.replace(/^#\/?/, "").split("/").map(decodeURIComponent);
  if (tela === "mes" && /^\d{4}-\d{2}$/.test(parametro ?? "")) return { tela: "inicio", mes: parametro };
  if (tela === "faturas") return { tela: "faturas" };
  if (tela === "fatura" && parametro) return { tela: "fatura", id: parametro };
  if (tela === "importar") return { tela: "importar" };
  if (tela === "lojas") {
    return { tela: "lojas", aba: parametro === "todas" || parametro === "ignoradas" ? parametro : "sugestoes" };
  }
  return { tela: "inicio", mes: null };
});

/** Vai para outra tela, criando uma entrada no histórico. */
export function ir(caminho) {
  location.hash = caminho;
}

/** Troca a tela atual sem criar entrada no histórico. */
export function substituir(caminho) {
  location.replace("#" + caminho.replace(/^#/, ""));
}

export const caminhoFatura = (id) => `/fatura/${encodeURIComponent(id)}`;
