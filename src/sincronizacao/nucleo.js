// Núcleo do modo offline: os dados do usuário guardados no aparelho e a sincronização
// com a API. Não depende de Vue nem do navegador (o armazenamento e a API chegam por
// parâmetro), para ser reaproveitado no app React Native.
//
// O aparelho guarda, por usuário:
//   base  cartões, faturas, compras, lojas e categorias como a API os devolveu, e o
//         instante (cursor) da última sincronização;
//   fila  as alterações de compras feitas aqui que a API ainda não recebeu, em ordem.
//
// O que as telas mostram é a base com a fila aplicada por cima (visao). Assim criar,
// alterar ou excluir uma compra responde na hora, com ou sem internet.
//
// sincronizar():
//   1. envia a fila (POST /sincronizacao); o que foi enviado sai da fila, aceito ou não;
//   2. pede o que mudou desde o cursor (GET /sincronizacao?desde=) e mescla na base.
// Reenviar a fila é seguro: a API não duplica nada (ver extrato-api/src/routes/sincronizacao.js).

const TAMANHO_LOTE = 200;
const VAZIA = () => ({ cursor: null, sincronizadoEm: null, categorias: [], cartoes: {}, faturas: {}, compras: {}, lojas: {} });

const ALFABETO = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

/** Id aleatório de 20 caracteres (o formato que a API aceita para compras criadas no aparelho). */
export function novoId() {
  const bytes = crypto.getRandomValues(new Uint8Array(20));
  return Array.from(bytes, (b) => ALFABETO[b % ALFABETO.length]).join("");
}

/** Como a API grava descrições: espaços aparados e em maiúsculas. */
const normalizarTexto = (texto) => String(texto ?? "").replace(/\s+/g, " ").trim().toUpperCase();
/** Como a API compara estabelecimentos: só A-Z e 0-9. */
const normalizarEstabelecimento = (texto) =>
  String(texto ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().replace(/[^A-Z0-9]/g, "");

const porId = (lista) => Object.fromEntries(lista.map((x) => [x.id, x]));

// ---------- mesclar a resposta da API ----------

/**
 * Aplica uma resposta de GET /sincronizacao à base (sem alterar a original).
 * Uma exclusão só apaga o que não foi gravado depois dela: a fatura excluída e
 * importada de novo continua, e as compras novas dela também.
 */
export function mesclar(base, resposta) {
  if (resposta.completa) {
    return {
      ...base,
      categorias: resposta.categorias ?? base.categorias,
      cartoes: porId(resposta.cartoes),
      faturas: porId(resposta.faturas),
      compras: porId(resposta.compras),
      lojas: porId(resposta.lojas),
    };
  }

  const nova = {
    ...base,
    categorias: resposta.categorias ?? base.categorias,
    cartoes: { ...base.cartoes },
    faturas: { ...base.faturas },
    compras: { ...base.compras },
    lojas: { ...base.lojas },
  };
  const colecao = { compra: nova.compras, fatura: nova.faturas, loja: nova.lojas, cartao: nova.cartoes };
  const apagavel = (item, em) => item && (!item.atualizadoEm || item.atualizadoEm <= em);

  for (const { tipo, id, em } of resposta.exclusoes ?? []) {
    const alvo = colecao[tipo];
    if (alvo && apagavel(alvo[id], em)) delete alvo[id];
    if (tipo === "fatura") {
      for (const c of Object.values(nova.compras)) if (c.faturaId === id && apagavel(c, em)) delete nova.compras[c.id];
    }
  }
  for (const c of resposta.cartoes) nova.cartoes[c.id] = c;
  for (const f of resposta.faturas) nova.faturas[f.id] = f;
  for (const c of resposta.compras) nova.compras[c.id] = c;
  for (const l of resposta.lojas) nova.lojas[l.id] = l;
  return nova;
}

// ---------- aplicar a fila por cima da base ----------

/** Mesmas regras da API (servicos/compras.js), no que dá para saber sem ela. */
function aplicar(compras, faturas, op) {
  const atual = compras[op.compraId];
  if (op.tipo === "criarCompra") {
    if (atual) return;
    const descricao = normalizarTexto(op.descricao);
    compras[op.compraId] = {
      id: op.compraId,
      cartaoId: faturas[op.faturaId]?.cartaoId ?? null,
      faturaId: op.faturaId,
      data: op.data,
      valor: op.valor,
      tipo: op.valor < 0 ? "compra" : "estorno",
      memo: descricao,
      estabelecimento: normalizarEstabelecimento(descricao),
      nomeEstabelecimento: descricao,
      parcela: null,
      descricao: null,
      origem: "manual",
      lojaId: null,
      lojaManual: false,
      ignorado: false,
      pendente: false, // a API decide a loja ao receber
      criadoEm: op.em,
      aEnviar: true,
    };
    return;
  }
  if (!atual) return;
  if (op.tipo === "excluirCompra") {
    delete compras[op.compraId];
    return;
  }
  const c = op.campos;
  const nova = { ...atual, aEnviar: true };
  if (c.descricao !== undefined) nova.descricao = c.descricao === null ? null : normalizarTexto(c.descricao) || null;
  if (c.data !== undefined) nova.data = c.data;
  if (c.valor !== undefined) {
    nova.valor = c.valor;
    nova.tipo = c.valor < 0 ? "compra" : "estorno";
  }
  if (c.lojaId !== undefined) {
    // null: volta ao reconhecimento automático, que só a API sabe fazer; até lá fica a loja atual.
    Object.assign(nova, c.lojaId ? { lojaId: c.lojaId, lojaManual: true, ignorado: false, pendente: false } : { lojaManual: false });
  }
  compras[op.compraId] = nova;
}

/**
 * O que as telas mostram: a base com a fila por cima. Os totais das faturas são
 * recalculados com as compras do aparelho, para refletir o que ainda não foi enviado.
 */
export function visao(base, fila) {
  const compras = { ...base.compras };
  for (const op of fila) aplicar(compras, base.faturas, op);

  const totais = {};
  for (const c of Object.values(compras)) {
    const t = (totais[c.faturaId] ??= { totalCompras: 0, quantidade: 0 });
    t.totalCompras += c.valor;
    t.quantidade++;
  }
  const faturas = {};
  for (const f of Object.values(base.faturas)) faturas[f.id] = { ...f, ...(totais[f.id] ?? { totalCompras: 0, quantidade: 0 }) };

  return { ...base, compras, faturas };
}

// ---------- o núcleo ----------

/**
 * @param armazem  { ler(chave), gravar(chave, valor), apagar(chave) } (podem ser async)
 * @param api      { buscarMudancas(desde), enviarOperacoes(operacoes) }; erro com status 0 = sem conexão
 * @param aoMudar  chamado depois de qualquer mudança no estado
 * @param aoRenovarToken(token)  a API mandou um token novo
 * @param aoRecusar([{ op, motivo }])  operações que a API recusou (saem da fila)
 */
export function criarNucleo({ armazem, api, aoMudar = () => {}, aoRenovarToken = () => {}, aoRecusar = () => {}, agora = () => new Date().toISOString() }) {
  let usuarioId = null;
  let base = VAZIA();
  let fila = [];
  let situacao = "parado"; // "sincronizando" | "online" | "offline" | "erro"
  let erro = null;
  let emAndamento = null;
  let deNovo = false;
  let cache = null; // visão calculada, até a próxima mudança

  const chave = (id) => `extrato:${id}`;

  function mudou() {
    cache = null;
    aoMudar();
  }

  async function salvar() {
    if (!usuarioId) return;
    try {
      await armazem.gravar(chave(usuarioId), { base, fila });
    } catch {
      // Armazenamento cheio ou bloqueado: o app segue funcionando só na memória.
    }
  }

  async function rodar() {
    const meuUsuario = usuarioId;
    situacao = "sincronizando";
    mudou();
    try {
      while (fila.length) {
        const lote = fila.slice(0, TAMANHO_LOTE);
        const { resultados } = await api.enviarOperacoes(lote);
        if (usuarioId !== meuUsuario) return;
        const enviados = new Set(lote.map((op) => op.id));
        fila = fila.filter((op) => !enviados.has(op.id));
        const recusadas = resultados
          .filter((r) => !r.ok)
          .map((r) => ({ op: lote.find((op) => op.id === r.id), motivo: r.motivo }));
        await salvar();
        mudou();
        if (recusadas.length) aoRecusar(recusadas);
      }

      const resposta = await api.buscarMudancas(base.cursor);
      if (usuarioId !== meuUsuario) return;
      base = { ...mesclar(base, resposta), cursor: resposta.agora, sincronizadoEm: agora() };
      if (resposta.token) aoRenovarToken(resposta.token);
      await salvar();
      situacao = "online";
      erro = null;
    } catch (e) {
      if (usuarioId !== meuUsuario) return;
      situacao = e?.status === 0 ? "offline" : "erro";
      erro = e?.message ?? String(e);
    } finally {
      if (usuarioId === meuUsuario) mudou();
    }
  }

  return {
    /** Carrega o que o aparelho guardou deste usuário (sem rede). */
    async abrir(id) {
      usuarioId = id;
      let guardado = null;
      try {
        guardado = await armazem.ler(chave(id));
      } catch {}
      base = { ...VAZIA(), ...(guardado?.base ?? {}) };
      fila = guardado?.fila ?? [];
      situacao = "parado";
      erro = null;
      mudou();
    },

    /** Esquece o usuário na memória (o que está guardado no aparelho continua). */
    fechar() {
      usuarioId = null;
      base = VAZIA();
      fila = [];
      situacao = "parado";
      erro = null;
      mudou();
    },

    /** Apaga do aparelho os dados de um usuário (ao sair da conta). */
    async apagar(id) {
      try {
        await armazem.apagar(chave(id));
      } catch {}
    },

    /** Envia a fila e busca as mudanças. Chamadas durante uma sincronização viram uma só, logo depois. */
    sincronizar() {
      if (!usuarioId) return Promise.resolve();
      if (emAndamento) {
        deNovo = true;
        return emAndamento;
      }
      emAndamento = (async () => {
        do {
          deNovo = false;
          await rodar();
        } while (deNovo && usuarioId);
        emAndamento = null;
      })();
      return emAndamento;
    },

    /** Põe uma alteração de compra na fila. A tela muda na hora; o envio vem em seguida. */
    enfileirar(op) {
      if (!usuarioId) return null;
      const completa = { ...op, id: novoId(), em: agora() };
      fila = [...fila, completa];
      salvar();
      mudou();
      return completa;
    },

    estado() {
      cache ??= {
        ...visao(base, fila),
        carregado: base.cursor != null,
        fila,
        situacao,
        erro,
      };
      return cache;
    },
  };
}
