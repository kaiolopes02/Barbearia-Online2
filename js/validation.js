// js/validation.js

const Validation = {
  rules: {
    nome: {
      required:  true,
      minLength: 3,
      pattern:   /^[a-zA-ZÀ-ÿ\s]+$/,
      message:   'Nome deve ter pelo menos 3 caracteres e conter apenas letras',
    },
    email: {
      required: true,
      pattern:  /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
      message:  'Digite um e-mail válido',
    },
    telefone: {
      required: true,
      pattern:  /^\(\d{2}\)\s\d{4,5}-\d{4}$/,
      message:  'Digite um telefone válido: (11) 99999-9999',
    },
    servico: {
      required: true,
      message:  'Selecione um serviço',
    },
    data: {
      required: true,
      message:  'Selecione uma data',
    },
    horario: {
      required: true,
      message:  'Selecione um horário disponível',
    },
  },

  validateField: (fieldName, value) => {
    const rule = Validation.rules[fieldName];
    if (!rule) return { valid: true };

    if (rule.required && (!value || !value.trim())) {
      return { valid: false, message: 'Campo obrigatório' };
    }

    if (value && rule.minLength && value.trim().length < rule.minLength) {
      return { valid: false, message: rule.message };
    }

    if (value && rule.pattern && !rule.pattern.test(value)) {
      return { valid: false, message: rule.message };
    }

    return { valid: true };
  },

  validateForm: (formData) => {
    const errors = {};
    let isValid  = true;

    Object.keys(Validation.rules).forEach(field => {
      const result = Validation.validateField(field, formData.get(field) || '');
      if (!result.valid) {
        errors[field] = result.message;
        isValid = false;
      }
    });

    return { isValid, errors };
  },

  /**
   * Exibe erro em um campo.
   *
   * BUG CORRIGIDO: o campo `horario` é um <input type="hidden">, portanto
   * não recebe a classe visual de erro. Para ele, aplica a borda de erro
   * no container de timeslots (.timeslots-container) em vez do input.
   */
  showFieldError: (fieldId, message) => {
    const errorElement = document.getElementById(`error-${fieldId}`);

    if (fieldId === 'horario') {
      // Aplica feedback visual no container de cards
      const container = document.getElementById('timeslotsContainer');
      if (container) container.classList.add('timeslots-container--error');
    } else {
      const field = document.getElementById(fieldId);
      if (field) field.classList.add('form-input--error');
    }

    if (errorElement) errorElement.textContent = message;
  },

  clearFieldError: (fieldId) => {
    const errorElement = document.getElementById(`error-${fieldId}`);

    if (fieldId === 'horario') {
      const container = document.getElementById('timeslotsContainer');
      if (container) container.classList.remove('timeslots-container--error');
    } else {
      const field = document.getElementById(fieldId);
      if (field) field.classList.remove('form-input--error');
    }

    if (errorElement) errorElement.textContent = '';
  },

  clearAllErrors: () => {
    document.querySelectorAll('.form-input--error').forEach(el => {
      el.classList.remove('form-input--error');
    });
    document.querySelectorAll('.form-error').forEach(el => {
      el.textContent = '';
    });
    // Limpa erro visual do container de horários
    const container = document.getElementById('timeslotsContainer');
    if (container) container.classList.remove('timeslots-container--error');
  },
};