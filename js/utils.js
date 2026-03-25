// js/utils.js

const Utils = {

  /**
   * Formata número de telefone com máscara brasileira.
   */
  formatPhone: (value) => {
    const numbers = value.replace(/\D/g, '');
    if (numbers.length <= 10) {
      return numbers.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
    }
    return numbers.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
  },

  /**
   * Formata data para o formato brasileiro por extenso.
   *
   * BUG CORRIGIDO: `new Date('2026-03-25')` (string ISO sem horário) é
   * parseado como UTC midnight. No fuso de Brasília (UTC-3), isso vira
   * 21h do dia ANTERIOR, fazendo a data exibida ficar errada.
   *
   * Solução: usar o construtor `new Date(year, month - 1, day)` que
   * interpreta os valores como horário LOCAL, eliminando o offset.
   */
  formatDate: (dateString) => {
    const [year, month, day] = dateString.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    return date.toLocaleDateString('pt-BR', {
      weekday: 'long',
      year:    'numeric',
      month:   'long',
      day:     'numeric',
    });
  },

  /**
   * Formata valor monetário em BRL.
   */
  formatCurrency: (value) => {
    return new Intl.NumberFormat('pt-BR', {
      style:    'currency',
      currency: 'BRL',
    }).format(value);
  },

  /**
   * Gera ID único baseado em timestamp + random.
   */
  generateId: () => {
    return Date.now().toString(36).toUpperCase() +
      Math.random().toString(36).substr(2, 5).toUpperCase();
  },

  /**
   * Exibe toast de notificação.
   */
  showToast: (message, type = 'success', duration = 4000) => {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast toast--${type}`;
    toast.innerHTML = `<span>${message}</span>`;
    container.appendChild(toast);

    const dismiss = () => {
      toast.style.opacity   = '0';
      toast.style.transform = 'translateX(100%)';
      setTimeout(() => toast.remove(), 300);
    };

    // Auto-dismiss
    const timer = setTimeout(dismiss, duration);

    // Click para fechar manualmente
    toast.addEventListener('click', () => {
      clearTimeout(timer);
      dismiss();
    });
  },

  /**
   * Exibe/esconde o overlay de loading global.
   */
  toggleLoading: (show = true) => {
    const overlay = document.getElementById('loadingOverlay');
    if (!overlay) return;
    overlay.classList.toggle('loading-overlay--active', show);
  },

  /**
   * Salva dado na sessionStorage.
   */
  storeSession: (key, data) => {
    try {
      sessionStorage.setItem(key, JSON.stringify(data));
    } catch (e) {
      console.warn('[Utils] storeSession failed:', e);
    }
  },

  /**
   * Recupera dado da sessionStorage.
   */
  getSession: (key) => {
    try {
      const data = sessionStorage.getItem(key);
      return data ? JSON.parse(data) : null;
    } catch (e) {
      console.warn('[Utils] getSession failed:', e);
      return null;
    }
  },

  /**
   * Remove dado da sessionStorage.
   */
  clearSession: (key) => {
    try {
      sessionStorage.removeItem(key);
    } catch (e) {
      console.warn('[Utils] clearSession failed:', e);
    }
  },

  /**
   * Debounce genérico.
   */
  debounce: (func, wait) => {
    let timeout;
    return function (...args) {
      clearTimeout(timeout);
      timeout = setTimeout(() => func.apply(this, args), wait);
    };
  },

  /**
   * Retorna o preço de um serviço pelo ID.
   */
  getServicePrice: (serviceId) => {
    const prices = {
      'corte-classico': 45,
      'barba':          35,
      'combo':          70,
      'tratamento':     55,
    };
    return prices[serviceId] || 0;
  },

  /**
   * Retorna o nome legível de um serviço pelo ID.
   */
  getServiceName: (serviceId) => {
    const names = {
      'corte-classico': 'Corte Clássico',
      'barba':          'Barba Completa',
      'combo':          'Combo (Corte + Barba)',
      'tratamento':     'Tratamento Capilar',
    };
    return names[serviceId] || serviceId;
  },
};

// Toggle do menu mobile
document.addEventListener('DOMContentLoaded', () => {
  const toggle = document.querySelector('.navbar__toggle');
  const menu   = document.querySelector('.navbar__menu');

  if (toggle && menu) {
    toggle.addEventListener('click', () => {
      menu.classList.toggle('navbar__menu--active');
    });

    // Fecha o menu ao clicar em um link
    menu.querySelectorAll('.navbar__link').forEach(link => {
      link.addEventListener('click', () => {
        menu.classList.remove('navbar__menu--active');
      });
    });
  }
});