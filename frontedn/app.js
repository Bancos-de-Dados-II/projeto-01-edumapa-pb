/* ═══════════════════════════════════════════════════════
   DATA
═══════════════════════════════════════════════════════ */
const STATE_TOTAL = {
  escolas: 4891, municipios: 223, matriculas: 1200000, docentes: 47000,
  redes: { municipal: 2814, estadual: 1203, federal: 58, privada: 816 },
  ideb:  { municipal: 4.2,  estadual: 4.8,  federal: 6.1, privada: 5.5 }
};

const DEFAULT_MUNICIPIOS = [
  { id:'joaopessoa',  nome:'João Pessoa',    lat:-7.115, lng:-34.863,
    escolas:580, matriculas:280000, docentes:12000,
    redes:{ municipal:320, estadual:140, federal:12, privada:108 },
    ideb:{ municipal:4.5, estadual:5.0, federal:6.2, privada:5.6 } },
  { id:'campinagr',   nome:'Campina Grande', lat:-7.230, lng:-35.881,
    escolas:420, matriculas:185000, docentes:8200,
    redes:{ municipal:240, estadual:105, federal:8,  privada:67  },
    ideb:{ municipal:4.3, estadual:4.9, federal:6.0, privada:5.4 } },
  { id:'sousa',       nome:'Sousa',          lat:-6.760, lng:-38.228,
    escolas:85,  matriculas:28000,  docentes:1100,
    redes:{ municipal:50,  estadual:22,  federal:3,  privada:10  },
    ideb:{ municipal:4.0, estadual:4.4, federal:6.1, privada:5.2 } },
  { id:'patos',       nome:'Patos',          lat:-7.022, lng:-37.280,
    escolas:110, matriculas:42000,  docentes:1700,
    redes:{ municipal:62,  estadual:30,  federal:2,  privada:16  },
    ideb:{ municipal:4.2, estadual:4.7, federal:5.9, privada:5.3 } },
  { id:'cajazeiras',  nome:'Cajazeiras',     lat:-6.890, lng:-38.558,
    escolas:70,  matriculas:22000,  docentes:880,
    redes:{ municipal:38,  estadual:20,  federal:2,  privada:10  },
    ideb:{ municipal:3.9, estadual:4.3, federal:5.8, privada:5.0 } },
  { id:'guarabira',   nome:'Guarabira',      lat:-6.851, lng:-35.490,
    escolas:65,  matriculas:20000,  docentes:800,
    redes:{ municipal:36,  estadual:18,  federal:1,  privada:10  },
    ideb:{ municipal:4.1, estadual:4.5, federal:5.7, privada:5.1 } },
  { id:'santarita',   nome:'Santa Rita',     lat:-7.121, lng:-34.978,
    escolas:95,  matriculas:35000,  docentes:1400,
    redes:{ municipal:55,  estadual:28,  federal:2,  privada:10  },
    ideb:{ municipal:3.8, estadual:4.2, federal:5.5, privada:4.9 } },
  { id:'bayeux',      nome:'Bayeux',         lat:-7.133, lng:-34.932,
    escolas:75,  matriculas:25000,  docentes:1000,
    redes:{ municipal:44,  estadual:20,  federal:1,  privada:10  },
    ideb:{ municipal:3.7, estadual:4.1, federal:5.4, privada:4.8 } },
];

/* deterministic RNG */
function makeRng(seed) {
  let s = Math.abs(seed) % 2147483647 || 1;
  return () => { s = (s * 16807) % 2147483647; return (s-1)/2147483646; };
}

let SCHOOLS = {};
let MUNICIPIOS = DEFAULT_MUNICIPIOS;

async function fetchSchoolsFromBackend() {
  try {
    const relUrl = `${API_BASE}/escolas`;
    const absUrl = (window.location.origin || (window.location.protocol + '//' + window.location.host)) + relUrl;
    let res;
    try {
      res = await fetch(relUrl, { cache:'no-store', mode:'cors' });
    } catch (err) {
      console.warn('fetch relative failed, trying absolute for escolas', relUrl, absUrl, err);
      res = await fetch(absUrl, { cache:'no-store', mode:'cors' });
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch (err) {
    console.error('Erro ao carregar escolas do backend:', err);
    const el = document.getElementById('vis-count');
    if (el) el.textContent = 'Erro ao carregar escolas (ver console)';
    return [];
  }
}

/* ═══════════════════════════════════════════════════════
   APP STATE
═══════════════════════════════════════════════════════ */
const app = {
  municipio: null,
  escola:    null,
  etapa:     '',
  redes:     { municipal:true, estadual:true, federal:true, privada:true }
};

const COLORS = {
  municipal:'#a3be8c', estadual:'#d08770', federal:'#88afd4', privada:'#c3a0d6'
};

const API_BASE = '/api';

function normalizeId(value) {
  return String(value)
     .normalize('NFD')
     .replace(/[\u0300-\u036f]/g, '')
    .normalize('NFC')
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-_]/g, '');
}

function getGeometryCenter(geometry) {
  if (!geometry) return [0, 0];
  if (geometry.type === 'Point') return geometry.coordinates;

  const coords = [];
  const addCoords = arr => arr.forEach(item => {
    if (typeof item[0] === 'number') coords.push(item);
    else addCoords(item);
  });
  addCoords(geometry.coordinates);

  const sum = coords.reduce((acc, coord) => [acc[0] + coord[0], acc[1] + coord[1]], [0, 0]);
  return [sum[0] / coords.length, sum[1] / coords.length];
}

async function fetchMunicipiosFromBackend() {
  try {
    const relUrl = `${API_BASE}/municipios`;
    const absUrl = (window.location.origin || (window.location.protocol + '//' + window.location.host)) + relUrl;
    let response;
    try {
      response = await fetch(relUrl, { cache: 'no-store', mode: 'cors' });
    } catch (err) {
      console.warn('fetch relative failed, trying absolute', relUrl, absUrl, err);
      response = await fetch(absUrl, { cache: 'no-store', mode: 'cors' });
    }
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    if (!data.features) throw new Error('Resposta inválida do backend');
    return data.features.map(feature => {
      const name = feature.properties.nome || 'Desconhecido';
      return {
        id: normalizeId(String(feature.properties.id_municipio || name)),
        apiId: feature.properties.id_municipio,
        nome: name,
        lat: getGeometryCenter(feature.geometry)[1],
        lng: getGeometryCenter(feature.geometry)[0],
        geometry: feature.geometry
      };
    });
  } catch (error) {
    console.error('Erro ao carregar municípios do backend:', error);
    const selMun = document.getElementById('sel-mun');
    if (selMun) selMun.innerHTML = '<option value="">(Erro ao carregar municípios)</option>';
    return [];
  }
}

function mergeMunicipios(apiMuns) {
  return apiMuns.map(apiMuni => {
    const local = DEFAULT_MUNICIPIOS.find(m => m.nome === apiMuni.nome || m.id === apiMuni.id);
    if (local) return { ...apiMuni, ...local, id: local.id, apiId: apiMuni.apiId };
    return { ...apiMuni, apiId: apiMuni.apiId };
  });
}

function populateMunicipioSelect() {
  const selMun = document.getElementById('sel-mun');
  selMun.innerHTML = '<option value="">Todo o Estado</option>';
  MUNICIPIOS.forEach(m => {
    const o = document.createElement('option');
    o.value = m.id;
    o.textContent = m.nome;
    selMun.appendChild(o);
  });
}

async function initApp() {
  const apiMunicipios = await fetchMunicipiosFromBackend();
  if (apiMunicipios.length) {
    MUNICIPIOS = mergeMunicipios(apiMunicipios);
  } else {
    MUNICIPIOS = DEFAULT_MUNICIPIOS;
  }
  // SCHOOLS será carregado on-demand quando o usuário clicar em um município
  SCHOOLS = {};
  renderMunis();
  populateMunicipioSelect();
  updateStats(null);
  updateCharts(null);
}

/* ═══════════════════════════════════════════════════════
   MAP SETUP
═══════════════════════════════════════════════════════ */
const map = L.map('map', {
  zoomControl:false,
  minZoom: 7,
  maxZoom: 16,
  // constrain latitude (Y) between approx. Paraíba bounds, allow full horizontal panning
  maxBounds: [[-8.5, -180], [-4.0, 180]],
  maxBoundsViscosity: 0.95,
  worldCopyJump: true
}).setView([-7.2,-36.5], 7);

L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
  attribution:'&copy; OpenStreetMap &copy; CARTO',
  subdomains:'abcd', maxZoom:19
}).addTo(map);

L.control.zoom({ position:'topright' }).addTo(map);

/* Cluster group for school markers */
const cluster = L.markerClusterGroup({
  chunkedLoading: true,
  maxClusterRadius: 48,
  iconCreateFunction(c) {
    const n = c.getChildCount();
    const sz = n<10?30:n<50?36:42;
    return L.divIcon({
      html:`<div style="width:${sz}px;height:${sz}px;border-radius:50%;background:rgba(78,127,255,.82);border:2px solid rgba(78,127,255,.35);display:flex;align-items:center;justify-content:center;color:#fff;font-family:'DM Mono',monospace;font-weight:500;font-size:${n<10?12:11}px">${n}</div>`,
      className:'', iconSize:[sz,sz], iconAnchor:[sz/2,sz/2]
    });
  }
});
map.addLayer(cluster);

/* Municipality bubble layer */
const muniLayer = L.layerGroup().addTo(map);

function renderMunis() {
  const maxEsc = Math.max(...MUNICIPIOS.map(m=>Number(m.escolas||0))) || 1;
  muniLayer.clearLayers();
  MUNICIPIOS.forEach(m => {
    const escolasCount = Number(m.escolas||0);
    const matriculasCount = Number(m.matriculas||0);
    const r = Math.sqrt(escolasCount/maxEsc)*40+14; // aumentado para facilitar clique
    const c = L.circleMarker([m.lat,m.lng],{
      radius:r,
      fillColor:'#4e7fff', fillOpacity:.18,
      color:'#4e7fff',     weight:1.6,    opacity:.65,
      interactive: true
    });
    const escText = escolasCount ? escolasCount.toLocaleString('pt-BR') + ' escolas' : 'Sem dados de escolas';
    const matText = matriculasCount ? `${(matriculasCount/1000).toFixed(0)}k matrículas` : '';
    c.bindTooltip(
      `<strong>${m.nome}</strong><br><span style="color:#5e6480;font-size:11px">${escText}${matText? ' · ' + matText: ''}</span>`,
      { className:'muni-tip', direction:'top' }
    );
    c.on('click', () => pickMuni(m));
    muniLayer.addLayer(c);
  });
}
renderMunis();

/* ═══════════════════════════════════════════════════════
   SELECT MUNICÍPIO
═══════════════════════════════════════════════════════ */
async function pickMuni(m) {
  console.debug('pickMuni called for', m);
  app.municipio = m;
  app.escola    = null;

  map.flyTo([m.lat,m.lng], 12, { duration:1.1 });

  muniLayer.clearLayers(); // hide bubbles while zoomed in

  showSkel();
  try {
    await loadSchools(m);
  } catch (e) {
    console.error('Erro ao carregar escolas no pickMuni:', e);
  }
  hideSkel();
  // atualiza estatísticas a partir dos dados carregados (se houver)
  updateStats(m);
  updateCharts(m);

  document.getElementById('map-bar').classList.add('show');
  document.getElementById('map-city').textContent = m.nome;
  document.getElementById('sel-mun').value = m.id;
  document.getElementById('clear-btn').classList.add('show');
  showCharts();
}

function clearMuni() {
  console.debug('clearMuni called');
  app.municipio = null;
  app.escola    = null;

  map.flyTo([-7.2,-36.5], 7, { duration:1.1 });
  cluster.clearLayers();
  renderMunis();

  document.getElementById('map-bar').classList.remove('show');
  document.getElementById('sel-mun').value = '';
  document.getElementById('clear-btn').classList.remove('show');
  document.getElementById('vis-count').textContent = 'Selecione um município';

  showSkel();
  setTimeout(() => {
    hideSkel();
    updateStats(null);
    updateCharts(null);
  }, 400);
  showCharts();
}

async function loadSchools(m) {
  cluster.clearLayers();

  let schools = SCHOOLS[m.id] || [];

  // se município tiver apiId, tente buscar escolas reais do backend por município
  if (m.apiId) {
    try {
      const url = `${API_BASE}/escolas?municipio=${m.apiId}`;
      console.debug('Fetching escolas for municipio', m.apiId, 'url', url);
      const resp = await fetch(url);
      if (resp.ok) {
        const data = await resp.json();
        console.debug('Escolas response length:', Array.isArray(data)?data.length:0);
        if (Array.isArray(data) && data.length) {
          schools = data.map(s => {
            const rede = s.rede_ensino==1 ? 'federal' : s.rede_ensino==2 ? 'estadual' : s.rede_ensino==3 ? 'municipal' : s.rede_ensino==4 ? 'privada' : 'municipal';
            const etapas = [];
            if (Number(s.oferece_infantil)) etapas.push('EI');
            if (Number(s.oferece_fundamental)) etapas.push('EF');
            if (Number(s.oferece_medio)) etapas.push('EM');
            if (Number(s.oferece_eja)) etapas.push('EJA');
            if (Number(s.oferece_profissional)) etapas.push('EP');
            return {
              id: s.id_escola || `${m.id}-${Math.random().toString(36).slice(2,8)}`,
              nome: s.nome || 'Sem nome',
              rede,
              lat: s.latitude || (m.lat + (Math.random()-.5)*.06),
              lng: s.longitude || (m.lng + (Math.random()-.5)*.06),
              alunos: Number(s.total_matriculas || 0),
              ideb: Number(s.ideb || 0),
              etapas,
              municipio: m.nome,
              total_matriculas: Number(s.total_matriculas || 0),
              total_docentes: Number(s.total_docentes || 0)
            };
            });
        }
      }
    } catch (err) {
      console.error('Erro ao buscar escolas por município:', err);
    }
  }

    // armazena escolas carregadas
    SCHOOLS[m.id] = schools;

    // agrega estatísticas no objeto do município para exibição
    try {
      const st = { escolas:0, matriculas:0, docentes:0, redes:{ municipal:0, estadual:0, federal:0, privada:0 }, idebSum:0, idebCount:0 };
      schools.forEach(s => {
        st.escolas += 1;
        st.matriculas += Number(s.total_matriculas || s.alunos || 0);
        st.docentes += Number(s.total_docentes || 0);
        const rk = s.rede || (s.rede_ensino==1? 'federal' : s.rede_ensino==2? 'estadual' : s.rede_ensino==3? 'municipal' : s.rede_ensino==4? 'privada' : 'municipal');
        st.redes[rk] = (st.redes[rk] || 0) + 1;
        if (s.ideb) { st.idebSum += Number(s.ideb); st.idebCount += 1; }
      });
      m.escolas = st.escolas;
      m.matriculas = st.matriculas;
      m.docentes = st.docentes;
      m.redes = st.redes;
      m.ideb = st.idebCount ? +(st.idebSum / st.idebCount).toFixed(1) : 0;
    } catch (err) {
      console.warn('Erro ao agregar estatísticas do município:', err);
    }

  schools.forEach(s => {
    if (!app.redes[s.rede]) return;
    if (app.etapa && !s.etapas.includes(app.etapa)) return;
    const col = COLORS[s.rede];
    const icon = L.divIcon({
      html: `
        <div style="width:28px;height:28px;display:flex;align-items:center;justify-content:center;">
          <div style="width:11px;height:11px;border-radius:50%;background:${col};border:2px solid rgba(255,255,255,.25);box-shadow:0 0 7px ${col}66"></div>
        </div>
      `,
      className:'', iconSize:[28,28], iconAnchor:[14,14]
    });
    const mk = L.marker([s.lat,s.lng],{icon, interactive:true, keyboard:true, title: s.nome});
    mk.on('click', () => pickEscola(s));
    cluster.addLayer(mk);
  });

  const cnt = cluster.getLayers().length;
  document.getElementById('vis-count').textContent = cnt ? `${cnt} escolas visíveis` : 'Nenhuma escola encontrada';
}

/* ═══════════════════════════════════════════════════════
   SELECT ESCOLA
═══════════════════════════════════════════════════════ */
function pickEscola(s) {
  app.escola = s;
  document.getElementById('panel-charts').classList.add('hide');
  document.getElementById('panel-escola').classList.add('show');

  const col = COLORS[s.rede];
  const eTags = s.etapas.map(e=>`<span class="tag etapa">${e}</span>`).join('');
  document.getElementById('escola-content').innerHTML = `
    <div class="esc-card">
      <h2>${s.nome}</h2>
      <p class="esc-sub">${s.municipio}</p>
      <div class="esc-stats">
        <div class="esc-stat">
          <span class="v">${Number(s.alunos).toLocaleString('pt-BR')}</span>
          <span class="l">Alunos</span>
        </div>
        <div class="esc-stat">
          <span class="v" style="color:${col}">${s.ideb}</span>
          <span class="l">IDEB</span>
        </div>
      </div>
      <div class="tag-row">
        <span class="tag ${s.rede}">${s.rede[0].toUpperCase()+s.rede.slice(1)}</span>
        ${eTags}
      </div>
    </div>
  `;
}

function showCharts() {
  document.getElementById('panel-escola').classList.remove('show');
  document.getElementById('panel-charts').classList.remove('hide');
}

/* ═══════════════════════════════════════════════════════
   COUNT-UP ANIMATION
═══════════════════════════════════════════════════════ */
function countUp(el, to, dur, fmt) {
  const t0 = performance.now();
  const from = 0;
  (function tick(now) {
    const p = Math.min((now-t0)/dur, 1);
    const e = 1-Math.pow(1-p,3);
    el.textContent = fmt(Math.round(from + (to-from)*e));
    if(p<1) requestAnimationFrame(tick);
  })(t0);
}

const fmtN = v => v >= 1e6 ? (v/1e6).toFixed(1)+'M' : v >= 1e3 ? (v/1e3).toFixed(v>=10000?0:1)+'k' : v.toLocaleString('pt-BR');
const fmtI = v => v.toLocaleString('pt-BR');

function updateStats(m) {
  const d = m ? { escolas: Number(m.escolas||0), municipios:1, matriculas: Number(m.matriculas||0), docentes: Number(m.docentes||0), redes: m.redes || { municipal:0, estadual:0, federal:0, privada:0 } }
              : { escolas:STATE_TOTAL.escolas, municipios:STATE_TOTAL.municipios, matriculas:STATE_TOTAL.matriculas, docentes:STATE_TOTAL.docentes, redes:STATE_TOTAL.redes };

  countUp(document.getElementById('sv-escolas'), d.escolas,    820, fmtN);
  countUp(document.getElementById('sv-munis'),   d.municipios, 780, v=>v.toString());
  countUp(document.getElementById('sv-mats'),    d.matriculas, 900, fmtN);
  countUp(document.getElementById('sv-docs'),    d.docentes,   850, fmtN);

  countUp(document.getElementById('cnt-municipal'), d.redes.municipal, 780, fmtI);
  countUp(document.getElementById('cnt-estadual'),  d.redes.estadual,  800, fmtI);
  countUp(document.getElementById('cnt-federal'),   d.redes.federal,   760, fmtI);
  countUp(document.getElementById('cnt-privada'),   d.redes.privada,   820, fmtI);
}

/* ═══════════════════════════════════════════════════════
   SKELETON
═══════════════════════════════════════════════════════ */
function showSkel() {
  ['sv-escolas','sv-munis','sv-mats','sv-docs'].forEach(id=>{
    const el = document.getElementById(id);
    el.classList.add('skel');
    el.textContent = '000';
  });
}
function hideSkel() {
  ['sv-escolas','sv-munis','sv-mats','sv-docs'].forEach(id=>{
    document.getElementById(id).classList.remove('skel');
  });
}

/* ═══════════════════════════════════════════════════════
   CHARTS
═══════════════════════════════════════════════════════ */
function drawDonut(redes) {
  const defs = [
    {key:'municipal', label:'Municipal', color:'#a3be8c'},
    {key:'estadual',  label:'Estadual',  color:'#d08770'},
    {key:'federal',   label:'Federal',   color:'#88afd4'},
    {key:'privada',   label:'Privada',   color:'#c3a0d6'},
  ];
  const total = defs.reduce((a,d)=>a+redes[d.key],0);
  let ang = -Math.PI/2;
  const cx=72,cy=72,R=62,r=42;
  let paths='';

  defs.forEach(d=>{
    const v = redes[d.key]||0;
    if(!v) return;
    const a = (v/total)*2*Math.PI;
    const ea = ang+a;
    const gap = .03; // small gap between slices
    const ga = ang+gap, gea = ea-gap;
    const [x1,y1]=[cx+R*Math.cos(ga),  cy+R*Math.sin(ga)];
    const [x2,y2]=[cx+R*Math.cos(gea), cy+R*Math.sin(gea)];
    const [x3,y3]=[cx+r*Math.cos(gea), cy+r*Math.sin(gea)];
    const [x4,y4]=[cx+r*Math.cos(ga),  cy+r*Math.sin(ga)];
    const la = a>Math.PI?1:0;
    paths += `<path d="M${x1.toFixed(2)},${y1.toFixed(2)} A${R},${R},0,${la},1,${x2.toFixed(2)},${y2.toFixed(2)} L${x3.toFixed(2)},${y3.toFixed(2)} A${r},${r},0,${la},0,${x4.toFixed(2)},${y4.toFixed(2)}Z" fill="${d.color}" opacity=".9"/>`;
    ang = ea;
  });

  const tf = total>=1e6?(total/1e6).toFixed(1)+'M':total>=1e3?(total/1e3).toFixed(1)+'k':total;

  const svg = `<svg viewBox="0 0 144 144" width="128" height="128" xmlns="http://www.w3.org/2000/svg" style="flex-shrink:0">
    ${paths}
    <text x="${cx}" y="${cy-5}" text-anchor="middle" fill="#eef0f8" font-size="17" font-weight="600" font-family="'DM Mono',monospace">${tf}</text>
    <text x="${cx}" y="${cy+12}" text-anchor="middle" fill="#5e6480" font-size="9.5" font-family="'DM Sans',sans-serif">escolas</text>
  </svg>`;

  const legHtml = defs.map(d=>{
    const pct = total ? ((redes[d.key]/total)*100).toFixed(0) : 0;
    return `<div class="leg-row">
      <div class="leg-name"><span class="dot ${d.key}"></span>${d.label}</div>
      <span class="leg-pct">${pct}%</span>
    </div>`;
  }).join('');

  document.getElementById('donut-row').innerHTML =
    svg + `<div class="donut-legend">${legHtml}</div>`;
}

function drawIdeb(ideb) {
  const defs = [
    {key:'municipal',label:'Municipal',color:'#a3be8c'},
    {key:'estadual', label:'Estadual', color:'#d08770'},
    {key:'federal',  label:'Federal',  color:'#88afd4'},
    {key:'privada',  label:'Privada',  color:'#c3a0d6'},
  ];
  const cont = document.getElementById('ideb-bars');
  cont.innerHTML = defs.map(d=>{
    const v = ideb[d.key]||0;
    const pct = (v/10)*100;
    return `<div class="ideb-row">
      <div class="ideb-lbl"><span class="dot ${d.key}"></span>${d.label}</div>
      <div class="ideb-track"><div class="ideb-fill" data-p="${pct}" style="width:0;background:${d.color}"></div></div>
      <span class="ideb-num">${v.toFixed(1)}</span>
    </div>`;
  }).join('');
  // animate in
  setTimeout(()=>{
    cont.querySelectorAll('.ideb-fill').forEach(el=>{
      el.style.width = el.dataset.p + '%';
    });
  },50);
}

function drawRanking(m) {
  let schools = m ? (SCHOOLS[m.id]||[]) : Object.values(SCHOOLS).flat();
  const top5 = schools.slice().sort((a,b)=>parseFloat(b.ideb)-parseFloat(a.ideb)).slice(0,5);
  const medals = ['🥇','🥈','🥉','4°','5°'];
  document.getElementById('rank-list').innerHTML = top5.map((s,i)=>`
    <div class="rank-item" onclick="pickEscola(${JSON.stringify(s).replace(/"/g,'&quot;')})">
      <span class="rank-num">${medals[i]}</span>
      <span class="rank-name">${s.nome}</span>
      <span class="rank-ideb">${s.ideb}</span>
    </div>
  `).join('');
}

function updateCharts(m) {
  const redes = m ? m.redes : STATE_TOTAL.redes;
  const ideb  = m ? m.ideb  : STATE_TOTAL.ideb;
  drawDonut(redes);
  drawIdeb(ideb);
  drawRanking(m);
}

// Initial render
initApp();

/* ═══════════════════════════════════════════════════════
   CONTROLS WIRING
════════════════════════════════════════════════════════ */

// Populate municipio select
const selMun = document.getElementById('sel-mun');
selMun.addEventListener('change', e=>{
  const id = e.target.value;
  if(!id){ clearMuni(); return; }
  const m = MUNICIPIOS.find(m=>m.id===id);
  if(m) pickMuni(m);
});

// Clear buttons
document.getElementById('clear-btn').addEventListener('click', clearMuni);
document.getElementById('map-bar-x').addEventListener('click', clearMuni);

// Back button
document.getElementById('back-btn').addEventListener('click', ()=>{
  app.escola = null;
  showCharts();
  updateCharts(app.municipio);
});

// Etapa filter
document.getElementById('sel-etapa').addEventListener('change', e=>{
  app.etapa = e.target.value;
  if(app.municipio) loadSchools(app.municipio);
});

// Rede toggle (click hides/shows on map + dims item)
document.querySelectorAll('.rede-item').forEach(item=>{
  item.addEventListener('click', ()=>{
    const rede = item.dataset.rede;
    app.redes[rede] = !app.redes[rede];
    item.classList.toggle('off', !app.redes[rede]);
    if(app.municipio) loadSchools(app.municipio);
  });
});

/* ═══════════════════════════════════════════════════════
   MAP zoom reset → show municipality bubbles again
════════════════════════════════════════════════════════ */
map.on('zoomend', ()=>{
  if(app.municipio && map.getZoom() < 10) {
    cluster.clearLayers();
    renderMunis();
    document.getElementById('vis-count').textContent = 'Selecione um município';
  }
});

/* end */
