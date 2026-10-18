# Seções alteradas no 2º turno · 2026

Site (Leaflet + OpenStreetMap) que cruza as seções cujo local de votação mudou entre o 1º e o 2º turno
com o resultado de Presidente no 1º turno, seção por seção.

Publicado em https://kach4n.github.io/secoes-alteradas-2turno/

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
bash scripts/build_data.sh "secoes_eleitorais_alteradas_2t-pais_2026 v2.csv" docs/dados/2026-10-18-17h.js
```

O script leva uns 5 minutos. Sem argumentos, ele usa o CSV mais recente da raiz do projeto.

## Histórico de versões

O TSE atualiza a lista de seções alteradas ao longo do dia, e o site guarda todas as versões baixadas.
Cada uma tem seu arquivo em `docs/dados/` e aparece no seletor "Versão do dado" (`?versao=<id>` na URL).

| Versão | CSV | Seções |
|---|---|---|
| 18/10 · 11h | `secoes_eleitorais_alteradas_2t-pais_2026.csv` | 2.033 |
| 18/10 · 17h | `secoes_eleitorais_alteradas_2t-pais_2026 v2.csv` | 1.396 |

Para adicionar uma versão nova: coloque o CSV na raiz, rode o script com o arquivo de saída em `docs/dados/`
e acrescente a versão no fim de `docs/dados/versoes.js`. A última da lista é a padrão do site.
