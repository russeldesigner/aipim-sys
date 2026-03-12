from flask import Blueprint, render_template, redirect, url_for, request, flash, jsonify
from flask_login import login_user, logout_user, login_required, current_user
from ..models import db, Usuario

auth_bp = Blueprint('auth', __name__)

@auth_bp.route('/login', methods=['GET', 'POST'])
def login():
    if current_user.is_authenticated:
        return redirect(url_for('main.dashboard'))

    if request.method == 'POST':
        data = request.get_json(silent=True) or request.form
        email = data.get('email', '').strip().lower()
        senha = data.get('senha', '')

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
        'id':      current_user.id,
        'nome':    current_user.nome,
        'perfil':  current_user.perfil,
        'areas':   current_user.areas_permitidas,
        'financeiro': current_user.pode_ver_financeiro,
        'gerenciar':  current_user.pode_gerenciar,
    })
