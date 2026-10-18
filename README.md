# Seções alteradas no 2º turno · 2026

Site (Leaflet + OpenStreetMap) que cruza as seções cujo local de votação mudou entre o 1º e o 2º turno
com o resultado de Presidente no 1º turno, seção por seção.

Publicado em https://kach4n.github.io/eleitoral/

## Abrir o site localmente

```bash
powershell -NoProfile -ExecutionPolicy Bypass -File servir.ps1
```

Depois acesse http://localhost:8080.

## Regerar os dados

Precisa dos arquivos do TSE em `data/raw/`:

- `votacao_secao_2026_BR.zip`: https://cdn.tse.jus.br/estatistica/sead/odsele/votacao_secao/votacao_secao_2026_BR.zip
- `eleitorado_local_votacao_2026.zip`: https://cdn.tse.jus.br/estatistica/sead/odsele/eleitorado_locais_votacao/eleitorado_local_votacao_2026.zip

```bash
bash scripts/build_data.sh
```

O script gera `docs/data.js` (leva uns 5 minutos).
