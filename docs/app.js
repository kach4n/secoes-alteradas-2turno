// Seções alteradas no 2º turno × votação para Presidente no 1º turno.
// Dados em data.js (gerado por scripts/build_data.sh):
//   SECOES: [uf, zona, secao, cdMun, municipio, eleitores, localIni, localFin,
//            lat1, lon1, lat2, lon2, [lula, bolsonaro, outros, brancos, nulos] | null]
//   MUNS:   {"UF|cdMun": [nome, eleitorado, lat, lon, [votos] | null]}
//   ZONAS:  {"UF|zona": [eleitorado, [votos] | null]}
//   BRASIL: [lula, bolsonaro, outros, brancos, nulos]

const fmt = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 });
const fmt1 = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1, minimumFractionDigits: 1 });
const pct = (x) => (isFinite(x) ? fmt1.format(100 * x) + '%' : '–');
const km = (x) => (x == null ? '–' : fmt1.format(x) + ' km');

const COR = { lula: '#d62d2d', bolso: '#1f5fbf', neutro: '#8a8a85' };

function dist(lat1, lon1, lat2, lon2) {
  const R = 6371, r = Math.PI / 180;
  const a = Math.sin((lat2 - lat1) * r / 2) ** 2 +
    Math.cos(lat1 * r) * Math.cos(lat2 * r) * Math.sin((lon2 - lon1) * r / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

// Cor divergente pela fatia de Lula entre os dois (0 = Bolsonaro, 1 = Lula)
function corDiv(s) {
  if (!isFinite(s)) return COR.neutro;
  const t = Math.min(1, Math.abs(s - 0.5) * 2.5);
  const base = s >= 0.5 ? [214, 45, 45] : [31, 95, 191];
  const c = base.map((v) => Math.round(225 + (v - 225) * (0.25 + 0.75 * t)));
  return `rgb(${c.join(',')})`;
}

const vencedor = (v) => (!v ? null : v[0] > v[1] ? 'lula' : v[1] > v[0] ? 'bolso' : 'empate');

// ---------- Normalização ----------
const secoes = SECOES.map((r) => {
  const [uf, zona, secao, cd, mun, eleitores, ini, fin, la1, lo1, la2, lo2, v] = r;
  const mk = `${uf}|${cd}`, zk = `${uf}|${zona}`;
  const m = MUNS[mk] || null;
  const d = la1 != null && la2 != null ? dist(la1, lo1, la2, lo2) : null;
  const lat = la2 ?? la1 ?? m?.[2], lon = lo2 ?? lo1 ?? m?.[3];
  return {
    uf, zona, secao, cd, mun, eleitores, ini, fin, la1, lo1, la2, lo2, v, d, lat, lon, mk, zk,
    venc: vencedor(v), vencZona: vencedor(ZONAS[zk]?.[1]), vencMun: vencedor(m?.[4]),
  };
});

// ---------- Filtros ----------
const ufs = [...new Set(secoes.map((s) => s.uf))].sort();
const fUf = document.getElementById('fUf');
ufs.forEach((u) => fUf.add(new Option(u === 'ZZ' ? 'ZZ (exterior)' : u, u)));
const fDist = document.getElementById('fDist');
const fLayer = document.getElementById('fLayer');

// ---------- Versões da lista oficial ----------
const fVersao = document.getElementById('fVersao');
const ultima = VERSOES[VERSOES.length - 1];
[...VERSOES].reverse().forEach((v) =>
  fVersao.add(new Option(v.rotulo + (v === ultima ? ' (mais recente)' : ''), v.id, false, v.id === VERSAO.id)));
fVersao.addEventListener('change', () => {
  const u = new URL(location.href);
  if (fVersao.value === ultima.id) u.searchParams.delete('versao'); else u.searchParams.set('versao', fVersao.value);
  location.href = u.toString();
});

function desenharHistorico() {
  const link = (v) => (v === ultima ? '?' : `?versao=${v.id}`);
  const linhas = VERSOES.map((v, i) => {
    const ant = VERSOES[i - 1];
    const dif = ant ? v.secoes - ant.secoes : null;
    const var_ = dif == null ? '–' : `${dif > 0 ? '+' : '−'}${fmt.format(Math.abs(dif))}` +
      (v.sairam != null ? `<br><span class="note">saíram ${fmt.format(v.sairam)}, entraram ${fmt.format(v.entraram)}</span>` : '');
    const atual = v.id === VERSAO.id;
    return `<tr${atual ? ' class="atual"' : ''}>
      <td><a href="${link(v)}">${v.rotulo}</a>${atual ? ' <span class="pill">vendo</span>' : ''}
        <br><span class="note">painel: ${v.painel}</span></td>
      <td><b>${fmt.format(v.secoes)}</b></td><td>${fmt.format(v.eleitores)}</td>
      <td>${fmt.format(v.cidades)}</td><td>${var_}</td></tr>`;
  }).reverse().join('');
  document.getElementById('historico').innerHTML = `
    <table class="hist"><thead><tr><th>Versão</th><th>Seções</th><th>Eleitores</th><th>Cidades</th><th>Variação</th></tr></thead>
    <tbody>${linhas}</tbody></table>
    <p class="note" style="margin:8px 0 0">O TSE atualiza a lista ao longo do dia. Cada versão baixada fica guardada aqui;
    clique numa linha para ver o mapa e as estatísticas daquela versão.</p>`;
}

function filtradas() {
  const uf = fUf.value, dmin = +fDist.value || 0;
  return secoes.filter((s) => (!uf || s.uf === uf) && (dmin === 0 || (s.d != null && s.d >= dmin)));
}

// ---------- Mapa ----------
const map = L.map('map', { preferCanvas: true }).setView([-14.5, -52], 4);
L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '&copy; OpenStreetMap · Dados: TSE', maxZoom: 19,
}).addTo(map);
const camadaMun = L.layerGroup().addTo(map);
const camadaSec = L.layerGroup();

const legenda = L.control({ position: 'bottomleft' });
legenda.onAdd = () => {
  const d = L.DomUtil.create('div', 'mapa-legenda');
  d.innerHTML = `<b>Cor</b>: voto no 1º turno nas seções alteradas<br>
    <span class="tag" style="background:${COR.lula}"></span>Lula &nbsp;
    <span class="tag" style="background:${COR.bolso}"></span>Bolsonaro<br>
    <span class="note">Tamanho = eleitores afetados · Linha = local antigo → novo<br>Na camada de seções, cada marca é uma mudança de local (pode reunir várias seções)</span>`;
  return d;
};
legenda.addTo(map);

function agrupar(lista, chave) {
  const g = new Map();
  for (const s of lista) {
    const k = chave(s);
    let a = g.get(k);
    if (!a) g.set(k, (a = { k, secoes: [], eleitores: 0, v: [0, 0, 0, 0, 0], dSum: 0, dPeso: 0 }));
    a.secoes.push(s);
    a.eleitores += s.eleitores;
    if (s.v) s.v.forEach((x, i) => (a.v[i] += x));
    if (s.d != null) { a.dSum += s.d * s.eleitores; a.dPeso += s.eleitores; }
  }
  for (const a of g.values()) a.dMed = a.dPeso ? a.dSum / a.dPeso : null;
  return [...g.values()];
}

const share2 = (v) => (v && v[0] + v[1] ? v[0] / (v[0] + v[1]) : NaN);

function popupMun(a) {
  const m = MUNS[a.k];
  const s = a.secoes[0];
  const mv = m?.[4];
  return `<h3>${s.mun} / ${s.uf}</h3>
    <b>${fmt.format(a.eleitores)}</b> eleitores em <b>${a.secoes.length}</b> seções alteradas
    ${m ? `(${pct(a.eleitores / m[1])} do eleitorado)` : ''}<br>
    ${(() => { const n = mudancas(a.secoes).length; return `${n} ${n === 1 ? 'mudança' : 'mudanças'} de local de votação`; })()}<br>
    Distância média: ${km(a.dMed)}<br>
    <b>Seções alteradas:</b> Lula ${fmt.format(a.v[0])} × Bolsonaro ${fmt.format(a.v[1])}
    (${pct(share2(a.v))} Lula)<br>
    ${mv ? `<b>Cidade inteira:</b> Lula ${pct(share2(mv))} × Bolsonaro ${pct(1 - share2(mv))}` : ''}`;
}

function popupSec(s) {
  const v = s.v;
  return `<h3>${s.mun}/${s.uf} · Zona ${s.zona} · Seção ${s.secao}</h3>
    ${fmt.format(s.eleitores)} eleitores · deslocamento ${km(s.d)}<br>
    <b>De:</b> ${s.ini}<br><b>Para:</b> ${s.fin}<br>
    ${v ? `1º turno: Lula ${v[0]} · Bolsonaro ${v[1]} · outros ${v[2]} · brancos ${v[3]} · nulos ${v[4]}`
        : '<i>sem votação no 1º turno</i>'}`;
}

// Agrupa seções que saíram do mesmo local e foram para o mesmo local
const mudancas = (lista) =>
  agrupar(lista, (s) => [s.mk, s.ini, s.fin, s.la1, s.lo1, s.la2, s.lo2].join('|'));

function popupMudanca(g) {
  const s = g.secoes[0];
  const nums = g.secoes.map((x) => (x.zona === s.zona ? x.secao : `${x.secao} (Z${x.zona})`)).join(', ');
  return `<h3>${s.mun}/${s.uf} · Zona ${s.zona}</h3>
    <b>${g.secoes.length} seções</b> · ${fmt.format(g.eleitores)} eleitores · deslocamento ${km(s.d)}<br>
    <b>De:</b> ${s.ini}<br><b>Para:</b> ${s.fin}<br>
    1º turno: Lula ${fmt.format(g.v[0])} · Bolsonaro ${fmt.format(g.v[1])} · outros ${fmt.format(g.v[2])}
    · brancos ${fmt.format(g.v[3])} · nulos ${fmt.format(g.v[4])}<br>
    <span class="note">Seções: ${nums}</span>`;
}

function desenharMapa(lista, ajustar) {
  camadaMun.clearLayers();
  camadaSec.clearLayers();
  const muns = agrupar(lista, (s) => s.mk);
  const max = Math.max(1, ...muns.map((a) => a.eleitores));
  for (const a of muns) {
    const m = MUNS[a.k];
    const lat = m?.[2] ?? a.secoes[0].lat, lon = m?.[3] ?? a.secoes[0].lon;
    if (lat == null) continue;
    L.circleMarker([lat, lon], {
      radius: 4 + 26 * Math.sqrt(a.eleitores / max),
      color: '#fff', weight: 1, fillColor: corDiv(share2(a.v)), fillOpacity: 0.85,
    }).bindPopup(popupMun(a)).addTo(camadaMun);
  }
  // Seções do mesmo local têm as mesmas coordenadas: desenha uma marca por mudança de local
  for (const g of mudancas(lista)) {
    const s = g.secoes[0];
    if (s.lat == null) continue;
    const venc = vencedor(g.v);
    const c = venc === 'lula' ? COR.lula : venc === 'bolso' ? COR.bolso : COR.neutro;
    const r = Math.min(22, 4 + Math.sqrt(g.eleitores) / 6);
    const pop = g.secoes.length === 1 ? popupSec(s) : popupMudanca(g);
    if (s.la1 != null && s.la2 != null && s.d > 0.01) {
      L.polyline([[s.la1, s.lo1], [s.la2, s.lo2]], {
        color: c, weight: Math.min(6, 1.5 + g.secoes.length / 5), opacity: 0.6, dashArray: '4 3',
      }).addTo(camadaSec);
      L.circleMarker([s.la1, s.lo1], { radius: Math.max(3, r * 0.6), color: c, weight: 1.5, fillColor: '#fff', fillOpacity: 1 })
        .bindPopup(pop).addTo(camadaSec);
    }
    L.circleMarker([s.lat, s.lon], { radius: r, color: '#fff', weight: 1, fillColor: c, fillOpacity: 0.9 })
      .bindPopup(pop).addTo(camadaSec);
  }
  const modo = fLayer.value;
  map[modo === 'sec' ? 'removeLayer' : 'addLayer'](camadaMun);
  map[modo === 'mun' ? 'removeLayer' : 'addLayer'](camadaSec);
  if (ajustar) {
    const pts = lista.filter((s) => s.lat != null && s.uf !== 'ZZ').map((s) => [s.lat, s.lon]);
    if (pts.length) map.fitBounds(pts, { padding: [30, 30], maxZoom: 13 });
  }
}

// ---------- Painel ----------
function barra(v) {
  const tot = v.reduce((a, b) => a + b, 0) || 1;
  const partes = [[v[0], COR.lula], [v[1], COR.bolso], [v[2], '#c9a227'], [v[3] + v[4], '#cfcfca']];
  return `<div class="bar">${partes.map(([x, c]) => `<div style="width:${(100 * x) / tot}%;background:${c}"></div>`).join('')}</div>
    <div class="legend"><span style="color:${COR.lula}">Lula ${pct(v[0] / tot)}</span>
    <span style="color:${COR.bolso}">Bolsonaro ${pct(v[1] / tot)}</span>
    <span>Outros ${pct(v[2] / tot)}</span><span>Br+Nulo ${pct((v[3] + v[4]) / tot)}</span></div>`;
}

function divisao(rotulo, lista, campo) {
  let l = 0, b = 0, t = 0;
  for (const s of lista) { t += s.eleitores; if (s[campo] === 'lula') l += s.eleitores; else if (s[campo] === 'bolso') b += s.eleitores; }
  return `<div class="row"><label>${rotulo}</label><div>
    <div class="bar"><div style="width:${(100 * l) / (t || 1)}%;background:${COR.lula}"></div>
    <div style="width:${(100 * b) / (t || 1)}%;background:${COR.bolso}"></div></div>
    <div class="legend"><span>${fmt.format(l)} eleitores (${pct(l / t)})</span><span>${fmt.format(b)} (${pct(b / t)})</span></div>
  </div></div>`;
}

let cenario = 5;
function desenharPainel(lista) {
  const tot = agrupar(lista, () => 'all')[0] || { eleitores: 0, v: [0, 0, 0, 0, 0], dMed: null, secoes: [] };
  const nMun = new Set(lista.map((s) => s.mk)).size, nZona = new Set(lista.map((s) => s.zk)).size;
  const mudou = lista.filter((s) => s.d != null && s.d > 0.05);
  const longe = lista.filter((s) => s.d != null && s.d >= 2).reduce((a, s) => a + s.eleitores, 0);
  document.getElementById('kpis').innerHTML = [
    [fmt.format(lista.length), 'seções alteradas'],
    [fmt.format(tot.eleitores), 'eleitores afetados'],
    [fmt.format(nMun), 'cidades'],
    [fmt.format(nZona), 'zonas'],
    [km(tot.dMed), 'deslocamento médio'],
    [fmt.format(longe), 'eleitores a ≥ 2 km'],
  ].map(([b, s], i) => `<div class="kpi${i === 0 ? ' destaque' : ''}"><b>${b}</b><span>${s}</span></div>`).join('');

  const B = window.BRASIL;
  document.getElementById('votosCard').innerHTML = `
    <div class="note">Seções alteradas (${fmt.format(tot.v.reduce((a, b) => a + b, 0))} votos)</div>${barra(tot.v)}
    <div class="note" style="margin-top:10px">Brasil inteiro (referência)</div>${barra(B)}
    <p class="note" style="margin-bottom:0">Entre os dois: Lula <b>${pct(share2(tot.v))}</b> nas seções alteradas
    contra <b>${pct(share2(B))}</b> no país.</p>`;

  // distância média ponderada pelos votos de cada candidato
  let dl = 0, pl = 0, db = 0, pb = 0, l2 = 0, b2 = 0;
  for (const s of mudou) {
    if (!s.v) continue;
    dl += s.d * s.v[0]; pl += s.v[0]; db += s.d * s.v[1]; pb += s.v[1];
    if (s.d >= 2) { l2 += s.v[0]; b2 += s.v[1]; }
  }
  const margemSec = tot.v[0] - tot.v[1];
  const efeito = (cenario / 100) * margemSec;
  const margemBR = B[1] - B[0];
  document.getElementById('impactoCard').innerHTML = `
    <div class="note">Eleitores afetados, divididos por quem venceu no 1º turno:</div>
    ${divisao('na própria seção', lista, 'venc')}
    ${divisao('na zona eleitoral', lista, 'vencZona')}
    ${divisao('no município', lista, 'vencMun')}
    <table style="margin-top:10px">
      <tr><th></th><th style="color:${COR.lula}">Lula</th><th style="color:${COR.bolso}">Bolsonaro</th></tr>
      <tr><td>Votos (1º turno) nas seções alteradas</td><td>${fmt.format(tot.v[0])}</td><td>${fmt.format(tot.v[1])}</td></tr>
      <tr><td>Deslocamento médio do eleitor</td><td>${km(pl ? dl / pl : null)}</td><td>${km(pb ? db / pb : null)}</td></tr>
      <tr><td>Votos em seções movidas ≥ 2 km</td><td>${fmt.format(l2)}</td><td>${fmt.format(b2)}</td></tr>
    </table>
    <div class="row" style="margin-top:12px"><label>Cenário: abstenção extra de
      <input id="cen" type="number" min="0" max="100" step="1" value="${cenario}" style="width:52px">%</label>
      <div class="note">Se essa fração dos votantes das seções alteradas deixar de votar, igual para os dois lados,
      a margem muda <b style="color:${efeito >= 0 ? COR.bolso : COR.lula}">${fmt.format(Math.round(Math.abs(efeito)))} votos
      a favor de ${efeito >= 0 ? 'Bolsonaro' : 'Lula'}</b>
      (${fmt.format(100 * Math.abs(efeito) / Math.abs(margemBR)).replace(/^0$/, "<0,01")}% da diferença nacional do 1º turno, de ${fmt.format(Math.abs(margemBR))}).</div></div>`;
  document.getElementById('cen').addEventListener('change', (e) => { cenario = +e.target.value || 0; atualizar(false); });
}

// ---------- Tabelas ----------
let aba = 'mun', ordem = { col: 'eleitores', dir: -1 };
const COLS = {
  mun: [
    ['nome', 'Cidade'], ['n', 'Seções'], ['eleitores', 'Eleitores'], ['pctEl', '% eleit.'],
    ['dMed', 'Dist.'], ['sL', '% Lula (seções)'], ['sLc', '% Lula (cidade)'],
  ],
  zona: [
    ['nome', 'Zona'], ['n', 'Seções'], ['eleitores', 'Eleitores'], ['pctEl', '% eleit.'],
    ['dMed', 'Dist.'], ['sL', '% Lula (seções)'], ['sLc', '% Lula (zona)'],
  ],
  sec: [
    ['nome', 'Seção'], ['eleitores', 'Eleitores'], ['dMed', 'Dist.'], ['sL', '% Lula'], ['vL', 'Lula'], ['vB', 'Bolso.'],
  ],
};

function linhas(lista) {
  if (aba === 'sec') {
    return lista.map((s) => ({
      ref: s, nome: `${s.mun}/${s.uf} · Z${s.zona} S${s.secao}`, eleitores: s.eleitores, dMed: s.d,
      sL: share2(s.v), vL: s.v?.[0] ?? null, vB: s.v?.[1] ?? null, lat: s.lat, lon: s.lon,
    }));
  }
  const porMun = aba === 'mun';
  return agrupar(lista, (s) => (porMun ? s.mk : s.zk)).map((a) => {
    const s = a.secoes[0];
    const ref = porMun ? MUNS[a.k] : ZONAS[a.k];
    const eleit = porMun ? ref?.[1] : ref?.[0];
    const v = porMun ? ref?.[4] : ref?.[1];
    return {
      a, nome: porMun ? `${s.mun}/${s.uf}` : `${s.uf} · Zona ${s.zona} (${s.mun})`, n: a.secoes.length,
      eleitores: a.eleitores, pctEl: eleit ? a.eleitores / eleit : NaN, dMed: a.dMed,
      sL: share2(a.v), sLc: share2(v),
    };
  });
}

function celula(c, r) {
  const x = r[c];
  if (c === 'nome') {
    const cor = corDiv(r.sL);
    return `<span class="tag" style="background:${cor}"></span>${x}`;
  }
  if (c === 'dMed') return km(x);
  if (c === 'pctEl' || c === 'sL' || c === 'sLc') return pct(x);
  return x == null ? '–' : fmt.format(x);
}

function desenharTabela(lista) {
  const rows = linhas(lista);
  const { col, dir } = ordem;
  rows.sort((a, b) => {
    const x = a[col], y = b[col];
    if (typeof x === 'string') return dir * x.localeCompare(y);
    const nx = x == null || isNaN(x), ny = y == null || isNaN(y);
    if (nx || ny) return nx - ny;
    return dir * (x - y);
  });
  const cols = COLS[aba];
  const t = document.getElementById('tabela');
  t.innerHTML = `<thead><tr>${cols.map(([c, l]) => `<th data-c="${c}">${l}${c === col ? (dir < 0 ? ' ↓' : ' ↑') : ''}</th>`).join('')}</tr></thead>
    <tbody>${rows.map((r, i) => `<tr data-i="${i}">${cols.map(([c]) => `<td>${celula(c, r)}</td>`).join('')}</tr>`).join('')}</tbody>`;
  t.querySelectorAll('th').forEach((th) => th.addEventListener('click', () => {
    const c = th.dataset.c;
    ordem = { col: c, dir: ordem.col === c ? -ordem.dir : c === 'nome' ? 1 : -1 };
    desenharTabela(lista);
  }));
  t.querySelectorAll('tbody tr').forEach((tr) => tr.addEventListener('click', () => {
    const r = rows[+tr.dataset.i];
    if (r.ref) {
      if (r.lat != null) map.setView([r.lat, r.lon], 15);
      if (fLayer.value === 'mun') { fLayer.value = 'both'; desenharMapa(filtradas(), false); }
      L.popup().setLatLng([r.lat, r.lon]).setContent(popupSec(r.ref)).openOn(map);
    } else {
      const pts = r.a.secoes.filter((s) => s.lat != null).map((s) => [s.lat, s.lon]);
      if (pts.length) map.fitBounds(pts, { padding: [40, 40], maxZoom: 14 });
      if (fLayer.value === 'mun') { fLayer.value = 'both'; desenharMapa(filtradas(), false); }
    }
  }));
}

document.querySelectorAll('.tabs button').forEach((b) => b.addEventListener('click', () => {
  document.querySelectorAll('.tabs button').forEach((x) => x.classList.toggle('on', x === b));
  aba = b.dataset.t;
  ordem = { col: 'eleitores', dir: -1 };
  desenharTabela(filtradas());
}));

function atualizar(ajustar) {
  const lista = filtradas();
  desenharMapa(lista, ajustar);
  desenharPainel(lista);
  desenharTabela(lista);
}

fUf.addEventListener('change', () => atualizar(true));
fDist.addEventListener('change', () => atualizar(false));
fLayer.addEventListener('change', () => desenharMapa(filtradas(), false));

const semVoto = secoes.filter((s) => !s.v).length;
const semCoord = secoes.filter((s) => s.d == null).length;
document.getElementById('rodape').innerHTML =
  `Fonte: TSE, dados abertos — seções alteradas para o 2º turno, votação por seção (Presidente, 1º turno, 04/10/2026)
  e cadastro de locais de votação (coordenadas do 1º e do 2º turno). ${semVoto} seções sem votação no 1º turno;
  ${semCoord} sem coordenadas nos dois turnos (ficam fora do cálculo de distância e aparecem no centro do município).
  Distância é em linha reta entre o local antigo e o novo; não indica se ficou mais perto ou mais longe da casa do eleitor.`;

desenharHistorico();
atualizar(true);
