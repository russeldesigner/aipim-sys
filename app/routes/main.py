from flask import Blueprint, render_template, redirect, url_for
from flask_login import login_required, current_user
from datetime import date

main_bp = Blueprint('main', __name__)

@main_bp.route('/')
def index():
    if current_user.is_authenticated:
        return redirect(url_for('main.dashboard'))
    return redirect(url_for('auth.login'))

@main_bp.route('/dashboard')
@login_required
def dashboard():
    return render_template('app.html', pagina='dashboard', hoje=date.today())

@main_bp.route('/lancamentos')
@login_required
def lancamentos_view():
    return render_template('app.html', pagina='lancamentos', hoje=date.today())

@main_bp.route('/despesas')
@login_required
def despesas_view():
    return render_template('app.html', pagina='despesas', hoje=date.today())

@main_bp.route('/cadastros')
@login_required
def cadastros_view():
    if not current_user.pode_gerenciar:
        return redirect(url_for('main.dashboard'))
    return render_template('app.html', pagina='cadastros', hoje=date.today())
