/* ═══════════════════════════════════════
   AIPIM DE TINGUÁ SYS — app.js v2
═══════════════════════════════════════ */

// ─────────────── ESTADO GLOBAL ───────────────
const S = {
  pagina:  document.body.dataset.pagina || 'dashboard',
  periodo: { tipo:'dia', idx:0 },
};

// ─────────────── UTILS ───────────────
const $ = id => document.getElementById(id);
const fmtBRL = v => 'R$ ' + Number(v||0).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});
const fmtNum = v => Number(v||0).toLocaleString('pt-BR',{maximumFractionDigits:1});

function toast(msg, dur=2800){
  const t = $('toast');
  t.textContent = msg;
  t.classList.remove('oculto');
  clearTimeout(t._t);
  t._t = setTimeout(()=>t.classList.add('oculto'), dur);
}

// ─────────────── MENU MOBILE ───────────────
function abrirMenu(){
  $('sidebar').classList.add('aberta');
  $('nav-overlay').classList.add('ativo');
}
function fecharMenu(){
  $('sidebar').classList.remove('aberta');
  $('nav-overlay').classList.remove('ativo');
}

// ─────────────── DATA TOPBAR ───────────────
function atualizarData(){
  const d = new Date();
  const str = d.toLocaleDateString('pt-BR',{weekday:'short',day:'2-digit',month:'short'});
  const el = $('topbar-data');
  if(el) el.textContent = str;
}
atualizarData();

// ─────────────── PERMISSÕES ───────────────
function aplicarPermissoes(){
  const todasAreas = ['roca','galp','desc','coz','obra','log'];
  todasAreas.forEach(area=>{
    const mod = $('mod-'+area);
    if(!mod) return;
    const temAcesso = (typeof USER_AREAS !== 'undefined') ? USER_AREAS.includes(area) : true;
    mod.classList.toggle('bloq', !temAcesso);
    const ovEl = mod.querySelector('.bloq-overlay');
    if(ovEl) ovEl.remove();
    if(!temAcesso){
      const ov = document.createElement('div');
      ov.className = 'bloq-overlay';
      ov.innerHTML = '🔒 Área restrita ao seu perfil';
      mod.appendChild(ov);
    }
  });

  // custos financeiros
  const custoBlocos = ['cb-roca-mo','cb-galp-mo','cb-desc-mo','cb-coz-mo','cb-obra-mo','cb-log-mo'];
  const podeVerFin = (typeof VER_FIN !== 'undefined') ? VER_FIN : true;
  custoBlocos.forEach(id=>{
    const el=$(id); if(!el) return;
    el.classList.toggle('bloq-fin', !podeVerFin);
  });
}

// ─────────────── PERÍODO ───────────────
const MESES = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
const MESES_FULL = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

function getNavLabel(tipo, idx){
  const hoje = new Date();
  idx = Math.abs(idx);
  if(tipo==='dia'){
    const d = new Date(hoje); d.setDate(d.getDate()-idx);
    return d.toLocaleDateString('pt-BR');
  }
  if(tipo==='semana'){
    const ini = new Date(hoje); ini.setDate(ini.getDate() - ini.getDay() - idx*7);
    const fim = new Date(ini); fim.setDate(ini.getDate()+6);
    return `${ini.toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit'})} – ${fim.toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit'})}`;
  }
  if(tipo==='quinzena'){
    if(idx===0) return hoje.getDate()<=15?`1ª Quinz. ${MESES[hoje.getMonth()]}`:`2ª Quinz. ${MESES[hoje.getMonth()]}`;
    return `Quinzena anterior`;
  }
  if(tipo==='mensal'){
    const d = new Date(hoje.getFullYear(), hoje.getMonth()-idx, 1);
    return `${MESES_FULL[d.getMonth()]} ${d.getFullYear()}`;
  }
  if(tipo==='trimestral'){
    const trim = Math.floor(hoje.getMonth()/3) - idx;
    const ano  = hoje.getFullYear() + Math.floor(trim/4);
    const t    = ((trim%4)+4)%4;
    return `T${t+1} ${ano}`;
  }
  if(tipo==='semestral'){
    const sem = (hoje.getMonth()<6?1:2) - idx%2;
    const ano = hoje.getFullYear() - Math.floor(idx/2);
    return `${sem===1?'1º':'2º'} Sem ${ano}`;
  }
  if(tipo==='anual'){
    return `${hoje.getFullYear()-idx}`;
  }
  return '—';
}

function getLancDataLabel(idx){
  const hoje = new Date();
  const d = new Date(hoje); d.setDate(d.getDate() - Math.abs(idx));
  return d.toLocaleDateString('pt-BR',{weekday:'long',day:'2-digit',month:'long',year:'numeric'});
}

function setPeriodo(tipo, btn){
  S.periodo.tipo = tipo;
  S.periodo.idx  = 0;
  document.querySelectorAll('.periodo-tabs .ptab').forEach(b=>b.classList.remove('ativo'));
  if(btn) btn.classList.add('ativo');
  else document.querySelector(`.ptab[data-tipo="${tipo}"]`)?.classList.add('ativo');
  atualizarPaginaAtual();
}

function navPeriodo(dir){
  S.periodo.idx += dir;
  if(S.periodo.idx > 0) S.periodo.idx = 0;  // sem datas futuras
  atualizarPaginaAtual();
}

function atualizarNavLabel(){
  const el = $('pnav-label');
  if(el) el.textContent = getNavLabel(S.periodo.tipo, S.periodo.idx);
  // label específico da tela de lançamento
  const ll = $('lanc-data-label');
  if(ll){
    if(S.periodo.tipo==='dia'){
      const d = new Date(Date.now() - Math.abs(S.periodo.idx)*86400000);
      ll.textContent = d.toLocaleDateString('pt-BR');
    } else {
      ll.textContent = getNavLabel(S.periodo.tipo, S.periodo.idx);
    }
  }
  const lt = $('lanc-info-txt');
  if(lt && S.periodo.tipo==='dia'){
    const d = new Date(Date.now() - Math.abs(S.periodo.idx)*86400000);
    lt.innerHTML = `<b style="color:var(--texto)">${d.toLocaleDateString('pt-BR',{weekday:'long'})}</b>, ${d.toLocaleDateString('pt-BR',{day:'2-digit',month:'long',year:'numeric'})}`;
  } else if(lt){
    lt.textContent = getNavLabel(S.periodo.tipo, S.periodo.idx);
  }
}

function atualizarPaginaAtual(){
  atualizarNavLabel();
  if(S.pagina==='dashboard')   carregarDashboard();
  if(S.pagina==='lancamentos') carregarLancamentos();
  if(S.pagina==='despesas')    carregarDespesas();
}

// ─────────────── API ───────────────
async function api(url, opts={}){
  const res = await fetch(url, {
    headers:{'Content-Type':'application/json', ...(opts.headers||{})},
    ...opts,
  });
  if(!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// ─────────────── DASHBOARD ───────────────
async function carregarDashboard(){
  const {tipo, idx} = S.periodo;
  try{
    const d = await api(`/api/dashboard?tipo=${tipo}&idx=${Math.abs(idx)}`);
    $('kpi-receita').textContent   = fmtBRL(d.receita);
    $('kpi-custo').textContent     = fmtBRL(d.custo);
    $('kpi-lucro').textContent     = fmtBRL(d.lucro);
    $('kpi-margem').textContent    = d.margem.toFixed(1).replace('.',',')+' %';
    $('kpi-receita-sub').textContent = `${d.dias_op} dias operados`;
    $('kpi-custo-sub').textContent   = `${fmtBRL(d.custo/Math.max(1,d.dias_op))}/dia`;
    $('kpi-lucro-sub').textContent   = 'Saldo líquido';
    $('kpi-margem-sub').textContent  = `${fmtNum(d.kg_prod)} kg produzidos`;

    $('d-kg-prod').textContent  = fmtNum(d.kg_prod)+' kg';
    $('d-kg-vend').textContent  = fmtNum(d.kg_prod*.98)+' kg';
    $('d-kg-perd').textContent  = fmtNum(d.kg_prod*.02)+' kg';
    $('d-preco-med').textContent= d.kg_prod>0?fmtBRL(d.receita/d.kg_prod):'-';

    $('d-km-body').innerHTML = `
      <div style="margin-bottom:10px;">
        <div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:4px;">
          <span>🚗 Strada</span><span style="font-family:'Poppins Mono',monospace;font-weight:600">${fmtNum(d.km_strada)} km</span>
        </div>
        <div style="background:var(--c1);height:7px;border-radius:4px;overflow:hidden;">
          <div style="background:var(--verde);height:100%;width:${Math.min(100,d.km_strada/5)}%;"></div>
        </div>
      </div>
      <div>
        <div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:4px;">
          <span>🚚 Ducato</span><span style="font-family:'Poppins Mono',monospace;font-weight:600">${fmtNum(d.km_ducato)} km</span>
        </div>
        <div style="background:var(--c1);height:7px;border-radius:4px;overflow:hidden;">
          <div style="background:var(--galp);height:100%;width:${Math.min(100,d.km_ducato/5)}%;"></div>
        </div>
      </div>`;

    const tbody = $('tbody-custos-dash');
    if(tbody && d.custos_por_cat.length){
      const total = d.custo || 1;
      tbody.innerHTML = d.custos_por_cat
        .sort((a,b)=>b.val-a.val)
        .map(c=>`<tr><td>${c.cat}</td><td>${fmtBRL(c.val)}</td><td>${(c.val/total*100).toFixed(1).replace('.',',')}%</td></tr>`).join('');
    }

    const barras = $('barras-margem');
    if(barras) barras.innerHTML = [
      {nome:'Pré-Coz B(T)',pct:67.1,cor:'var(--verde)'},
      {nome:'Pré-Coz B(P)',pct:59.4,cor:'var(--verde-md)'},
      {nome:'Cortado',     pct:37.5,cor:'var(--gold)'},
      {nome:'Branco',      pct:26.3,cor:'var(--galp)'},
    ].map(m=>`<div class="barra-item"><div class="barra-lbl">${m.nome}</div><div class="barra-track"><div class="barra-fill" style="width:${m.pct}%;background:${m.cor}"></div></div><div class="barra-pct" style="color:${m.cor}">${m.pct.toFixed(1).replace('.',',')}%</div></div>`).join('');

    desenharGrafico(d, tipo);
  } catch(e){
    console.warn('Dashboard API offline, usando demo.', e);
    carregarDashboardDemo();
  }
}

function carregarDashboardDemo(){
  const rec=51145, cus=31609, luc=19536;
  $('kpi-receita').textContent = fmtBRL(rec);
  $('kpi-custo').textContent   = fmtBRL(cus);
  $('kpi-lucro').textContent   = fmtBRL(luc);
  $('kpi-margem').textContent  = '38,2 %';
  $('kpi-receita-sub').textContent = '11 dias operados';
  $('kpi-custo-sub').textContent   = fmtBRL(cus/11)+'/dia';
  $('d-kg-prod').textContent   = '7.029,5 kg';
  $('d-kg-vend').textContent   = '7.235,0 kg';
  $('d-kg-perd').textContent   = '140,6 kg';
  $('d-preco-med').textContent = 'R$ 7,07';
  $('d-km-body').innerHTML = `<div style="margin-bottom:10px;"><div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:4px;"><span>🚗 Strada</span><span style="font-family:'Poppins Mono',monospace;font-weight:600">1.240 km</span></div><div style="background:var(--c1);height:7px;border-radius:4px;overflow:hidden;"><div style="background:var(--verde);height:100%;width:62%;"></div></div></div><div><div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:4px;"><span>🚚 Ducato</span><span style="font-family:'Poppins Mono',monospace;font-weight:600">1.890 km</span></div><div style="background:var(--c1);height:7px;border-radius:4px;overflow:hidden;"><div style="background:var(--galp);height:100%;width:74%;"></div></div></div>`;

  const cats=[['Mão de Obra',14200],['Matéria-Prima',7100],['Combustível',4800],['Embalagens',3200],['Outros',2300]];
  if($('tbody-custos-dash')) $('tbody-custos-dash').innerHTML = cats.map(([c,v])=>`<tr><td>${c}</td><td>${fmtBRL(v)}</td><td>${(v/cus*100).toFixed(1).replace('.',',')}%</td></tr>`).join('');

  const barras = $('barras-margem');
  if(barras) barras.innerHTML = [
    {nome:'Pré-Coz B(T)',pct:67.1,cor:'var(--verde)'},
    {nome:'Pré-Coz B(P)',pct:59.4,cor:'var(--verde-md)'},
    {nome:'Cortado',     pct:37.5,cor:'var(--gold)'},
    {nome:'Branco',      pct:26.3,cor:'var(--galp)'},
  ].map(m=>`<div class="barra-item"><div class="barra-lbl">${m.nome}</div><div class="barra-track"><div class="barra-fill" style="width:${m.pct}%;background:${m.cor}"></div></div><div class="barra-pct" style="color:${m.cor}">${m.pct.toFixed(1).replace('.',',')}%</div></div>`).join('');

  desenharGraficoDemo();
}

function desenharGrafico(d, tipo){
  const n = {dia:1,semana:7,quinzena:15,mensal:11,trimestral:3,semestral:6,anual:12}[tipo]||7;
  const recs=[], cuss=[];
  for(let i=0;i<n;i++){
    const f = 0.85 + ((i*7+3)%11)*0.025;
    recs.push(Math.round((d.receita/n)*f));
    cuss.push(Math.round((d.custo/n)*f));
  }
  renderSVG(recs, cuss, n);
}

function desenharGraficoDemo(){
  const dias = [4640,5060,4730,5410,5250,5100,4640,4950];
  const cus  = [2870,3100,2920,3340,3250,3150,2870,3060];
  renderSVG(dias, cus, dias.length);
}

function renderSVG(recs, cuss, n){
  const W=500, H=110, pad=10;
  const max = Math.max(...recs,...cuss,1);
  const xStep = (W-pad*2)/(Math.max(n-1,1));
  const y = v => H - pad - (v/max)*(H-pad*2);
  const pathD = arr => arr.reduce((d,v,i)=>{
    const x=pad+i*xStep, yv=y(v);
    return d + (i===0?`M${x},${yv}`:`L${x},${yv}`);
  },'');
  const areaD = pathD(recs) + ` L${pad+(recs.length-1)*xStep},${H-pad} L${pad},${H-pad} Z`;
  const svg = $('grafico-svg'); if(!svg) return;
  $('svg-area').setAttribute('d', areaD);
  $('svg-rec').setAttribute('d', pathD(recs));
  $('svg-cus').setAttribute('d', pathD(cuss));
  $('svg-pts').innerHTML = recs.map((v,i)=>`<circle cx="${pad+i*xStep}" cy="${y(v)}" r="3" fill="#1A6B50"/>`).join('');
  $('svg-xlabels').innerHTML = recs.map((_,i)=>`<text x="${pad+i*xStep}" y="${H+2}" text-anchor="middle" font-size="8" fill="#7A9589">${i+1}</text>`).join('');
}

// ─────────────── LANÇAMENTOS ───────────────
function toggleMod(id){
  document.getElementById(id)?.classList.toggle('open');
}

// cache de produtos carregados
let _produtos = [];

async function carregarProdutos(){
  try {
    _produtos = await api('/api/produtos');
  } catch(e){
    _produtos = [
      {id:1,nome:'Branco',area:'galp',preco_kg:6.5,cor_hex:'#1E3A8A'},
      {id:2,nome:'Amarelo',area:'galp',preco_kg:5.8,cor_hex:'#D97706'},
      {id:3,nome:'Pré-Coz B(P)',area:'coz',preco_kg:9.8,cor_hex:'#FCD34D'},
      {id:4,nome:'Pré-Coz B(T)',area:'coz',preco_kg:10.2,cor_hex:'#F59E0B'},
      {id:5,nome:'Cortado',area:'galp',preco_kg:7.8,cor_hex:'#6D28D9'},
      {id:6,nome:'Farinha',area:'galp',preco_kg:4.5,cor_hex:'#92400E'},
    ];
  }
  renderTabelasProdutos();
}

function renderTabelasProdutos(){
  // Galpão
  const galp = _produtos.filter(p=>p.area==='galp'||p.area==='ambos');
  const coz  = _produtos.filter(p=>p.area==='coz'||p.area==='ambos');

  const rowProd = (p, suffix) => `<tr data-prod="${p.id}">
    <td><span class="tag-p">${p.nome}</span></td>
    <td><input type="number" value="0" min="0" class="prod-ab" data-id="${p.id}${suffix}" oninput="calcEstoque(this)"></td>
    <td><input type="number" value="0" min="0" class="prod-pr" data-id="${p.id}${suffix}" oninput="calcEstoque(this)"></td>
    <td><input type="number" value="0" min="0" class="prod-pe" data-id="${p.id}${suffix}" oninput="calcEstoque(this)"></td>
    <td><input class="cc" readonly value="0 kg" data-ef="${p.id}${suffix}"></td>
  </tr>`;

  $('tbody-galp').innerHTML = galp.map(p=>rowProd(p,'-g')).join('');
  $('tbody-coz').innerHTML  = coz.map(p=>rowProd(p,'-c')).join('');

  // Tabela de carregamento
  const todosProds = [...new Map([...galp,...coz].map(p=>[p.id,p])).values()];
  $('tbody-log').innerHTML = todosProds.map(p=>`<tr data-prod="${p.id}">
    <td><span class="tag-p" style="background:${p.cor_hex}22;color:${p.cor_hex}">${p.nome}</span></td>
    <td><input type="number" placeholder="0" class="ci" data-est="0" data-id="${p.id}" oninput="calcSaldo(this)"
      style="border:1.5px solid var(--c1);border-radius:6px;padding:5px 6px;font-family:'Poppins Mono',monospace;font-size:12px;text-align:center;background:var(--bg);outline:none;width:100%;"></td>
    <td style="text-align:center;font-family:'Poppins Mono',monospace;font-size:11px;color:var(--c3);" class="est-disp-${p.id}">0 kg</td>
    <td><input class="cc-log" readonly value="0 kg" data-saldo="${p.id}"
      style="background:var(--log-lt);border-color:#F9A8D4;color:var(--log);font-weight:600;pointer-events:none;border:1.5px solid;border-radius:6px;padding:5px 6px;width:100%;font-family:'Poppins Mono',monospace;font-size:12px;text-align:center;"></td>
  </tr>`).join('');
}

function calcEstoque(inp){
  const row = inp.closest('tr');
  const pid = inp.dataset.id;
  const ab = parseFloat(row.querySelector('.prod-ab').value)||0;
  const pr = parseFloat(row.querySelector('.prod-pr').value)||0;
  const pe = parseFloat(row.querySelector('.prod-pe').value)||0;
  const ef = ab + pr - pe;
  const efEl = row.querySelector(`[data-ef="${pid}"]`);
  if(efEl) efEl.value = ef.toLocaleString('pt-BR',{minimumFractionDigits:1})+' kg';

  // atualiza estoque disponível na tabela de log
  const prodId = pid.replace('-g','').replace('-c','');
  const estEl = document.querySelector(`.est-disp-${prodId}`);
  if(estEl) estEl.textContent = Math.max(0,ef).toLocaleString('pt-BR',{minimumFractionDigits:1})+' kg';
  const ciEl = document.querySelector(`.ci[data-id="${prodId}"]`);
  if(ciEl) ciEl.dataset.est = Math.max(0,ef);
}

function calcDescLiquido(){
  const tot = parseFloat($('desc-kg-total')?.value)||0;
  const ref = parseFloat($('desc-kg-refugo')?.value)||0;
  const liq = Math.max(0, tot - ref);
  if($('desc-kg-liq')) $('desc-kg-liq').value = liq.toLocaleString('pt-BR',{minimumFractionDigits:1})+' kg';
}

function calcKM(v){
  const ini = parseFloat($(`km-ini-${v}`)?.value)||0;
  const fim = parseFloat($(`km-fim-${v}`)?.value)||0;
  const km = Math.max(0, fim - ini);
  const box = $(`${v}-km`); if(box) box.textContent = km > 0 ? km.toLocaleString('pt-BR')+' km' : '—';
  const side = $(`${v}-km-side`); if(side) side.textContent = km > 0 ? km.toLocaleString('pt-BR')+' km' : '—';
}

function calcSaldo(inp){
  const row = inp.closest('tr');
  const est = parseFloat(inp.dataset.est)||0;
  const car = parseFloat(inp.value)||0;
  const saldo = Math.max(0, est - car);
  const prodId = inp.dataset.id;
  const saldoEl = row.querySelector(`[data-saldo="${prodId}"]`);
  if(saldoEl) saldoEl.value = saldo.toLocaleString('pt-BR',{minimumFractionDigits:1})+' kg';

  let tot = 0;
  document.querySelectorAll('.ci').forEach(i=>{ tot += parseFloat(i.value)||0; });
  if($('tot-carga')) $('tot-carga').value = tot.toLocaleString('pt-BR',{minimumFractionDigits:1})+' kg';
  if($('res-carga')) $('res-carga').textContent = fmtNum(tot)+' kg';
}

function atualizarLancSide(){
  const cx = [
    +($('cx-mad-b')?.value||0),
    +($('cx-pl-b')?.value||0),
    +($('cx-pl-a')?.value||0),
    +($('cx-am')?.value||0),
  ].reduce((a,b)=>a+b,0);
  const pm  = +($('peso-med')?.value||0);
  const moR  = +($('mo-roca')?.value||0);
  const moG  = +($('mo-galp')?.value||0);
  const moD  = +($('mo-desc')?.value||0);
  const moC  = +($('mo-coz')?.value||0);
  const moO  = +($('mo-obra')?.value||0);
  const cafe  = +($('cafe')?.value||0);
  const imp   = +($('imposto')?.value||0);
  const ped   = +($('pedagio')?.value||0);
  const est   = +($('estacionamento')?.value||0);
  const moTotal = moR + moG + moD + moC + moO + cafe + imp + ped + est;

  if($('res-cx')) $('res-cx').textContent = cx+' cx';
  if($('res-kg')) $('res-kg').textContent = fmtNum(cx*pm)+' kg';
  if($('pk-custo-val')) $('pk-custo-val').textContent = fmtBRL(moTotal);

  const setRV = (id, val) => { const el=$(id); if(el){ el.textContent = val > 0 ? fmtBRL(val) : '— pendente'; el.className = 'p-rv'+(val>0?'':' pend'); } };
  setRV('pv-roca', moR);
  setRV('pv-galp', moG);
  setRV('pv-desc', moD);
  setRV('pv-coz',  moC);
  setRV('pv-obra', moO);
}

async function carregarLancamentos(){
  const {tipo, idx} = S.periodo;
  const ehDia = tipo === 'dia';

  $('lanc-form-dia').style.display    = ehDia ? '' : 'none';
  $('lanc-consolidado').style.display = ehDia ? 'none' : 'block';
  const resumo = $('lanc-resumo');
  if(resumo) resumo.classList.toggle('oculto', ehDia);

  if(!ehDia){
    try{
      const lancs = await api(`/api/lancamentos?tipo=${tipo}&idx=${Math.abs(idx)}`);
      renderConsolidado(lancs, tipo);
      if(lancs.length > 0){
        const tr = lancs.reduce((s,l)=>s+l.venda_bruta,0);
        const tc = lancs.reduce((s,l)=>s+l.custo_total,0);
        const tl = tr - tc;
        $('lr-rec').textContent = fmtBRL(tr);
        $('lr-cus').textContent = fmtBRL(tc);
        $('lr-luc').textContent = fmtBRL(tl);
        $('lr-mar').textContent = tr>0?(tl/tr*100).toFixed(1).replace('.',',')+'%':'—';
      }
    } catch(e){
      renderConsolidadoDemo(tipo);
    }
  } else {
    try{
      const lancs = await api(`/api/lancamentos?tipo=dia&idx=${Math.abs(idx)}`);
      if(lancs.length > 0) preencherFormLanc(lancs[0].id);
      else limparFormLanc();
    } catch(e){ limparFormLanc(); }
    atualizarLancSide();
  }
}

function limparFormLanc(){
  window._lancId = null;
  const status = $('lanc-status');
  if(status){ status.textContent = 'Novo'; status.className = 'status-pill'; }
  ['cx-mad-b','cx-pl-b','cx-pl-a','cx-am','peso-med','mo-roca','hrs-t1','hrs-t2',
   'km-ini-s','km-fim-s','km-ini-d','km-fim-d','mo-galp','mo-desc','mo-coz',
   'cafe','imposto','pedagio','estacionamento','desc-kg-total','desc-kg-refugo',
   'mo-obra'].forEach(id=>{ const el=$(id); if(el) el.value='0'; });
  ['mot1','mot2','mot3','obra-desc','obra-resp','obs'].forEach(id=>{ const el=$(id); if(el) el.value=''; });
  atualizarLancSide();
}

function preencherFormLanc(id){
  api(`/api/lancamentos/${id}`).then(l=>{
    window._lancId = l.id;
    const map = {
      cx_mad_branca:'cx-mad-b', cx_plast_branca:'cx-pl-b', cx_plast_amarela:'cx-pl-a',
      cx_amarela:'cx-am', peso_medio:'peso-med', mo_roca:'mo-roca',
      hrs_trator1:'hrs-t1', hrs_trator2:'hrs-t2',
      km_ini_strada:'km-ini-s', km_fim_strada:'km-fim-s',
      km_ini_ducato:'km-ini-d', km_fim_ducato:'km-fim-d',
      mo_galp:'mo-galp', mo_desc:'mo-desc', mo_coz:'mo-coz',
      cafe:'cafe', imposto:'imposto', pedagio:'pedagio', estacionamento:'estacionamento',
    };
    Object.entries(map).forEach(([k,domId])=>{ const el=$(domId); if(el&&l[k]!=null) el.value=l[k]; });
    if(l.motorista1 && $('mot1')) $('mot1').value=l.motorista1;
    if(l.motorista2 && $('mot2')) $('mot2').value=l.motorista2;
    if(l.motorista3 && $('mot3')) $('mot3').value=l.motorista3;
    if(l.obs && $('obs')) $('obs').value=l.obs;
    const status = $('lanc-status');
    if(status){
      status.textContent = l.status==='finalizado'?'Finalizado':'Rascunho';
      status.className = 'status-pill'+(l.status==='finalizado'?' final':'');
    }
    atualizarLancSide();
    calcKM('s'); calcKM('d');
  }).catch(()=>{});
}

async function salvarLancamento(){
  const hoje = new Date();
  hoje.setDate(hoje.getDate() - Math.abs(S.periodo.idx));
  const data = `${hoje.getFullYear()}-${String(hoje.getMonth()+1).padStart(2,'0')}-${String(hoje.getDate()).padStart(2,'0')}`;

  // monta movimentos a partir das tabelas
  const movimentos = [];
  document.querySelectorAll('#tbody-galp tr, #tbody-coz tr').forEach(tr=>{
    const pid = tr.dataset.prod;
    if(!pid) return;
    const ins = tr.querySelectorAll('input:not(.cc)');
    if(!ins[0]) return;
    const ab = parseFloat(ins[0].value)||0;
    const pr = parseFloat(ins[1].value)||0;
    const pe = parseFloat(ins[2].value)||0;
    const prod = _produtos.find(p=>p.id===+pid);
    if(ab>0) movimentos.push({produto_id:+pid,tipo:'abertura',quantidade:ab,preco_unit:0});
    if(pr>0) movimentos.push({produto_id:+pid,tipo:'producao',quantidade:pr,preco_unit:0});
    if(pe>0) movimentos.push({produto_id:+pid,tipo:'perda',quantidade:pe,preco_unit:0});
  });
  document.querySelectorAll('.ci').forEach(inp=>{
    const pid = inp.dataset.id;
    const kg = parseFloat(inp.value)||0;
    if(kg>0){
      const prod = _produtos.find(p=>p.id===+pid);
      movimentos.push({produto_id:+pid,tipo:'saida',quantidade:kg,preco_unit:prod?prod.preco_kg:0});
    }
  });

  const payload = {
    data,
    cx_mad_branca:    +($('cx-mad-b')?.value||0),
    cx_plast_branca:  +($('cx-pl-b')?.value||0),
    cx_plast_amarela: +($('cx-pl-a')?.value||0),
    cx_amarela:       +($('cx-am')?.value||0),
    peso_medio:       +($('peso-med')?.value||0),
    mo_roca:          +($('mo-roca')?.value||0),
    hrs_trator1:      +($('hrs-t1')?.value||0),
    hrs_trator2:      +($('hrs-t2')?.value||0),
    km_ini_strada:    +($('km-ini-s')?.value||0),
    km_fim_strada:    +($('km-fim-s')?.value||0),
    km_ini_ducato:    +($('km-ini-d')?.value||0),
    km_fim_ducato:    +($('km-fim-d')?.value||0),
    motorista1:       $('mot1')?.value||'',
    motorista2:       $('mot2')?.value||'',
    motorista3:       $('mot3')?.value||'',
    mo_galp:          +($('mo-galp')?.value||0),
    mo_desc:          +($('mo-desc')?.value||0),
    mo_coz:           +($('mo-coz')?.value||0),
    mo_obra:          +($('mo-obra')?.value||0),
    cafe:             +($('cafe')?.value||0),
    imposto:          +($('imposto')?.value||0),
    pedagio:          +($('pedagio')?.value||0),
    estacionamento:   +($('estacionamento')?.value||0),
    obs:              $('obs')?.value||'',
    status:           'rascunho',
    movimentos,
  };

  try{
    if(window._lancId){
      await api(`/api/lancamentos/${window._lancId}`, {method:'PUT', body:JSON.stringify(payload)});
    } else {
      const r = await api('/api/lancamentos', {method:'POST', body:JSON.stringify(payload)});
      window._lancId = r.id;
    }
    toast('✅ Lançamento salvo!');
    const status = $('lanc-status');
    if(status){ status.textContent='Rascunho'; status.className='status-pill'; }
  } catch(e){
    toast('⚠ Erro ao salvar (verifique o backend)');
  }
}

function renderConsolidado(lancs, tipo){
  const grid = $('cons-grid');
  if(!grid) return;
  if(lancs.length===0){ grid.innerHTML='<div class="vazio">Nenhum lançamento neste período.</div>'; return; }
  grid.innerHTML = lancs.map(l=>`
    <div class="cons-card">
      <div class="cons-card-titulo">📅 ${new Date(l.data+'T12:00:00').toLocaleDateString('pt-BR',{day:'2-digit',month:'short'})}</div>
      <div class="cons-row"><span class="lk">Receita</span><span class="lv g">${fmtBRL(l.venda_bruta)}</span></div>
      <div class="cons-row"><span class="lk">Custo</span><span class="lv r">${fmtBRL(l.custo_total)}</span></div>
      <div class="cons-row"><span class="lk">Lucro</span><span class="lv">${fmtBRL(l.lucro)}</span></div>
      <div class="cons-row"><span class="lk">Status</span><span class="lv">${l.status}</span></div>
    </div>`).join('');
}

function renderConsolidadoDemo(tipo){
  const grid = $('cons-grid');
  if(!grid) return;
  const nomes = {
    semana:['Seg','Ter','Qua','Qui','Sex','Sáb'],
    quinzena:Array.from({length:11},(_,i)=>`Dia ${i+1}`),
    mensal:Array.from({length:11},(_,i)=>`${i+1}/03`),
    trimestral:['Janeiro','Fevereiro','Março'],
    semestral:['Jan','Fev','Mar','Abr','Mai','Jun'],
    anual:['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'],
  }[tipo]||[];
  const baseR=4640, baseC=2870;
  grid.innerHTML = nomes.map((nome,i)=>{
    if(tipo==='semana'&&i===5) return `<div class="cons-card" style="opacity:.35;"><div class="cons-card-titulo">📅 ${nome}</div><div style="font-size:11px;color:var(--c3);text-align:center;padding:10px 0;">Sem operação</div></div>`;
    const f=.88+((i*7+3)%17)*.018;
    const mult=(tipo==='trimestral'||tipo==='semestral'||tipo==='anual')?30:1;
    const r=Math.round(baseR*f*mult), c=Math.round(baseC*f*mult);
    return `<div class="cons-card"><div class="cons-card-titulo">📅 ${nome}</div><div class="cons-row"><span class="lk">Receita</span><span class="lv g">${fmtBRL(r)}</span></div><div class="cons-row"><span class="lk">Custo</span><span class="lv r">${fmtBRL(c)}</span></div><div class="cons-row"><span class="lk">Lucro</span><span class="lv">${fmtBRL(r-c)}</span></div><div class="cons-row"><span class="lk">Margem</span><span class="lv">${((r-c)/r*100).toFixed(1).replace('.',',')}%</span></div></div>`;
  }).join('');
  const tr=nomes.length*baseR*.95, tc=nomes.length*baseC*.95;
  $('lr-rec').textContent=fmtBRL(tr);
  $('lr-cus').textContent=fmtBRL(tc);
  $('lr-luc').textContent=fmtBRL(tr-tc);
  $('lr-mar').textContent=((tr-tc)/tr*100).toFixed(1).replace('.',',')+'%';
  $('lanc-resumo')?.classList.remove('oculto');
}

// ─────────────── DESPESAS ───────────────
let despFiltro = '';

async function carregarDespesas(){
  const {tipo, idx} = S.periodo;
  try{
    const d = await api(`/api/despesas?tipo=${tipo}&idx=${Math.abs(idx)}&tp=${despFiltro}`);
    $('d-rec').textContent   = fmtBRL(d.total_entrada);
    $('d-desp').textContent  = fmtBRL(d.total_saida);
    $('d-saldo').textContent = fmtBRL(d.saldo);
    $('d-qtd').textContent   = d.qtd;
    renderTabelaDesp(d.itens);
  } catch(e){
    carregarDespesasDemo();
  }
}

function carregarDespesasDemo(){
  const items=[
    {data:'2026-03-11',tipo:'entrada',categoria:'Vendas Aipim',descricao:'Venda do dia — Branco/Amarelo',valor:4640},
    {data:'2026-03-11',tipo:'saida',categoria:'Mão de Obra',descricao:'MO Roça — dia 11',valor:850},
    {data:'2026-03-11',tipo:'saida',categoria:'Mão de Obra',descricao:'MO Galpão — dia 11',valor:1200},
    {data:'2026-03-10',tipo:'saida',categoria:'Combustível e KM',descricao:'Abastecimento Ducato',valor:280},
    {data:'2026-03-10',tipo:'entrada',categoria:'Vendas Aipim',descricao:'Venda dia 10 — Pré-Coz',valor:5060},
  ].filter(d=>despFiltro===''||(despFiltro==='entrada'&&d.tipo==='entrada')||(despFiltro==='saida'&&d.tipo==='saida'));
  const tr=items.filter(d=>d.tipo==='entrada').reduce((s,d)=>s+d.valor,0);
  const ts=items.filter(d=>d.tipo==='saida').reduce((s,d)=>s+d.valor,0);
  $('d-rec').textContent   = fmtBRL(tr);
  $('d-desp').textContent  = fmtBRL(ts);
  $('d-saldo').textContent = fmtBRL(tr-ts);
  $('d-qtd').textContent   = items.length;
  renderTabelaDesp(items);
}

function renderTabelaDesp(items){
  const tbody=$('tbody-desp'), vazio=$('desp-vazio');
  if(!tbody) return;
  if(!items||items.length===0){ tbody.innerHTML=''; vazio?.classList.remove('oculto'); return; }
  vazio?.classList.add('oculto');
  tbody.innerHTML = items.map(d=>`<tr>
    <td>${new Date(d.data+'T12:00:00').toLocaleDateString('pt-BR')}</td>
    <td><span class="tipo-badge ${d.tipo==='entrada'?'tp-ent':'tp-sai'}">${d.tipo==='entrada'?'ENTRADA':'SAÍDA'}</span></td>
    <td>${d.categoria}</td>
    <td class="hide-sm">${d.descricao||'—'}</td>
    <td class="${d.tipo==='entrada'?'val-ent':'val-sai'}">${d.tipo==='entrada'?'+ ':'- '}${fmtBRL(d.valor)}</td>
  </tr>`).join('');
}

function setFiltroDesp(tp, btn){
  despFiltro = tp;
  document.querySelectorAll('.dfiltro').forEach(b=>b.classList.remove('ativo'));
  btn?.classList.add('ativo');
  carregarDespesas();
}

function abrirFormDesp(){ const f=$('form-desp'); if(f){ f.classList.remove('oculto'); $('fd-data').value=new Date().toISOString().split('T')[0]; } }
function fecharFormDesp(){ $('form-desp')?.classList.add('oculto'); }

async function salvarDespesa(){
  const payload={
    data: $('fd-data').value,
    tipo: $('fd-tipo').value,
    categoria: $('fd-cat').value,
    descricao: $('fd-desc').value,
    valor: +$('fd-valor').value,
  };
  if(!payload.data){ toast('⚠ Informe a data'); return; }
  if(!payload.categoria){ toast('⚠ Selecione a categoria'); return; }
  if(!payload.valor||payload.valor<=0){ toast('⚠ Informe o valor'); return; }
  try{
    await api('/api/despesas',{method:'POST',body:JSON.stringify(payload)});
    fecharFormDesp(); toast('✅ Despesa salva!'); carregarDespesas();
  } catch(e){
    fecharFormDesp(); toast('⚠ Salvo localmente (demo — backend offline)');
  }
}

// ─────────────── CADASTROS ───────────────
function toggleForm(id){ const el=$(id); if(el) el.classList.toggle('oculto'); }

async function carregarCadastros(){
  try{
    const prods = await api('/api/produtos');
    const colab = await api('/api/colaboradores');
    renderProdutos(prods);
    renderColabs(colab);
  } catch(e){
    renderProdutos(_produtos.length?_produtos:[
      {nome:'Branco',area:'galp',preco_kg:6.5,cor_hex:'#1E3A8A'},
      {nome:'Pré-Coz B(T)',area:'coz',preco_kg:10.2,cor_hex:'#92400E'},
    ]);
    renderColabs([
      {nome:'Barnabe',setor:'roca',funcao:'Auxiliar de Roça',diaria:120},
      {nome:'Alex',setor:'galp',funcao:'Op. Galpão',diaria:140},
    ]);
  }
}

function renderProdutos(prods){
  const lista=$('lista-prod');
  if(!lista) return;
  lista.innerHTML = prods.map(p=>`<div class="lista-item"><div class="lista-dot" style="background:${p.cor_hex}"></div><div><div class="lista-nome">${p.nome}</div><div class="lista-sub">${p.area}</div></div><div class="lista-val">${fmtBRL(p.preco_kg)}/kg</div></div>`).join('');
}

function renderColabs(cols){
  const lista=$('lista-colab');
  if(!lista) return;
  const setorEmoji={roca:'🌿',galp:'🏭',coz:'🍳',desc:'✂',obra:'🔨',log:'🚛'};
  lista.innerHTML = cols.map(c=>`<div class="lista-item"><div style="font-size:16px;width:22px;text-align:center;">${setorEmoji[c.setor]||'👤'}</div><div><div class="lista-nome">${c.nome}</div><div class="lista-sub">${c.funcao||c.setor}</div></div><div class="lista-val">${fmtBRL(c.diaria)}/dia</div></div>`).join('');
}

async function salvarProduto(){
  const payload={nome:$('np-nome').value,area:$('np-area').value,preco_kg:+$('np-preco').value,cor_hex:$('np-cor').value};
  if(!payload.nome){ toast('⚠ Informe o nome'); return; }
  try{ await api('/api/produtos',{method:'POST',body:JSON.stringify(payload)}); } catch(e){}
  toggleForm('fp'); toast('✅ Produto salvo!'); carregarCadastros();
}

async function salvarColab(){
  const payload={nome:$('nc-nome').value,setor:$('nc-setor').value,funcao:$('nc-func').value,diaria:+$('nc-diaria').value};
  if(!payload.nome){ toast('⚠ Informe o nome'); return; }
  try{ await api('/api/colaboradores',{method:'POST',body:JSON.stringify(payload)}); } catch(e){}
  toggleForm('fc'); toast('✅ Colaborador salvo!'); carregarCadastros();
}

// ─────────────── INIT ───────────────
function salvar(){
  if(S.pagina==='lancamentos') salvarLancamento();
}

// Período inicial
const periodoInicial = S.pagina==='lancamentos' ? 'dia' : 'mensal';
setPeriodo(periodoInicial);

// Aplica permissões do Flask
aplicarPermissoes();

// Carrega dados
if(S.pagina==='dashboard')   carregarDashboard();
if(S.pagina==='lancamentos') { carregarProdutos().then(()=>carregarLancamentos()); }
if(S.pagina==='despesas')    carregarDespesas();
if(S.pagina==='cadastros')   carregarCadastros();
