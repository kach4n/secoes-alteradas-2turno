#!/usr/bin/env bash
# Cruza as seções alteradas no 2º turno com os resultados de Presidente do 1º turno
# e com as coordenadas dos locais de votação (1º e 2º turno). Gera um arquivo de versão em docs/dados/.
#
# Uso: bash scripts/build_data.sh [csv] [saida.js]
#   ex.: bash scripts/build_data.sh "secoes_eleitorais_alteradas_2t-pais_2026 v2.csv" docs/dados/2026-10-18-17h.js
# Depois registre a versão em docs/dados/versoes.js.
#
# Fontes (TSE - dados abertos):
#   data/raw/votacao_secao_2026_BR.zip            votação por seção, Presidente, 1º turno
#   data/raw/eleitorado_local_votacao_2026.zip    locais de votação por seção, 1º e 2º turno
set -euo pipefail
cd "$(dirname "$0")/.."

RAW=data/raw
OUT=data/out
# CSV de seções alteradas: o argumento, ou o mais recente da raiz do projeto
CSV="${1:-$(ls -t secoes_eleitorais_alteradas_2t-pais_2026*.csv | head -1)}"
JS="${2:-docs/dados/nova-versao.js}"
echo "usando: $CSV -> $JS"
mkdir -p "$OUT" "$(dirname "$JS")"

# 1) Seções alteradas (chave UF|zona|seção)
iconv -f latin1 -t utf-8 "$CSV" | tr -d '\r' \
  | awk -F';' 'NR>1{print $3"|"$5"|"$7";"$4";"$6";"$8";"$9}' > "$OUT/alteradas.txt"

# 2) Locais de votação: coordenadas por seção e turno; eleitorado por município e zona
unzip -p "$RAW/eleitorado_local_votacao_2026.zip" eleitorado_local_votacao_2026_BRASIL.csv \
  | iconv -f latin1 -t utf-8 | tr -d '\r' | awk -F';' -v OFS=';' '
  NR==FNR { split($1,a,";"); alt[a[1]]=1; next }
  FNR==1 { next }
  {
    gsub(/"/,""); t=$6; k=$7"|"$10"|"$11; m=$7"|"($8+0)
    lat=$23; lon=$24; gsub(",",".",lat); gsub(",",".",lon)
    if (t==1) {
      mun[m]+=$35; zon[$7"|"$10]+=$35; nm[m]=$9
      # centroide do município: média dos locais com coordenada válida
      if (lat!="-1" && lat!="" && lat+0!=0) { sla[m]+=lat; slo[m]+=lon; nc[m]++ }
    }
    if (k in alt) print "S", t, k, $8+0, $15, $16, lat, lon, $35
  }
  END {
    for (m in mun) { split(m,p,"|")
      print "M", p[1], p[2], nm[m], mun[m], (nc[m] ? sla[m]/nc[m] : ""), (nc[m] ? slo[m]/nc[m] : "") }
    for (z in zon) { split(z,p,"|"); print "Z", p[1], p[2], zon[z] }
  }' "$OUT/alteradas.txt" - > "$OUT/locais.txt"

# 3) Votação para Presidente: por seção alterada, por zona e por município
unzip -p "$RAW/votacao_secao_2026_BR.zip" votacao_secao_2026_BR.csv \
  | iconv -f latin1 -t utf-8 | tr -d '\r' | awk -F';' -v OFS=';' '
  NR==FNR { split($1,a,";"); alt[a[1]]=1; next }
  FNR==1 { next }
  {
    gsub(/"/,""); uf=$11; z=uf"|"$16; m=uf"|"$14; k=z"|"$17; n=$20; v=$22
    c = (n==13) ? 1 : (n==22) ? 2 : (n==95) ? 4 : (n==96) ? 5 : 3
    Z[z,c]+=v; M[m,c]+=v; zk[z]=1; mk[m]=1; mn[m]=$15
    if (k in alt) { S[k,c]+=v; sk[k]=1 }
  }
  END {
    for (k in sk) print "S", k, S[k,1]+0, S[k,2]+0, S[k,3]+0, S[k,4]+0, S[k,5]+0
    for (k in zk) print "Z", k, Z[k,1]+0, Z[k,2]+0, Z[k,3]+0, Z[k,4]+0, Z[k,5]+0
    for (k in mk) print "M", k, mn[k], M[k,1]+0, M[k,2]+0, M[k,3]+0, M[k,4]+0, M[k,5]+0
  }' "$OUT/alteradas.txt" - > "$OUT/votos.txt"

echo "ok: $(wc -l < "$OUT/alteradas.txt") alteradas, $(grep -c '^S' "$OUT/locais.txt") linhas de local, $(grep -c '^S' "$OUT/votos.txt") seções com votos"

# 4) Monta o arquivo de dados da versão
awk -F';' '
  function q(s) { gsub(/"/,"\047",s); return "\"" s "\"" }
  function n(s) { return (s=="" || s=="-1") ? "null" : s+0 }
  FILENAME ~ /alteradas/ { ord[++N]=$1; amun[$1]=$2; ini[$1]=$3; fin[$1]=$4; qt[$1]=$5; next }
  FILENAME ~ /locais/ && $1=="S" { cd[$3]=$4; la[$3,$2]=$7; lo[$3,$2]=$8; next }
  FILENAME ~ /locais/ && $1=="M" { me[$2"|"$3]=$5; mla[$2"|"$3]=$6; mlo[$2"|"$3]=$7; mnm[$2"|"$3]=$4; next }
  FILENAME ~ /locais/ && $1=="Z" { ze[$2"|"$3]=$4; next }
  FILENAME ~ /votos/ && $1=="S" { sv[$2]=$3","$4","$5","$6","$7; next }
  FILENAME ~ /votos/ && $1=="Z" { zv[$2]=$3","$4","$5","$6","$7; next }
  FILENAME ~ /votos/ && $1=="M" { mv[$2]=$4","$5","$6","$7","$8
    for (i=1;i<=5;i++) br[i]+=$(i+3); next }
  END {
    printf "window.SECOES=["
    for (i=1;i<=N;i++) { k=ord[i]; split(k,p,"|"); m=p[1]"|"cd[k]; um[m]=1; uz[p[1]"|"p[2]]=1
      printf "%s[%s,%d,%d,%s,%s,%d,%s,%s,%s,%s,%s,%s,%s]\n", (i>1?",":""), q(p[1]), p[2], p[3],
        n(cd[k]), q(amun[k]), qt[k], q(ini[k]), q(fin[k]),
        n(la[k,1]), n(lo[k,1]), n(la[k,2]), n(lo[k,2]), (k in sv) ? "["sv[k]"]" : "null" }
    printf "];\nwindow.MUNS={"; c=0
    for (m in um) printf "%s%s:[%s,%d,%s,%s,%s]\n", (c++?",":""), q(m), q(mnm[m]), me[m], n(mla[m]), n(mlo[m]), (m in mv) ? "["mv[m]"]" : "null"
    printf "};\nwindow.ZONAS={"; c=0
    for (z in uz) printf "%s%s:[%d,%s]\n", (c++?",":""), q(z), ze[z], (z in zv) ? "["zv[z]"]" : "null"
    printf "};\nwindow.BRASIL=[%d,%d,%d,%d,%d];\n", br[1],br[2],br[3],br[4],br[5]
  }' "$OUT/alteradas.txt" "$OUT/locais.txt" "$OUT/votos.txt" > "$JS"
echo "$JS: $(wc -c < "$JS") bytes"
