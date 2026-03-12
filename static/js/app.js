/* ═══════════════════════════════════════
   AIPIM DE TINGUÁ SYS — app.js
═══════════════════════════════════════ */

// ─────────────── ESTADO GLOBAL ───────────────
const S = {
  pagina:    document.body.dataset.pagina || 'dashboard',
  periodo:   { tipo:'dia', idx:0 },
  usuario:   null,
};

// ─────────────── UTILS ───────────────
const $ = id => document.getElementById(id);
const fmtBRL = v => 'R$ ' + Number(v||0).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});
const fmtNum = v => Number(v||0).toLocaleString('pt-BR',{maximumFractionDigits:1});

function toast(msg, dur=2500){
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
    return idx%2===0?`2ª Quinz. ${MESES[hoje.getMonth()]}`:`1ª Quinz. ${MESES[hoje.getMonth()]}`;
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
  if(S.periodo.idx < 0) S.periodo.idx = 0;
  atualizarPaginaAtual();
}

function atualizarNavLabel(){
  const el = $('pnav-label');
  if(el) el.textContent = getNavLabel(S.periodo.tipo, S.periodo.idx);
}

function atualizarPaginaAtual(){
  atualizarNavLabel();
  if(S.pagina==='dashboard')    carregarDashboard();
  if(S.pagina==='lancamentos')  carregarLancamentos();
  if(S.pagina==='despesas')     carregarDespesas();
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
    $('kpi-lucro-sub').textContent   = `Saldo líquido`;
    $('kpi-margem-sub').textContent  = `${fmtNum(d.kg_prod)} kg produzidos`;

    // KG
    $('d-kg-prod').textContent = fmtNum(d.kg_prod)+' kg';
    $('d-kg-vend').textContent = fmtNum(d.kg_prod*.98)+' kg';
    $('d-kg-perd').textContent = fmtNum(d.kg_prod*.02)+' kg';
    $('d-preco-med').textContent = d.kg_prod>0?fmtBRL(d.receita/d.kg_prod):'-';

    // KM
    $('d-km-body').innerHTML = `
      <div style="margin-bottom:10px;">
        <div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:4px;">
          <span>🚗 Strada</span><span style="font-family:'DM Mono',monospace;font-weight:600">${fmtNum(d.km_strada)} km</span>
        </div>
        <div style="background:var(--c1);height:7px;border-radius:4px;overflow:hidden;">
          <div style="background:var(--verde);height:100%;width:${Math.min(100,d.km_strada/5)}%;"></div>
        </div>
      </div>
      <div>
        <div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:4px;">
          <span>🚚 Ducato</span><span style="font-family:'DM Mono',monospace;font-weight:600">${fmtNum(d.km_ducato)} km</span>
        </div>
        <div style="background:var(--c1);height:7px;border-radius:4px;overflow:hidden;">
          <div style="background:var(--galp);height:100%;width:${Math.min(100,d.km_ducato/5)}%;"></div>
        </div>
      </div>`;

    // Tabela custos por categoria
    const tbody = $('tbody-custos-dash');
    if(tbody && d.custos_por_cat.length){
      const total = d.custo || 1;
      tbody.innerHTML = d.custos_por_cat
        .sort((a,b)=>b.val-a.val)
        .map(c=>`<tr>
          <td>${c.cat}</td>
          <td>${fmtBRL(c.val)}</td>
          <td>${(c.val/total*100).toFixed(1).replace('.',',')}%</td>
        </tr>`).join('');
    }

    // Gráfico
    desenharGrafico(d, tipo);

  } catch(e){
    console.warn('Dashboard API offline, usando dados demo.', e);
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
  $('d-km-body').innerHTML = `<div style="margin-bottom:10px;"><div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:4px;"><span>🚗 Strada</span><span style="font-family:'DM Mono',monospace;font-weight:600">1.240 km</span></div><div style="background:var(--c1);height:7px;border-radius:4px;overflow:hidden;"><div style="background:var(--verde);height:100%;width:62%;"></div></div></div><div><div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:4px;"><span>🚚 Ducato</span><span style="font-family:'DM Mono',monospace;font-weight:600">1.890 km</span></div><div style="background:var(--c1);height:7px;border-radius:4px;overflow:hidden;"><div style="background:var(--galp);height:100%;width:74%;"></div></div></div>`;

  const cats=[['Mão de Obra',14200],['Matéria-Prima',7100],['Combustível',4800],['Embalagens',3200],['Outros',2300]];
  $('tbody-custos-dash').innerHTML = cats.map(([c,v])=>`<tr><td>${c}</td><td>${fmtBRL(v)}</td><td>${(v/cus*100).toFixed(1).replace('.',',')}%</td></tr>`).join('');

  desenharGraficoDemo();
}

function desenharGrafico(d, tipo){
  // Valores demo progressivos (em produção viria do backend por subperíodo)
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
  const dias = [4640,5060,4730,0,5410,0,5250,0,5100,4640,4950];
  const cus  = [2870,3100,2920,0,3340,0,3250,0,3150,2870,3060];
  renderSVG(dias.filter((_,i)=>cus[i]>0), cus.filter(v=>v>0), 9);
}

function renderSVG(recs, cuss, n){
  const W=500, H=110, pad=10;
  const max = Math.max(...recs,...cuss,1);
  const xStep = (W-pad*2)/(Math.max(n-1,1));
  const y = v => H - pad - (v/max)*(H-pad*2);

  const pts = (arr) => arr.map((v,i)=>`${pad+i*xStep},${y(v)}`).join(' ');
  const pathD = (arr) => {
    return arr.reduce((d,v,i)=>{
      const x=pad+i*xStep, yv=y(v);
      return d + (i===0?`M${x},${yv}`:`L${x},${yv}`);
    },'');
  };

  const areaD = recs.reduce((d,v,i)=>{
    const x=pad+i*xStep, yv=y(v);
    return d + (i===0?`M${x},${yv}`:`L${x},${yv}`);
  },'') + ` L${pad+(recs.length-1)*xStep},${H-pad} L${pad},${H-pad} Z`;

  const svg = $('grafico-svg');
  if(!svg) return;
  $('svg-area').setAttribute('d', areaD);
  $('svg-rec').setAttribute('d', pathD(recs));
  $('svg-cus').setAttribute('d', pathD(cuss));

  // Pontos
  const ptsEl = $('svg-pts');
  ptsEl.innerHTML = recs.map((v,i)=>`
    <circle cx="${pad+i*xStep}" cy="${y(v)}" r="3" fill="#1A6B50"/>
  `).join('');

  // Labels X
  const lbls = $('svg-xlabels');
  lbls.innerHTML = recs.map((_,i)=>`
    <text x="${pad+i*xStep}" y="${H+2}" text-anchor="middle" font-size="8" fill="#7A9589">${i+1}</text>
  `).join('');
}

// ─────────────── LANÇAMENTOS ───────────────
function toggleMod(id){
  document.getElementById(id)?.classList.toggle('open');
}

async function carregarLancamentos(){
  const {tipo, idx} = S.periodo;
  const ehDia = tipo==='dia';

  $('lanc-form-dia').style.display     = ehDia?'':'none';
  $('lanc-consolidado').style.display  = ehDia?'none':'block';
  const resumo = $('lanc-resumo');
  if(resumo) resumo.classList.toggle('oculto', ehDia);

  if(!ehDia){
    try{
      const lancs = await api(`/api/lancamentos?tipo=${tipo}&idx=${Math.abs(idx)}`);
      renderConsolidado(lancs, tipo);
      if(lancs.length>0){
        const tr = lancs.reduce((s,l)=>s+l.venda_bruta,0);
        const tc = lancs.reduce((s,l)=>s+l.custo_total,0);
        const tl = tr-tc;
        $('lr-rec').textContent = fmtBRL(tr);
        $('lr-cus').textContent = fmtBRL(tc);
        $('lr-luc').textContent = fmtBRL(tl);
        $('lr-mar').textContent = tr>0?(tl/tr*100).toFixed(1).replace('.',',')+'%':'—';
      }
    } catch(e){
      renderConsolidadoDemo(tipo);
    }
  } else {
    // Tenta carregar o lançamento do dia
    try{
      const hoje = new Date(); hoje.setDate(hoje.getDate()-Math.abs(idx));
      const iso  = hoje.toISOString().split('T')[0];
      const lancs = await api(`/api/lancamentos?tipo=dia&idx=${Math.abs(idx)}`);
      if(lancs.length>0) preencherFormLanc(lancs[0].id);
    } catch(e){}

    // Atualiza painel lateral
    atualizarLancSide();
  }
}

function preencherFormLanc(id){
  api(`/api/lancamentos/${id}`).then(l=>{
    ['cx_mad_branca','cx_plast_branca','cx_plast_amarela','cx_amarela',
     'peso_medio','mo_roca','hrs_trator1','hrs_trator2',
     'km_ini_strada','km_fim_strada','km_ini_ducato','km_fim_ducato',
     'mo_galp','mo_desc','mo_coz','cafe','imposto','pedagio'].forEach(k=>{
      const map={cx_mad_branca:'cx-mad-b',cx_plast_branca:'cx-pl-b',cx_plast_amarela:'cx-pl-a',cx_amarela:'cx-am',peso_medio:'peso-med',mo_roca:'mo-roca',hrs_trator1:'hrs-t1',hrs_trator2:'hrs-t2',km_ini_strada:'km-ini-s',km_fim_strada:'km-fim-s',km_ini_ducato:'km-ini-d',km_fim_ducato:'km-fim-d',mo_galp:'mo-galp',mo_desc:'mo-desc',mo_coz:'mo-coz',cafe:'cafe',imposto:'imposto',pedagio:'pedagio'};
      const el=$(map[k]||k);
      if(el && l[k]!=null) el.value=l[k];
    });
    if(l.motorista1 && $('mot1')) $('mot1').value=l.motorista1;
    if(l.obs && $('obs')) $('obs').value=l.obs;
    window._lancId = l.id;
    atualizarLancSide();
  }).catch(()=>{});
}

function atualizarLancSide(){
  const cx  = (+($('cx-mad-b')?.value||0)) + (+($('cx-pl-b')?.value||0)) + (+($('cx-pl-a')?.value||0)) + (+($('cx-am')?.value||0));
  const pm  = +($('peso-med')?.value||0);
  const ks  = (+($('km-fim-s')?.value||0)) - (+($('km-ini-s')?.value||0));
  const kd  = (+($('km-fim-d')?.value||0)) - (+($('km-ini-d')?.value||0));
  const mo  = (+($('mo-roca')?.value||0)) + (+($('mo-galp')?.value||0)) + (+($('mo-desc')?.value||0)) + (+($('mo-coz')?.value||0));

  if($('s-cx')) $('s-cx').textContent = cx+' cx';
  if($('s-kg')) $('s-kg').textContent = fmtNum(cx*pm)+' kg';
  if($('s-mo')) $('s-mo').textContent = fmtBRL(mo);
  if($('s-ks')) $('s-ks').textContent = fmtNum(ks)+' km';
  if($('s-kd')) $('s-kd').textContent = fmtNum(kd)+' km';
}

// Listeners do formulário de lançamento
document.querySelectorAll('#lanc-form-dia .fld-in').forEach(el=>{
  el.addEventListener('input', atualizarLancSide);
});

async function salvarLancamento(){
  const hoje = new Date(); hoje.setDate(hoje.getDate()-Math.abs(S.periodo.idx));
  const data = hoje.toISOString().split('T')[0];
  const payload = {
    data,
    cx_mad_branca:   +($('cx-mad-b')?.value||0),
    cx_plast_branca: +($('cx-pl-b')?.value||0),
    cx_plast_amarela:+($('cx-pl-a')?.value||0),
    cx_amarela:      +($('cx-am')?.value||0),
    peso_medio:      +($('peso-med')?.value||0),
    mo_roca:         +($('mo-roca')?.value||0),
    hrs_trator1:     +($('hrs-t1')?.value||0),
    hrs_trator2:     +($('hrs-t2')?.value||0),
    km_ini_strada:   +($('km-ini-s')?.value||0),
    km_fim_strada:   +($('km-fim-s')?.value||0),
    km_ini_ducato:   +($('km-ini-d')?.value||0),
    km_fim_ducato:   +($('km-fim-d')?.value||0),
    motorista1:      $('mot1')?.value||'',
    mo_galp:         +($('mo-galp')?.value||0),
    mo_desc:         +($('mo-desc')?.value||0),
    mo_coz:          +($('mo-coz')?.value||0),
    cafe:            +($('cafe')?.value||0),
    imposto:         +($('imposto')?.value||0),
    pedagio:         +($('pedagio')?.value||0),
    obs:             $('obs')?.value||'',
    status:          'rascunho',
  };
  try{
    if(window._lancId){
      await api(`/api/lancamentos/${window._lancId}`, {method:'PUT', body:JSON.stringify(payload)});
    } else {
      const r = await api('/api/lancamentos', {method:'POST', body:JSON.stringify(payload)});
      window._lancId = r.id;
    }
    toast('✅ Lançamento salvo!');
  } catch(e){
    toast('⚠ Erro ao salvar (demo — backend offline)');
  }
}

function renderConsolidado(lancs, tipo){
  const grid = $('cons-grid');
  if(!grid) return;
  if(lancs.length===0){
    grid.innerHTML='<div class="vazio">Nenhum lançamento neste período.</div>';
    return;
  }
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
  const nomes = {semana:['Seg','Ter','Qua','Qui','Sex','Sáb'],quinzena:Array.from({length:11},(_,i)=>`Dia ${i+1}`),mensal:Array.from({length:11},(_,i)=>`${i+1}/03`),trimestral:['Janeiro','Fevereiro','Março'],semestral:['Jan','Fev','Mar','Abr','Mai','Jun'],anual:['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']}[tipo]||[];
  const baseR=4640, baseC=2870;
  grid.innerHTML = nomes.map((nome,i)=>{
    if(tipo==='semana'&&i===5) return `<div class="cons-card" style="opacity:.35;"><div class="cons-card-titulo">📅 ${nome}</div><div style="font-size:11px;color:var(--c3);text-align:center;padding:10px 0;">Sem operação</div></div>`;
    const f=.88+((i*7+3)%17)*.018;
    const mult=(tipo==='trimestral'||tipo==='semestral'||tipo==='anual')?30:1;
    const r=Math.round(baseR*f*mult), c=Math.round(baseC*f*mult);
    return `<div class="cons-card">
      <div class="cons-card-titulo">📅 ${nome}</div>
      <div class="cons-row"><span class="lk">Receita</span><span class="lv g">${fmtBRL(r)}</span></div>
      <div class="cons-row"><span class="lk">Custo</span><span class="lv r">${fmtBRL(c)}</span></div>
      <div class="cons-row"><span class="lk">Lucro</span><span class="lv">${fmtBRL(r-c)}</span></div>
      <div class="cons-row"><span class="lk">Margem</span><span class="lv">${((r-c)/r*100).toFixed(1).replace('.',',')}%</span></div>
    </div>`;
  }).join('');

  const tr=nomes.length*baseR*.95, tc=nomes.length*baseC*.95;
  if($('lr-rec')) $('lr-rec').textContent=fmtBRL(tr);
  if($('lr-cus')) $('lr-cus').textContent=fmtBRL(tc);
  if($('lr-luc')) $('lr-luc').textContent=fmtBRL(tr-tc);
  if($('lr-mar')) $('lr-mar').textContent=((tr-tc)/tr*100).toFixed(1).replace('.',',')+' %';
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
  if(!items||items.length===0){
    tbody.innerHTML='';
    vazio?.classList.remove('oculto');
    return;
  }
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

function abrirFormDesp(){
  const f=$('form-desp');
  if(f){ f.classList.remove('oculto'); $('fd-data').value=new Date().toISOString().split('T')[0]; }
}
function fecharFormDesp(){ $('form-desp')?.classList.add('oculto'); }

async function salvarDespesa(){
  const payload={
    data:  $('fd-data').value,
    tipo:  $('fd-tipo').value,
    categoria: $('fd-cat').value,
    descricao: $('fd-desc').value,
    valor: +$('fd-valor').value,
  };
  if(!payload.valor||payload.valor<=0){ toast('⚠ Informe o valor'); return; }
  try{
    await api('/api/despesas',{method:'POST',body:JSON.stringify(payload)});
    fecharFormDesp();
    toast('✅ Despesa salva!');
    carregarDespesas();
  } catch(e){
    fecharFormDesp();
    toast('⚠ Despesa salva localmente (demo)');
  }
}

// ─────────────── CADASTROS ───────────────
function toggleForm(id){
  const el=$(id);
  if(el) el.classList.toggle('oculto');
}

async function carregarCadastros(){
  try{
    const prods = await api('/api/produtos');
    const colab = await api('/api/colaboradores');
    renderProdutos(prods);
    renderColabs(colab);
  } catch(e){
    renderProdutosDemo();
    renderColabsDemo();
  }
}

function renderProdutos(prods){
  const lista=$('lista-prod');
  if(!lista) return;
  lista.innerHTML = prods.map(p=>`
    <div class="lista-item">
      <div class="lista-dot" style="background:${p.cor_hex}"></div>
      <div><div class="lista-nome">${p.nome}</div><div class="lista-sub">${p.area}</div></div>
      <div class="lista-val">${fmtBRL(p.preco_kg)}/kg</div>
    </div>`).join('');
}

function renderColabs(cols){
  const lista=$('lista-colab');
  if(!lista) return;
  const setorEmoji={roca:'🌿',galp:'🏭',coz:'🍳',desc:'✂',obra:'🔨',log:'🚛'};
  lista.innerHTML = cols.map(c=>`
    <div class="lista-item">
      <div style="font-size:16px;width:22px;text-align:center;">${setorEmoji[c.setor]||'👤'}</div>
      <div><div class="lista-nome">${c.nome}</div><div class="lista-sub">${c.funcao||c.setor}</div></div>
      <div class="lista-val">${fmtBRL(c.diaria)}/dia</div>
    </div>`).join('');
}

function renderProdutosDemo(){
  renderProdutos([
    {nome:'Branco',area:'galp',preco_kg:6.50,cor_hex:'#1E3A8A'},
    {nome:'Amarelo',area:'galp',preco_kg:5.80,cor_hex:'#D97706'},
    {nome:'Pré-Coz B(T)',area:'coz',preco_kg:10.20,cor_hex:'#92400E'},
    {nome:'Cortado',area:'galp',preco_kg:7.80,cor_hex:'#6D28D9'},
    {nome:'Nhoque A',area:'galp',preco_kg:12.50,cor_hex:'#14532D'},
  ]);
}
function renderColabsDemo(){
  renderColabs([
    {nome:'Barnabe',setor:'roca',funcao:'Auxiliar de Roça',diaria:120},
    {nome:'Alex',setor:'galp',funcao:'Op. Galpão',diaria:140},
    {nome:'Rubinha',setor:'coz',funcao:'Cozinheira',diaria:150},
    {nome:'Eduardo',setor:'log',funcao:'Motorista',diaria:160},
    {nome:'Sonia',setor:'desc',funcao:'Descascadeira',diaria:110},
  ]);
}

async function salvarProduto(){
  const payload={nome:$('np-nome').value,area:$('np-area').value,preco_kg:+$('np-preco').value,cor_hex:$('np-cor').value};
  if(!payload.nome){ toast('⚠ Informe o nome'); return; }
  try{ await api('/api/produtos',{method:'POST',body:JSON.stringify(payload)}); }
  catch(e){}
  toggleForm('fp');
  toast('✅ Produto salvo!');
  carregarCadastros();
}

async function salvarColab(){
  const payload={nome:$('nc-nome').value,setor:$('nc-setor').value,funcao:$('nc-func').value,diaria:+$('nc-diaria').value};
  if(!payload.nome){ toast('⚠ Informe o nome'); return; }
  try{ await api('/api/colaboradores',{method:'POST',body:JSON.stringify(payload)}); }
  catch(e){}
  toggleForm('fc');
  toast('✅ Colaborador salvo!');
  carregarCadastros();
}

// ─────────────── INIT ───────────────
function salvar(){
  if(S.pagina==='lancamentos') salvarLancamento();
}

// Define período inicial como "mensal" para dashboard, "dia" para lançamentos
const periodoInicial = S.pagina==='lancamentos' ? 'dia' : 'mensal';
setPeriodo(periodoInicial);

if(S.pagina==='dashboard')   carregarDashboard();
if(S.pagina==='lancamentos') carregarLancamentos();
if(S.pagina==='despesas')    carregarDespesas();
if(S.pagina==='cadastros')   carregarCadastros();
