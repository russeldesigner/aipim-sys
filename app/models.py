from datetime import datetime, date
from flask_sqlalchemy import SQLAlchemy
from flask_login import UserMixin
from werkzeug.security import generate_password_hash, check_password_hash

db = SQLAlchemy()

# ─────────────────────────────────────
#  USUÁRIOS / PERFIS
# ─────────────────────────────────────
class Usuario(UserMixin, db.Model):
    __tablename__ = 'usuarios'
    id         = db.Column(db.Integer, primary_key=True)
    nome       = db.Column(db.String(100), nullable=False)
    email      = db.Column(db.String(120), unique=True, nullable=False)
    senha_hash = db.Column(db.String(256), nullable=False)
    perfil     = db.Column(db.String(30), nullable=False, default='operador')
    # perfis: admin | gestor_op | gestor_log | op_galp | op_coz | op_log
    ativo      = db.Column(db.Boolean, default=True)
    criado_em  = db.Column(db.DateTime, default=datetime.utcnow)

    lancamentos = db.relationship('Lancamento', backref='autor', lazy='dynamic')
    despesas    = db.relationship('Despesa',    backref='autor', lazy='dynamic')

    def set_senha(self, senha):
        self.senha_hash = generate_password_hash(senha)

    def check_senha(self, senha):
        return check_password_hash(self.senha_hash, senha)

    @property
    def areas_permitidas(self):
        mapa = {
            'admin':      ['roca','galp','desc','coz','obra','log'],
            'gestor_op':  ['roca','galp','desc','coz','obra','log'],
            'gestor_log': ['roca','galp','desc','coz','obra','log'],
            'op_galp':    ['roca','galp','desc'],
            'op_coz':     ['coz'],
            'op_log':     ['log'],
        }
        return mapa.get(self.perfil, [])

    @property
    def pode_ver_financeiro(self):
        return self.perfil in ('admin','gestor_op','gestor_log')

    @property
    def pode_gerenciar(self):
        return self.perfil in ('admin','gestor_op','gestor_log')

    def __repr__(self):
        return f'<Usuario {self.nome} [{self.perfil}]>'


# ─────────────────────────────────────
#  PRODUTOS
# ─────────────────────────────────────
class Produto(db.Model):
    __tablename__ = 'produtos'
    id       = db.Column(db.Integer, primary_key=True)
    nome     = db.Column(db.String(60), nullable=False)
    area     = db.Column(db.String(20))   # galp | coz | ambos
    preco_kg = db.Column(db.Float, default=0.0)
    cor_hex  = db.Column(db.String(7), default='#1A6B50')
    ativo    = db.Column(db.Boolean, default=True)

    movimentos = db.relationship('MovimentoEstoque', backref='produto', lazy='dynamic')


# ─────────────────────────────────────
#  COLABORADORES
# ─────────────────────────────────────
class Colaborador(db.Model):
    __tablename__ = 'colaboradores'
    id      = db.Column(db.Integer, primary_key=True)
    nome    = db.Column(db.String(100), nullable=False)
    setor   = db.Column(db.String(30))   # roca | galp | coz | desc | obra | log
    funcao  = db.Column(db.String(60))
    diaria  = db.Column(db.Float, default=0.0)
    ativo   = db.Column(db.Boolean, default=True)


# ─────────────────────────────────────
#  LANÇAMENTO DIÁRIO (cabeçalho)
# ─────────────────────────────────────
class Lancamento(db.Model):
    __tablename__ = 'lancamentos'
    id         = db.Column(db.Integer, primary_key=True)
    data       = db.Column(db.Date, nullable=False, index=True)
    status     = db.Column(db.String(20), default='rascunho')  # rascunho | finalizado
    usuario_id = db.Column(db.Integer, db.ForeignKey('usuarios.id'))
    criado_em  = db.Column(db.DateTime, default=datetime.utcnow)
    atualizado = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # ── Roça ──
    cx_mad_branca   = db.Column(db.Integer, default=0)
    cx_plast_branca = db.Column(db.Integer, default=0)
    cx_plast_amarela= db.Column(db.Integer, default=0)
    cx_amarela      = db.Column(db.Integer, default=0)
    peso_medio      = db.Column(db.Float,   default=0.0)
    mo_roca         = db.Column(db.Float,   default=0.0)
    hrs_trator1     = db.Column(db.Float,   default=0.0)
    hrs_trator2     = db.Column(db.Float,   default=0.0)

    # ── Logística ──
    km_ini_strada   = db.Column(db.Float, default=0.0)
    km_fim_strada   = db.Column(db.Float, default=0.0)
    km_ini_ducato   = db.Column(db.Float, default=0.0)
    km_fim_ducato   = db.Column(db.Float, default=0.0)
    motorista1      = db.Column(db.String(60))
    motorista2      = db.Column(db.String(60))
    motorista3      = db.Column(db.String(60))
    pedagio         = db.Column(db.Float, default=0.0)
    estacionamento  = db.Column(db.Float, default=0.0)

    # ── Custos gerais ──
    mo_galp   = db.Column(db.Float, default=0.0)
    mo_desc   = db.Column(db.Float, default=0.0)
    mo_coz    = db.Column(db.Float, default=0.0)
    mo_obra   = db.Column(db.Float, default=0.0)
    cafe      = db.Column(db.Float, default=0.0)
    imposto   = db.Column(db.Float, default=0.0)

    # ── Observações ──
    obs = db.Column(db.Text)

    movimentos = db.relationship('MovimentoEstoque', backref='lancamento', lazy='dynamic',
                                 cascade='all, delete-orphan')

    @property
    def km_strada(self):
        return max(0, self.km_fim_strada - self.km_ini_strada)

    @property
    def km_ducato(self):
        return max(0, self.km_fim_ducato - self.km_ini_ducato)

    @property
    def custo_total(self):
        return sum([self.mo_roca, self.mo_galp, self.mo_desc, self.mo_coz,
                    self.mo_obra, self.cafe, self.imposto, self.pedagio, self.estacionamento])

    @property
    def venda_bruta(self):
        return sum(m.venda_total for m in self.movimentos if m.tipo == 'saida')

    @property
    def lucro(self):
        return self.venda_bruta - self.custo_total


# ─────────────────────────────────────
#  MOVIMENTO DE ESTOQUE (por produto/dia)
# ─────────────────────────────────────
class MovimentoEstoque(db.Model):
    __tablename__ = 'movimentos_estoque'
    id           = db.Column(db.Integer, primary_key=True)
    lancamento_id= db.Column(db.Integer, db.ForeignKey('lancamentos.id'), nullable=False)
    produto_id   = db.Column(db.Integer, db.ForeignKey('produtos.id'),    nullable=False)
    tipo         = db.Column(db.String(10))  # abertura | producao | saida | perda
    quantidade   = db.Column(db.Float, default=0.0)  # kg
    preco_unit   = db.Column(db.Float, default=0.0)  # R$/kg na venda

    @property
    def venda_total(self):
        return self.quantidade * self.preco_unit if self.tipo == 'saida' else 0.0


# ─────────────────────────────────────
#  DESPESAS / RECEITAS (Fluxo de Caixa)
# ─────────────────────────────────────
class Despesa(db.Model):
    __tablename__ = 'despesas'
    id         = db.Column(db.Integer, primary_key=True)
    data       = db.Column(db.Date, nullable=False, index=True)
    tipo       = db.Column(db.String(10), nullable=False)   # entrada | saida
    categoria  = db.Column(db.String(40), nullable=False)
    descricao  = db.Column(db.String(200))
    valor      = db.Column(db.Float, nullable=False)
    usuario_id = db.Column(db.Integer, db.ForeignKey('usuarios.id'))
    criado_em  = db.Column(db.DateTime, default=datetime.utcnow)

    CATEGORIAS = [
        'Vendas Aipim', 'Mão de Obra', 'Combustível e KM',
        'Matéria-Prima', 'Embalagens/Insumos', 'Despesas Variáveis',
        'Veículos (Fixo)', 'Manutenção', 'Outros'
    ]
