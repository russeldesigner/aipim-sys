from flask import Blueprint, render_template, redirect, url_for, request, flash, jsonify
from flask_login import login_user, logout_user, login_required, current_user
from ..models import db, Usuario
from datetime import datetime, timedelta
from collections import defaultdict
import threading

auth_bp = Blueprint('auth', __name__)

# ── Rate limiting simples (in-memory, por IP) ──
_lock      = threading.Lock()
_attempts  = defaultdict(list)   # ip -> [datetime, ...]
_MAX_TRIES = 10                  # tentativas
_WINDOW    = 60                  # segundos

def _check_rate_limit(ip):
    """Retorna True se o IP ultrapassou o limite de tentativas."""
    now = datetime.utcnow()
    cutoff = now - timedelta(seconds=_WINDOW)
    with _lock:
        _attempts[ip] = [t for t in _attempts[ip] if t > cutoff]
        if len(_attempts[ip]) >= _MAX_TRIES:
            return True
        _attempts[ip].append(now)
    return False


@auth_bp.route('/login', methods=['GET', 'POST'])
def login():
    if current_user.is_authenticated:
        return redirect(url_for('main.dashboard'))

    if request.method == 'POST':
        ip = request.headers.get('X-Forwarded-For', request.remote_addr or '').split(',')[0].strip()

        if _check_rate_limit(ip):
            if request.is_json:
                return jsonify({'ok': False, 'erro': 'Muitas tentativas. Aguarde 1 minuto.'}), 429
            flash('Muitas tentativas. Aguarde 1 minuto.', 'erro')
            return render_template('login.html'), 429

        data  = request.get_json(silent=True, force=True) or request.form
        email = str(data.get('email', '')).strip().lower()[:120]
        senha = str(data.get('senha', ''))

        if not email or not senha:
            if request.is_json:
                return jsonify({'ok': False, 'erro': 'Email e senha obrigatórios.'}), 400
            flash('Email e senha obrigatórios.', 'erro')
            return render_template('login.html')

        usuario = Usuario.query.filter_by(email=email, ativo=True).first()
        if usuario and usuario.check_senha(senha):
            login_user(usuario, remember=True)
            if request.is_json:
                return jsonify({'ok': True, 'redirect': url_for('main.dashboard')})
            return redirect(url_for('main.dashboard'))

        if request.is_json:
            return jsonify({'ok': False, 'erro': 'Email ou senha incorretos.'}), 401
        flash('Email ou senha incorretos.', 'erro')

    return render_template('login.html')


@auth_bp.route('/logout')
@login_required
def logout():
    logout_user()
    return redirect(url_for('auth.login'))


@auth_bp.route('/api/me')
@login_required
def me():
    return jsonify({
        'id':         current_user.id,
        'nome':       current_user.nome,
        'perfil':     current_user.perfil,
        'areas':      current_user.areas_permitidas,
        'financeiro': current_user.pode_ver_financeiro,
        'gerenciar':  current_user.pode_gerenciar,
    })
