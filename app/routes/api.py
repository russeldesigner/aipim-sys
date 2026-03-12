from flask import Blueprint, jsonify, request
from flask_login import login_required, current_user
from datetime import date, timedelta
from sqlalchemy import func
from ..models import db, Lancamento, Despesa, Produto, Colaborador, MovimentoEstoque
import calendar

api_bp = Blueprint('api', __name__)

# ── Enums aceitos ──
_STATUS_VALIDOS   = {'rascunho', 'finalizado'}
_TIPO_DESP        = {'entrada', 'saida'}
_TIPO_MOV         = {'abertura', 'producao', 'saida', 'perda'}
_AREA_PROD        = {'galp', 'coz', 'ambos'}
_SETOR_COLAB      = {'roca', 'galp', 'coz', 'desc', 'obra', 'log'}


# ─────────────────────────────────────
#  HELPERS
# ─────────────────────────────────────
def _json():
    """Retorna parsed JSON ou {} — nunca None."""
    return request.get_json(silent=True, force=True) or {}


def _bad(msg, code=400):
    return jsonify({'erro': msg}), code


def _parse_date(s):
    """Converte string ISO para date ou lança ValueError."""
    return date.fromisoformat(str(s))


def _parse_float(v, default=0.0):
    try:
        return float(v)
    except (TypeError, ValueError):
        return default


def _ultimo_dia(ano, mes):
    return calendar.monthrange(ano, mes)[1]


_PERIODOS_VALIDOS = {'dia','semana','quinzena','mensal','trimestral','semestral','anual'}

def period_range(tipo, idx):
    if tipo not in _PERIODOS_VALIDOS:
        tipo = 'dia'   # fallback seguro
    hoje = date.today()
    idx  = abs(int(idx or 0))

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


# ─────────────────────────────────────
#  DASHBOARD
# ─────────────────────────────────────
@api_bp.route('/dashboard')
@login_required
def dashboard_data():
    tipo = request.args.get('tipo', 'mensal')
    idx  = request.args.get('idx', 0, type=int)
    ini, fim = period_range(tipo, idx)

    receita = db.session.query(func.sum(Despesa.valor)).filter(
        Despesa.tipo == 'entrada', Despesa.data.between(ini, fim)
    ).scalar() or 0

    custo = db.session.query(func.sum(Despesa.valor)).filter(
        Despesa.tipo == 'saida', Despesa.data.between(ini, fim)
    ).scalar() or 0

    kg_prod = db.session.query(func.sum(MovimentoEstoque.quantidade)).join(Lancamento).filter(
        MovimentoEstoque.tipo == 'producao', Lancamento.data.between(ini, fim)
    ).scalar() or 0

    km_strada = db.session.query(
        func.sum(Lancamento.km_fim_strada - Lancamento.km_ini_strada)
    ).filter(Lancamento.data.between(ini, fim)).scalar() or 0

    km_ducato = db.session.query(
        func.sum(Lancamento.km_fim_ducato - Lancamento.km_ini_ducato)
    ).filter(Lancamento.data.between(ini, fim)).scalar() or 0

    custos_cat = db.session.query(
        Despesa.categoria, func.sum(Despesa.valor).label('total')
    ).filter(Despesa.tipo == 'saida', Despesa.data.between(ini, fim)
    ).group_by(Despesa.categoria).all()

    dias_op = db.session.query(func.count(func.distinct(Lancamento.data))).filter(
        Lancamento.data.between(ini, fim)
    ).scalar() or 0

    lucro  = receita - custo
    margem = (lucro / receita * 100) if receita > 0 else 0

    return jsonify({
        'periodo':        {'inicio': ini.isoformat(), 'fim': fim.isoformat()},
        'receita':        receita,   'custo':    custo,
        'lucro':          lucro,     'margem':   round(margem, 2),
        'kg_prod':        round(kg_prod, 1),
        'km_strada':      round(km_strada, 0),
        'km_ducato':      round(km_ducato, 0),
        'dias_op':        dias_op,
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
    l = db.get_or_404(Lancamento, lid)
    movs = [{
        'produto_id': m.produto_id, 'produto': m.produto.nome,
        'tipo': m.tipo, 'quantidade': m.quantidade, 'preco_unit': m.preco_unit,
    } for m in l.movimentos]
    return jsonify({
        'id': l.id, 'data': l.data.isoformat(), 'status': l.status,
        'cx_mad_branca': l.cx_mad_branca, 'cx_plast_branca': l.cx_plast_branca,
        'cx_plast_amarela': l.cx_plast_amarela, 'cx_amarela': l.cx_amarela,
        'peso_medio': l.peso_medio, 'mo_roca': l.mo_roca,
        'hrs_trator1': l.hrs_trator1, 'hrs_trator2': l.hrs_trator2,
        'km_ini_strada': l.km_ini_strada, 'km_fim_strada': l.km_fim_strada,
        'km_ini_ducato': l.km_ini_ducato, 'km_fim_ducato': l.km_fim_ducato,
        'motorista1': l.motorista1, 'motorista2': l.motorista2, 'motorista3': l.motorista3,
        'mo_galp': l.mo_galp, 'mo_desc': l.mo_desc, 'mo_coz': l.mo_coz,
        'mo_obra': l.mo_obra, 'cafe': l.cafe, 'imposto': l.imposto,
        'pedagio': l.pedagio, 'estacionamento': l.estacionamento,
        'obs': l.obs, 'movimentos': movs,
        'custo_total': l.custo_total, 'venda_bruta': l.venda_bruta, 'lucro': l.lucro,
    })


@api_bp.route('/lancamentos', methods=['POST'])
@login_required
def criar_lancamento():
    d = _json()

    # ── Validação de data ──
    try:
        data_lanc = _parse_date(d.get('data', date.today().isoformat()))
    except ValueError:
        return _bad('Data inválida. Use formato YYYY-MM-DD.')

    if data_lanc > date.today():
        return _bad('Não é possível criar lançamento com data futura.')

    # Validação de KM (odômetros)
    km_ini_s = _parse_float(d.get('km_ini_strada'))
    km_fim_s = _parse_float(d.get('km_fim_strada'))
    km_ini_d = _parse_float(d.get('km_ini_ducato'))
    km_fim_d = _parse_float(d.get('km_fim_ducato'))
    if km_fim_s > 0 and km_fim_s < km_ini_s:
        return _bad('km_fim_strada não pode ser menor que km_ini_strada.')
    if km_fim_d > 0 and km_fim_d < km_ini_d:
        return _bad('km_fim_ducato não pode ser menor que km_ini_ducato.')

    existente = Lancamento.query.filter_by(data=data_lanc).first()
    if existente:
        return jsonify({'erro': 'Já existe lançamento para esta data.', 'id': existente.id}), 409

    status = d.get('status', 'rascunho')
    if status not in _STATUS_VALIDOS:
        return _bad(f'Status inválido. Use: {", ".join(_STATUS_VALIDOS)}')

    # ── Validação de movimentos ──
    movimentos_raw = d.get('movimentos', [])
    if not isinstance(movimentos_raw, list):
        return _bad('movimentos deve ser uma lista.')
    for i, mov in enumerate(movimentos_raw):
        if not isinstance(mov.get('produto_id'), int):
            return _bad(f'movimentos[{i}].produto_id deve ser inteiro.')
        if mov.get('tipo') not in _TIPO_MOV:
            return _bad(f'movimentos[{i}].tipo inválido. Use: {", ".join(_TIPO_MOV)}')

    l = Lancamento(
        data=data_lanc, usuario_id=current_user.id, status=status,
        cx_mad_branca=int(d.get('cx_mad_branca') or 0),
        cx_plast_branca=int(d.get('cx_plast_branca') or 0),
        cx_plast_amarela=int(d.get('cx_plast_amarela') or 0),
        cx_amarela=int(d.get('cx_amarela') or 0),
        peso_medio=_parse_float(d.get('peso_medio')),
        mo_roca=_parse_float(d.get('mo_roca')),
        hrs_trator1=_parse_float(d.get('hrs_trator1')),
        hrs_trator2=_parse_float(d.get('hrs_trator2')),
        km_ini_strada=_parse_float(d.get('km_ini_strada')),
        km_fim_strada=_parse_float(d.get('km_fim_strada')),
        km_ini_ducato=_parse_float(d.get('km_ini_ducato')),
        km_fim_ducato=_parse_float(d.get('km_fim_ducato')),
        motorista1=str(d['motorista1'])[:60] if d.get('motorista1') else None,
        motorista2=str(d['motorista2'])[:60] if d.get('motorista2') else None,
        motorista3=str(d['motorista3'])[:60] if d.get('motorista3') else None,
        mo_galp=_parse_float(d.get('mo_galp')),
        mo_desc=_parse_float(d.get('mo_desc')),
        mo_coz=_parse_float(d.get('mo_coz')),
        mo_obra=_parse_float(d.get('mo_obra')),
        cafe=_parse_float(d.get('cafe')),
        imposto=_parse_float(d.get('imposto')),
        pedagio=_parse_float(d.get('pedagio')),
        estacionamento=_parse_float(d.get('estacionamento')),
        obs=str(d['obs'])[:2000] if d.get('obs') else None,
    )
    db.session.add(l)

    # Valida FKs de produtos antes de qualquer insert
    pids_validos = {p.id for p in Produto.query.filter(
        Produto.id.in_([m['produto_id'] for m in movimentos_raw]), Produto.ativo == True
    ).all()} if movimentos_raw else set()
    for i, mov in enumerate(movimentos_raw):
        if mov['produto_id'] not in pids_validos:
            return _bad(f"movimentos[{i}].produto_id {mov['produto_id']} não encontrado ou inativo.")

    # Valida FKs de produtos antes de qualquer insert
    if movimentos_raw:
        pids_validos = {p.id for p in Produto.query.filter(
            Produto.id.in_([m['produto_id'] for m in movimentos_raw]),
            Produto.ativo == True
        ).all()}
        for i, mov in enumerate(movimentos_raw):
            if mov['produto_id'] not in pids_validos:
                return _bad(f"movimentos[{i}].produto_id {mov['produto_id']} não encontrado ou inativo.")

    for mov in movimentos_raw:
        db.session.add(MovimentoEstoque(
            lancamento=l,
            produto_id=mov['produto_id'],
            tipo=mov['tipo'],
            quantidade=_parse_float(mov.get('quantidade')),
            preco_unit=_parse_float(mov.get('preco_unit')),
        ))

    db.session.commit()
    return jsonify({'ok': True, 'id': l.id}), 201


@api_bp.route('/lancamentos/<int:lid>', methods=['PUT'])
@login_required
def atualizar_lancamento(lid):
    l = db.get_or_404(Lancamento, lid)
    d = _json()

    if 'status' in d and d['status'] not in _STATUS_VALIDOS:
        return _bad(f'Status inválido. Use: {", ".join(_STATUS_VALIDOS)}')

    campos_str  = ['motorista1', 'motorista2', 'motorista3', 'obs']
    campos_float = [
        'peso_medio', 'mo_roca', 'hrs_trator1', 'hrs_trator2',
        'km_ini_strada', 'km_fim_strada', 'km_ini_ducato', 'km_fim_ducato',
        'mo_galp', 'mo_desc', 'mo_coz', 'mo_obra',
        'cafe', 'imposto', 'pedagio', 'estacionamento',
    ]
    campos_int  = ['cx_mad_branca', 'cx_plast_branca', 'cx_plast_amarela', 'cx_amarela']

    for c in campos_float:
        if c in d: setattr(l, c, _parse_float(d[c]))
    for c in campos_int:
        if c in d: setattr(l, c, int(d[c] or 0))
    for c in campos_str:
        if c in d: setattr(l, c, str(d[c])[:2000] if d[c] else None)
    if 'status' in d:
        l.status = d['status']

    if 'movimentos' in d:
        movimentos_raw = d['movimentos']
        if not isinstance(movimentos_raw, list):
            return _bad('movimentos deve ser uma lista.')
        db.session.query(MovimentoEstoque).filter_by(lancamento_id=l.id).delete()
        for i, mov in enumerate(movimentos_raw):
            if not isinstance(mov.get('produto_id'), int):
                return _bad(f'movimentos[{i}].produto_id deve ser inteiro.')
            if mov.get('tipo') not in _TIPO_MOV:
                return _bad(f'movimentos[{i}].tipo inválido.')
            db.session.add(MovimentoEstoque(
                lancamento=l, produto_id=mov['produto_id'], tipo=mov['tipo'],
                quantidade=_parse_float(mov.get('quantidade')),
                preco_unit=_parse_float(mov.get('preco_unit')),
            ))

    db.session.commit()
    return jsonify({'ok': True})


@api_bp.route('/lancamentos/<int:lid>', methods=['DELETE'])
@login_required
def deletar_lancamento(lid):
    if not current_user.pode_gerenciar:
        return _bad('Sem permissão.', 403)
    l = db.get_or_404(Lancamento, lid)
    db.session.delete(l)
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
    tp   = request.args.get('tp', '')
    ini, fim = period_range(tipo, idx)

    q = Despesa.query.filter(Despesa.data.between(ini, fim))
    if cat: q = q.filter(Despesa.categoria == cat)
    if tp and tp in _TIPO_DESP:
        q = q.filter(Despesa.tipo == tp)

    despesas    = q.order_by(Despesa.data.desc()).all()
    total_ent   = sum(d.valor for d in despesas if d.tipo == 'entrada')
    total_sai   = sum(d.valor for d in despesas if d.tipo == 'saida')

    return jsonify({
        'total_entrada': total_ent, 'total_saida': total_sai,
        'saldo': total_ent - total_sai, 'qtd': len(despesas),
        'itens': [{
            'id': d.id, 'data': d.data.isoformat(), 'tipo': d.tipo,
            'categoria': d.categoria, 'descricao': d.descricao, 'valor': d.valor,
        } for d in despesas]
    })


@api_bp.route('/despesas', methods=['POST'])
@login_required
def criar_despesa():
    if not current_user.pode_ver_financeiro:
        return _bad('Sem permissão.', 403)
    d = _json()

    # Validações obrigatórias
    erros = []
    if not d.get('data'):        erros.append('data obrigatória')
    if not d.get('tipo'):        erros.append('tipo obrigatório')
    if not d.get('categoria'):   erros.append('categoria obrigatória')
    if d.get('valor') is None:   erros.append('valor obrigatório')
    if erros:
        return _bad('; '.join(erros))

    if d['tipo'] not in _TIPO_DESP:
        return _bad(f'tipo inválido. Use: {", ".join(_TIPO_DESP)}')

    try:
        data_desp = _parse_date(d['data'])
    except ValueError:
        return _bad('Data inválida. Use YYYY-MM-DD.')

    try:
        valor = float(d['valor'])
        if valor <= 0:
            return _bad('Valor deve ser positivo.')
    except (TypeError, ValueError):
        return _bad('Valor inválido.')

    desp = Despesa(
        data=data_desp,
        tipo=d['tipo'],
        categoria=str(d['categoria'])[:40],
        descricao=str(d.get('descricao', ''))[:200],
        valor=valor,
        usuario_id=current_user.id,
    )
    db.session.add(desp)
    db.session.commit()
    return jsonify({'ok': True, 'id': desp.id}), 201


@api_bp.route('/despesas/<int:did>', methods=['PUT'])
@login_required
def atualizar_despesa(did):
    if not current_user.pode_ver_financeiro:
        return _bad('Sem permissão.', 403)
    desp = db.get_or_404(Despesa, did)
    d = _json()

    if 'data' in d:
        try:
            desp.data = _parse_date(d['data'])
        except ValueError:
            return _bad('Data inválida.')
    if 'tipo' in d:
        if d['tipo'] not in _TIPO_DESP:
            return _bad(f'tipo inválido. Use: {", ".join(_TIPO_DESP)}')
        desp.tipo = d['tipo']
    if 'categoria' in d:
        desp.categoria = str(d['categoria'])[:40]
    if 'descricao' in d:
        desp.descricao = str(d['descricao'])[:200]
    if 'valor' in d:
        try:
            desp.valor = float(d['valor'])
        except (TypeError, ValueError):
            return _bad('Valor inválido.')

    db.session.commit()
    return jsonify({'ok': True})


@api_bp.route('/despesas/<int:did>', methods=['DELETE'])
@login_required
def deletar_despesa(did):
    if not current_user.pode_ver_financeiro:
        return _bad('Sem permissão.', 403)
    desp = db.get_or_404(Despesa, did)
    db.session.delete(desp)
    db.session.commit()
    return jsonify({'ok': True})


# ─────────────────────────────────────
#  PRODUTOS
# ─────────────────────────────────────
@api_bp.route('/produtos', methods=['GET'])
@login_required
def listar_produtos():
    prods = Produto.query.filter_by(ativo=True).order_by(Produto.nome).all()
    return jsonify([{
        'id': p.id, 'nome': p.nome, 'area': p.area,
        'preco_kg': p.preco_kg, 'cor_hex': p.cor_hex,
    } for p in prods])


@api_bp.route('/produtos', methods=['POST'])
@login_required
def criar_produto():
    if not current_user.pode_gerenciar:
        return _bad('Sem permissão.', 403)
    d = _json()

    nome = str(d.get('nome', '')).strip()[:60]
    if not nome:
        return _bad('nome obrigatório.')

    area = d.get('area', 'galp')
    if area not in _AREA_PROD:
        return _bad(f'area inválida. Use: {", ".join(_AREA_PROD)}')

    # cor_hex: valida formato #RRGGBB
    cor = str(d.get('cor_hex', '#1A6B50')).strip()
    if len(cor) != 7 or cor[0] != '#':
        cor = '#1A6B50'

    p = Produto(nome=nome, area=area, preco_kg=_parse_float(d.get('preco_kg')), cor_hex=cor)
    db.session.add(p)
    db.session.commit()
    return jsonify({'ok': True, 'id': p.id}), 201


@api_bp.route('/produtos/<int:pid>', methods=['PUT'])
@login_required
def atualizar_produto(pid):
    if not current_user.pode_gerenciar:
        return _bad('Sem permissão.', 403)
    p = db.get_or_404(Produto, pid)
    d = _json()

    if 'nome' in d:
        nome = str(d['nome']).strip()[:60]
        if not nome: return _bad('nome não pode ser vazio.')
        p.nome = nome
    if 'area' in d:
        if d['area'] not in _AREA_PROD:
            return _bad(f'area inválida. Use: {", ".join(_AREA_PROD)}')
        p.area = d['area']
    if 'preco_kg' in d:
        p.preco_kg = _parse_float(d['preco_kg'])
    if 'cor_hex' in d:
        cor = str(d['cor_hex']).strip()
        p.cor_hex = cor if len(cor) == 7 and cor[0] == '#' else p.cor_hex
    if 'ativo' in d:
        p.ativo = bool(d['ativo'])

    db.session.commit()
    return jsonify({'ok': True})


@api_bp.route('/produtos/<int:pid>', methods=['DELETE'])
@login_required
def deletar_produto(pid):
    if not current_user.pode_gerenciar:
        return _bad('Sem permissão.', 403)
    p = db.get_or_404(Produto, pid)
    p.ativo = False
    db.session.commit()
    return jsonify({'ok': True})


# ─────────────────────────────────────
#  COLABORADORES
# ─────────────────────────────────────
@api_bp.route('/colaboradores', methods=['GET'])
@login_required
def listar_colaboradores():
    cols = Colaborador.query.filter_by(ativo=True).order_by(Colaborador.nome).all()
    return jsonify([{
        'id': c.id, 'nome': c.nome, 'setor': c.setor,
        'funcao': c.funcao, 'diaria': c.diaria,
    } for c in cols])


@api_bp.route('/colaboradores', methods=['POST'])
@login_required
def criar_colaborador():
    if not current_user.pode_gerenciar:
        return _bad('Sem permissão.', 403)
    d = _json()

    nome = str(d.get('nome', '')).strip()[:100]
    if not nome:
        return _bad('nome obrigatório.')

    setor = d.get('setor', 'galp')
    if setor not in _SETOR_COLAB:
        return _bad(f'setor inválido. Use: {", ".join(_SETOR_COLAB)}')

    diaria = _parse_float(d.get('diaria'))
    if diaria < 0:
        return _bad('Diária não pode ser negativa.')
    c = Colaborador(
        nome=nome, setor=setor,
        funcao=str(d.get('funcao', ''))[:60],
        diaria=diaria,
    )
    db.session.add(c)
    db.session.commit()
    return jsonify({'ok': True, 'id': c.id}), 201


@api_bp.route('/colaboradores/<int:cid>', methods=['PUT'])
@login_required
def atualizar_colaborador(cid):
    if not current_user.pode_gerenciar:
        return _bad('Sem permissão.', 403)
    c = db.get_or_404(Colaborador, cid)
    d = _json()

    if 'nome' in d:
        nome = str(d['nome']).strip()[:100]
        if not nome: return _bad('nome não pode ser vazio.')
        c.nome = nome
    if 'setor' in d:
        if d['setor'] not in _SETOR_COLAB:
            return _bad(f'setor inválido. Use: {", ".join(_SETOR_COLAB)}')
        c.setor = d['setor']
    if 'funcao' in d:
        c.funcao = str(d['funcao'])[:60]
    if 'diaria' in d:
        diaria = _parse_float(d['diaria'])
        if diaria < 0:
            return _bad('Diária não pode ser negativa.')
        c.diaria = diaria
    if 'ativo' in d:
        c.ativo = bool(d['ativo'])

    db.session.commit()
    return jsonify({'ok': True})


@api_bp.route('/colaboradores/<int:cid>', methods=['DELETE'])
@login_required
def deletar_colaborador(cid):
    if not current_user.pode_gerenciar:
        return _bad('Sem permissão.', 403)
    c = db.get_or_404(Colaborador, cid)
    c.ativo = False
    db.session.commit()
    return jsonify({'ok': True})
