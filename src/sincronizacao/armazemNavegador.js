// Armazenamento do núcleo no navegador: localStorage, em JSON.
// No React Native, o equivalente é o AsyncStorage (mesmas três funções, assíncronas).
//
// Tamanho: cada compra ocupa uns 500 caracteres; o limite do localStorage (~5 milhões
// de caracteres por site) dá para perto de 10 mil compras.
export const armazemNavegador = {
  ler(chave) {
    const texto = localStorage.getItem(chave);
    return texto ? JSON.parse(texto) : null;
  },
  gravar(chave, valor) {
    localStorage.setItem(chave, JSON.stringify(valor));
  },
  apagar(chave) {
    localStorage.removeItem(chave);
  },
};
