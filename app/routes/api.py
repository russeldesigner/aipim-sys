from flask import Blueprint, jsonify, request
from flask_login import login_required, current_user
from datetime import date, timedelta, datetime
from sqlalchemy import func, extract
from ..models import db, Lancamento, Despesa, Produto, Colaborador, MovimentoEstoque

api_bp = Blueprint('api', __name__)

# ─────────────────────────────────────
#  HELPERS
# ─────────────────────────────────────
def period_range(tipo, idx):
    """Retorna (data_inicio, data_fim) para o período solicitado."""
    hoje = date.today()
    idx = abs(int(idx or 0))

    if tipo == 'dia':
        d = hoje - timedelta(days=idx)
        return d, d

    if tipo == 'semana':
        ini = hoje - timedelta(days=hoje.weekday()) - timedelta(weeks=idx)
        return ini, ini + timedelta(days=6)

    if tipo == 'quinzena':
        if hoje.day <= 15:
            base_ini = date(hoje.year, hoje.month, 1)
            base_fim = date(hoje.year, hoje.month, 15)
        else:
            base_ini = date(hoje.year, hoje.month, 16)
            base_fim = date(hoje.year, hoje.month, _ultimo_dia(hoje.year, hoje.month))
        steps = idx
        while steps > 0:
            if base_ini.day == 1:
                mes = base_ini.month - 1 or 12
                ano = base_ini.year if base_ini.month > 1 else base_ini.year - 1
                base_ini = date(ano, mes, 16)
                base_fim = date(ano, mes, _ultimo_dia(ano, mes))
            else:
                base_ini = date(base_ini.year, base_ini.month, 1)
                base_fim = date(base_ini.year, base_ini.month, 15)
            steps -= 1
        return base_ini, base_fim

    if tipo == 'mensal':
        ano, mes = hoje.year, hoje.month
        for _ in range(idx):
            mes -= 1
            if mes == 0:
                mes = 12; ano -= 1
        return date(ano, mes, 1), date(ano, mes, _ultimo_dia(ano, mes))

    if tipo == 'trimestral':
        trim = (hoje.month - 1) // 3 - idx
        ano  = hoje.year + trim // 4
        trim = trim % 4
        if trim < 0: trim += 4; ano -= 1
        m_ini = trim * 3 + 1
        m_fim = m_ini + 2
        return date(ano, m_ini, 1), date(ano, m_fim, _ultimo_dia(ano, m_fim))

    if tipo == 'semestral':
        sem = (1 if hoje.month <= 6 else 2) - idx
        ano = hoje.year
        while sem <= 0: sem += 2; ano -= 1
        if sem == 1: return date(ano, 1, 1), date(ano, 6, 30)
        return date(ano, 7, 1), date(ano, 12, 31)

    if tipo == 'anual':
        ano = hoje.year - idx
        return date(ano, 1, 1), date(ano, 12, 31)

    return hoje, hoje


def _ultimo_dia(ano, mes):
    import calendar
    return calendar.monthrange(ano, mes)[1]


def fmt_brl(v):
    return f"R$ {v:,.2f}".replace(',', 'X').replace('.', ',').replace('X', '.')


# ─────────────────────────────────────
#  DASHBOARD
# ─────────────────────────────────────
@api_bp.route('/dashboard')
@login_required
def dashboard_data():
    tipo = request.args.get('tipo', 'mensal')
    idx  = request.args.get('idx', 0, type=int)
    ini, fim = period_range(tipo, idx)

    # Receita via despesas (entradas)
    receita = db.session.query(func.sum(Despesa.valor)).filter(
        Despesa.tipo == 'entrada',
        Despesa.data.between(ini, fim)
    ).scalar() or 0

    # Custo via despesas (saídas)
    custo = db.session.query(func.sum(Despesa.valor)).filter(
        Despesa.tipo == 'saida',
        Despesa.data.between(ini, fim)
    ).scalar() or 0

    # KG produzido via movimentos
    kg_prod = db.session.query(func.sum(MovimentoEstoque.quantidade)).join(Lancamento).filter(
        MovimentoEstoque.tipo == 'producao',
        Lancamento.data.between(ini, fim)
    ).scalar() or 0

    # KM rodados via lançamentos
    km_strada = db.session.query(
        func.sum(Lancamento.km_fim_strada - Lancamento.km_ini_strada)
    ).filter(Lancamento.data.between(ini, fim)).scalar() or 0

    km_ducato = db.session.query(
        func.sum(Lancamento.km_fim_ducato - Lancamento.km_ini_ducato)
    ).filter(Lancamento.data.between(ini, fim)).scalar() or 0

    # Custos por categoria
    custos_cat = db.session.query(
        Despesa.categoria,
        func.sum(Despesa.valor).label('total')
    ).filter(
        Despesa.tipo == 'saida',
        Despesa.data.between(ini, fim)
    ).group_by(Despesa.categoria).all()

    # Dias operados
    dias_op = db.session.query(func.count(func.distinct(Lancamento.data))).filter(
        Lancamento.data.between(ini, fim)
    ).scalar() or 0

    lucro  = receita - custo
    margem = (lucro / receita * 100) if receita > 0 else 0

    return jsonify({
        'periodo': {'inicio': ini.isoformat(), 'fim': fim.isoformat()},
        'receita': receita, 'custo': custo, 'lucro': lucro,
        'margem': round(margem, 2),
        'kg_prod': round(kg_prod, 1),
        'km_strada': round(km_strada, 0),
        'km_ducato': round(km_ducato, 0),
        'dias_op': dias_op,
        'custos_por_cat': [{'cat': r.categoria, 'val': r.total} for r in custos_cat],
    })


# ─────────────────────────────────────
#  LANÇAMENTOS
# ─────────────────────────────────────
@api_bp.route('/lancamentos', methods=['GET'])
@login_required
def listar_lancamentos():
    tipo = request.args.get('tipo', 'dia')
    idx  = request.args.get('idx', 0, type=int)
    ini, fim = period_range(tipo, idx)

    lancs = Lancamento.query.filter(
        Lancamento.data.between(ini, fim)
    ).order_by(Lancamento.data.desc()).all()

    return jsonify([{
        'id': l.id, 'data': l.data.isoformat(), 'status': l.status,
        'custo_total': l.custo_total, 'venda_bruta': l.venda_bruta,
        'lucro': l.lucro, 'autor': l.autor.nome if l.autor else '—',
    } for l in lancs])


@api_bp.route('/lancamentos/<int:lid>', methods=['GET'])
@login_required
def get_lancamento(lid):
    l = Lancamento.query.get_or_404(lid)
    movs = [{
        'produto_id': m.produto_id,
        'produto': m.produto.nome,
        'tipo': m.tipo,
        'quantidade': m.quantidade,
        'preco_unit': m.preco_unit,
    } for m in l.movimentos]
    return jsonify({
        'id': l.id, 'data': l.data.isoformat(), 'status': l.status,
        'cx_mad_branca': l.cx_mad_branca, 'cx_plast_branca': l.cx_plast_branca,
        'cx_plast_amarela': l.cx_plast_amarela, 'cx_amarela': l.cx_amarela,
        'peso_medio': l.peso_medio, 'mo_roca': l.mo_roca,
        'hrs_trator1': l.hrs_trator1, 'hrs_trator2': l.hrs_trator2,
        'km_ini_strada': l.km_ini_strada, 'km_fim_strada': l.km_fim_strada,
        'km_ini_ducato': l.km_ini_ducato, 'km_fim_ducato': l.km_fim_ducato,
        'motorista1': l.motorista1, 'motorista2': l.motorista2,
        'mo_galp': l.mo_galp, 'mo_desc': l.mo_desc, 'mo_coz': l.mo_coz,
        'mo_obra': l.mo_obra, 'cafe': l.cafe, 'imposto': l.imposto,
        'pedagio': l.pedagio, 'estacionamento': l.estacionamento,
        'obs': l.obs, 'movimentos': movs,
        'custo_total': l.custo_total, 'venda_bruta': l.venda_bruta, 'lucro': l.lucro,
    })


@api_bp.route('/lancamentos', methods=['POST'])
@login_required
def criar_lancamento():
    d = request.get_json()
    data_lanc = date.fromisoformat(d.get('data', date.today().isoformat()))

    # Verifica duplicata
    existente = Lancamento.query.filter_by(data=data_lanc).first()
    if existente:
        return jsonify({'erro': 'Já existe lançamento para esta data.', 'id': existente.id}), 409

    l = Lancamento(
        data=data_lanc, usuario_id=current_user.id,
        status=d.get('status', 'rascunho'),
        cx_mad_branca=d.get('cx_mad_branca', 0),
        cx_plast_branca=d.get('cx_plast_branca', 0),
        cx_plast_amarela=d.get('cx_plast_amarela', 0),
        cx_amarela=d.get('cx_amarela', 0),
        peso_medio=d.get('peso_medio', 0),
        mo_roca=d.get('mo_roca', 0), hrs_trator1=d.get('hrs_trator1', 0),
        hrs_trator2=d.get('hrs_trator2', 0),
        km_ini_strada=d.get('km_ini_strada', 0), km_fim_strada=d.get('km_fim_strada', 0),
        km_ini_ducato=d.get('km_ini_ducato', 0), km_fim_ducato=d.get('km_fim_ducato', 0),
        motorista1=d.get('motorista1'), motorista2=d.get('motorista2'), motorista3=d.get('motorista3'),
        mo_galp=d.get('mo_galp', 0), mo_desc=d.get('mo_desc', 0),
        mo_coz=d.get('mo_coz', 0), mo_obra=d.get('mo_obra', 0),
        cafe=d.get('cafe', 0), imposto=d.get('imposto', 0),
        pedagio=d.get('pedagio', 0), estacionamento=d.get('estacionamento', 0),
        obs=d.get('obs'),
    )
    db.session.add(l)

    for mov in d.get('movimentos', []):
        db.session.add(MovimentoEstoque(
            lancamento=l,
            produto_id=mov['produto_id'],
            tipo=mov['tipo'],
            quantidade=mov.get('quantidade', 0),
            preco_unit=mov.get('preco_unit', 0),
        ))

    db.session.commit()
    return jsonify({'ok': True, 'id': l.id}), 201


@api_bp.route('/lancamentos/<int:lid>', methods=['PUT'])
@login_required
def atualizar_lancamento(lid):
    l = Lancamento.query.get_or_404(lid)
    d = request.get_json()

    campos = ['cx_mad_branca','cx_plast_branca','cx_plast_amarela','cx_amarela',
              'peso_medio','mo_roca','hrs_trator1','hrs_trator2',
              'km_ini_strada','km_fim_strada','km_ini_ducato','km_fim_ducato',
              'motorista1','motorista2','motorista3',
              'mo_galp','mo_desc','mo_coz','mo_obra','cafe','imposto',
              'pedagio','estacionamento','obs','status']
    for c in campos:
        if c in d:
            setattr(l, c, d[c])

    if 'movimentos' in d:
        l.movimentos.delete()
        for mov in d['movimentos']:
            db.session.add(MovimentoEstoque(
                lancamento=l, produto_id=mov['produto_id'],
                tipo=mov['tipo'], quantidade=mov.get('quantidade', 0),
                preco_unit=mov.get('preco_unit', 0),
            ))

    db.session.commit()
    return jsonify({'ok': True})


# ─────────────────────────────────────
#  DESPESAS
# ─────────────────────────────────────
@api_bp.route('/despesas', methods=['GET'])
@login_required
def listar_despesas():
    tipo = request.args.get('tipo', 'dia')
    idx  = request.args.get('idx', 0, type=int)
    cat  = request.args.get('cat', '')
    tp   = request.args.get('tp', '')   # entrada | saida
    ini, fim = period_range(tipo, idx)

    q = Despesa.query.filter(Despesa.data.between(ini, fim))
    if cat:  q = q.filter(Despesa.categoria == cat)
    if tp:   q = q.filter(Despesa.tipo == tp)

    despesas = q.order_by(Despesa.data.desc()).all()
    total_ent = sum(d.valor for d in despesas if d.tipo == 'entrada')
    total_sai = sum(d.valor for d in despesas if d.tipo == 'saida')

    return jsonify({
        'total_entrada': total_ent,
        'total_saida':   total_sai,
        'saldo':         total_ent - total_sai,
        'qtd':           len(despesas),
        'itens': [{
            'id': d.id, 'data': d.data.isoformat(), 'tipo': d.tipo,
            'categoria': d.categoria, 'descricao': d.descricao, 'valor': d.valor,
        } for d in despesas]
    })


@api_bp.route('/despesas', methods=['POST'])
@login_required
def criar_despesa():
    if not current_user.pode_ver_financeiro:
        return jsonify({'erro': 'Sem permissão.'}), 403
    d = request.get_json()
    desp = Despesa(
        data=date.fromisoformat(d['data']),
        tipo=d['tipo'], categoria=d['categoria'],
        descricao=d.get('descricao', ''),
        valor=float(d['valor']),
        usuario_id=current_user.id,
    )
    db.session.add(desp)
    db.session.commit()
    return jsonify({'ok': True, 'id': desp.id}), 201


@api_bp.route('/despesas/<int:did>', methods=['DELETE'])
@login_required
def deletar_despesa(did):
    if not current_user.pode_ver_financeiro:
        return jsonify({'erro': 'Sem permissão.'}), 403
    d = Despesa.query.get_or_404(did)
    db.session.delete(d)
    db.session.commit()
    return jsonify({'ok': True})


# ─────────────────────────────────────
#  CADASTROS
# ─────────────────────────────────────
@api_bp.route('/produtos', methods=['GET'])
@login_required
def listar_produtos():
    prods = Produto.query.filter_by(ativo=True).all()
    return jsonify([{'id':p.id,'nome':p.nome,'area':p.area,'preco_kg':p.preco_kg,'cor_hex':p.cor_hex} for p in prods])


@api_bp.route('/colaboradores', methods=['GET'])
@login_required
def listar_colaboradores():
    cols = Colaborador.query.filter_by(ativo=True).all()
    return jsonify([{'id':c.id,'nome':c.nome,'setor':c.setor,'funcao':c.funcao,'diaria':c.diaria} for c in cols])
