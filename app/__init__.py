import os
from datetime import timedelta
from flask import Flask
from flask_login import LoginManager
from dotenv import load_dotenv
from .models import db, Usuario

load_dotenv()

login_manager = LoginManager()


def create_app():
    app = Flask(__name__, template_folder='../templates', static_folder='../static')

    # ── Configuração do banco ──
    db_url = os.getenv('DATABASE_URL', 'sqlite:////data/aipim_sys.db')
    if db_url.startswith('postgres://'):          # Render usa postgres://, SQLAlchemy exige postgresql://
        db_url = db_url.replace('postgres://', 'postgresql://', 1)

    is_prod = os.getenv('FLASK_ENV', 'production') == 'production'

    # ── Segurança ──
    app.config['SECRET_KEY']                    = os.getenv('SECRET_KEY', 'dev-secret-mude-isso')
    app.config['SQLALCHEMY_DATABASE_URI']       = db_url
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
    app.config['WTF_CSRF_ENABLED']              = False     # API JSON; auth protegida por session cookie

    # Cookies seguros
    app.config['SESSION_COOKIE_SECURE']         = is_prod   # HTTPS only em produção
    app.config['SESSION_COOKIE_HTTPONLY']       = True      # Inacessível por JS
    app.config['SESSION_COOKIE_SAMESITE']       = 'Lax'    # Proteção CSRF básica
    app.config['PERMANENT_SESSION_LIFETIME']    = timedelta(hours=12)
    app.config['SESSION_COOKIE_NAME']           = 'aipim_session'

    # Cabeçalhos de segurança via after_request
    @app.after_request
    def set_security_headers(response):
        response.headers['X-Content-Type-Options']  = 'nosniff'
        response.headers['X-Frame-Options']         = 'DENY'
        response.headers['Referrer-Policy']         = 'strict-origin-when-cross-origin'
        if is_prod:
            response.headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains'
        return response

    # ── Extensões ──
    db.init_app(app)
    login_manager.init_app(app)
    login_manager.login_view    = 'auth.login'
    login_manager.login_message = 'Faça login para acessar o sistema.'

    @login_manager.user_loader
    def load_user(user_id):
        return db.session.get(Usuario, int(user_id))

    # ── Blueprints ──
    from .routes.auth import auth_bp
    from .routes.main import main_bp
    from .routes.api  import api_bp

    app.register_blueprint(auth_bp)
    app.register_blueprint(main_bp)
    app.register_blueprint(api_bp, url_prefix='/api')

    # ── Migrations (Flask-Migrate) ──
    from flask_migrate import Migrate
    Migrate(app, db)

    # ── Cria tabelas e seed em dev / primeiro deploy ──
    with app.app_context():
        db.create_all()
        _seed_inicial()

    return app


def _seed_inicial():
    from .models import Usuario, Produto, Colaborador

    if Usuario.query.first():
        return

    usuarios = [
        ('Administrador',      'admin@aipim.com',  'admin123',  'admin'),
        ('Gestor Operacional', 'gestor@aipim.com', 'gest123',   'gestor_op'),
        ('Gestor Logística',   'glog@aipim.com',   'logist123', 'gestor_log'),
        ('Op. Galpão',         'galp@aipim.com',   'galp123',   'op_galp'),
        ('Op. Cozinha',        'coz@aipim.com',    'coz123',    'op_coz'),
        ('Op. Logística',      'log@aipim.com',    'log123',    'op_log'),
    ]
    for nome, email, senha, perfil in usuarios:
        u = Usuario(nome=nome, email=email, perfil=perfil)
        u.set_senha(senha)
        db.session.add(u)

    produtos = [
        ('Branco',       'galp', 6.50,  '#1E3A8A'),
        ('Amarelo',      'galp', 5.80,  '#D97706'),
        ('Pré-Coz A',    'coz',  8.20,  '#FCD34D'),
        ('Pré-Coz B(P)', 'coz',  9.50,  '#F59E0B'),
        ('Pré-Coz B(T)', 'coz',  10.20, '#92400E'),
        ('Cortado',      'galp', 7.80,  '#6D28D9'),
        ('Nhoque B',     'galp', 11.00, '#0C4A6E'),
        ('Nhoque A',     'galp', 12.50, '#14532D'),
        ('Farinha',      'galp', 4.20,  '#4B5563'),
    ]
    for nome, area, preco, cor in produtos:
        db.session.add(Produto(nome=nome, area=area, preco_kg=preco, cor_hex=cor))

    colaboradores = [
        ('Barnabe',    'roca', 'Auxiliar de Roça',    120),
        ('Pernambuco', 'roca', 'Auxiliar de Roça',    120),
        ('Henrique',   'roca', 'Auxiliar de Roça',    120),
        ('Danilo',     'roca', 'Auxiliar de Roça',    120),
        ('Alex',       'galp', 'Op. Galpão',          140),
        ('Felipe',     'galp', 'Op. Galpão',          140),
        ('Kauan',      'galp', 'Op. Galpão',          130),
        ('Rubinha',    'coz',  'Cozinheira',           150),
        ('Paola',      'coz',  'Auxiliar Cozinha',     130),
        ('Michele',    'coz',  'Auxiliar Cozinha',     130),
        ('Jurandi',    'obra', 'Pedreiro',             160),
        ('Pimpinha',   'obra', 'Auxiliar Obra',        130),
        ('Eduardo',    'log',  'Motorista',            160),
        ('Cleiton',    'log',  'Motorista',            160),
        ('Luciano',    'log',  'Auxiliar Logística',   130),
        ('Sonia',      'desc', 'Descascadeira',        110),
        ('Jessica',    'desc', 'Descascadeira',        110),
        ('Duane',      'desc', 'Descascadeira',        110),
        ('Patricia',   'desc', 'Descascadeira',        110),
        ('Silvia',     'desc', 'Descascadeira',        110),
        ('Pamela',     'desc', 'Descascadeira',        110),
        ('Luana',      'desc', 'Descascadeira',        110),
        ('Flaviana',   'desc', 'Descascadeira',        110),
        ('Suellen',    'desc', 'Descascadeira',        110),
    ]
    for nome, setor, funcao, diaria in colaboradores:
        db.session.add(Colaborador(nome=nome, setor=setor, funcao=funcao, diaria=diaria))

    db.session.commit()
    print('✅ Banco inicializado com dados padrão.')
