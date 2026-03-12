import json
from flask import Blueprint, render_template, redirect, url_for
from flask_login import login_required, current_user
from datetime import date

main_bp = Blueprint('main', __name__)


def _ctx():
    """Contexto comum com vars do usuário já serializadas para JS."""
    return dict(
        hoje=date.today(),
        user_areas_json=json.dumps(current_user.areas_permitidas),
        user_ver_fin_json=json.dumps(current_user.pode_ver_financeiro),
        user_gerenciar_json=json.dumps(current_user.pode_gerenciar),
    )


@main_bp.route('/')
def index():
    if current_user.is_authenticated:
        return redirect(url_for('main.dashboard'))
    return redirect(url_for('auth.login'))


@main_bp.route('/dashboard')
@login_required
def dashboard():
    return render_template('app.html', pagina='dashboard', **_ctx())


@main_bp.route('/lancamentos')
@login_required
def lancamentos_view():
    return render_template('app.html', pagina='lancamentos', **_ctx())


@main_bp.route('/despesas')
@login_required
def despesas_view():
    return render_template('app.html', pagina='despesas', **_ctx())


@main_bp.route('/cadastros')
@login_required
def cadastros_view():
    if not current_user.pode_gerenciar:
        return redirect(url_for('main.dashboard'))
    return render_template('app.html', pagina='cadastros', **_ctx())
