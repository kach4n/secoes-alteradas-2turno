// Histórico das versões da lista oficial do TSE de seções alteradas no 2º turno.
// Cada versão tem seu arquivo de dados (gerado por scripts/build_data.sh) nesta pasta.
// A última da lista é a padrão do site.
window.VERSOES = [
  {
    id: '2026-10-18-11h', rotulo: '18/10 · 11h', painel: '18/10/2026, 11h27',
    arquivo: '2026-10-18-11h.js', csv: 'secoes_eleitorais_alteradas_2t-pais_2026.csv',
    secoes: 2033, eleitores: 592870, cidades: 316, zonas: 277,
  },
  {
    id: '2026-10-18-17h', rotulo: '18/10 · 17h', painel: '18/10/2026, 17h17',
    arquivo: '2026-10-18-17h.js', csv: 'secoes_eleitorais_alteradas_2t-pais_2026 v2.csv',
    secoes: 1396, eleitores: 402599, cidades: 240, zonas: 205, sairam: 653, entraram: 16,
  },
  {
    id: '2026-10-19-11h', rotulo: '19/10 · 11h', painel: '19/10/2026, 11h27',
    arquivo: '2026-10-19-11h.js', csv: 'secoes_eleitorais_alteradas_2t-pais_2026v3.csv',
    secoes: 554, eleitores: 163567, cidades: 111, zonas: 98, sairam: 892, entraram: 50,
  },
];
