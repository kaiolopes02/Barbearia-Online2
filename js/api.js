// js/api.js

const CONFIG = {
  SCRIPT_URL: 'https://script.google.com/macros/s/AKfycbz6zv3vrbXCR7mppGDxZ6w2DpyOoAcMlZs4EfiWPDws8ktQs0X6kuXrCOE90lNU-oWEHA/exec',
  TIMEOUT_MS: 15000, // Aumentado para 15s
};

/**
 * JSONP Fetch com melhor tratamento de erro e cleanup
 */
function jsonpFetch(url, timeoutMs = CONFIG.TIMEOUT_MS) {
  return new Promise((resolve, reject) => {
    const callbackName = '_cb_' + Date.now() + '_' + Math.random().toString(36).slice(2, 9);
    const script = document.createElement('script');
    let settled = false;

    const cleanup = () => {
      settled = true;
      delete window[callbackName];
      if (script.parentNode) script.parentNode.removeChild(script);
      clearTimeout(timer);
    };

    const timer = setTimeout(() => {
      if (!settled) {
        cleanup();
        reject(new Error('Tempo esgotado ao conectar com o servidor. Tente novamente.'));
      }
    }, timeoutMs);

    window[callbackName] = (data) => {
      if (!settled) {
        cleanup();
        // Valida se a resposta é um objeto válido
        if (data && typeof data === 'object') {
          resolve(data);
        } else {
          reject(new Error('Resposta inválida do servidor'));
        }
      }
    };

    script.onerror = () => {
      if (!settled) {
        cleanup();
        reject(new Error('Falha de rede. Verifique sua conexão.'));
      }
    };

    // Adiciona cache-buster e garante que callback seja o último parâmetro
    const separator = url.includes('?') ? '&' : '?';
    script.src = `${url}${separator}_=${Date.now()}&callback=${callbackName}`;
    
    // Adiciona ao DOM de forma assíncrona para evitar bloqueio
    requestAnimationFrame(() => {
      document.head.appendChild(script);
    });
  });
}

const APIService = {

  getAvailableSlots: async (date) => {
    try {
      if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        throw new Error('Data inválida');
      }
      
      const url = `${CONFIG.SCRIPT_URL}?action=getSlots&date=${encodeURIComponent(date)}`;
      const data = await jsonpFetch(url);

      if (!data || !data.success) {
        throw new Error((data && data.error) || 'Erro ao carregar horários');
      }

      // Garante que slots seja um array
      if (!Array.isArray(data.slots)) {
        throw new Error('Formato de resposta inválido');
      }

      return data;
    } catch (error) {
      console.error('[API] getAvailableSlots error:', error);
      return { success: false, error: error.message };
    }
  },

  createAppointment: async (data) => {
    try {
      // Validação prévia dos dados
      if (!data || !data.data || !data.horario || !data.nome) {
        throw new Error('Dados incompletos para agendamento');
      }

      const params = new URLSearchParams({
        action:    'create',
        id:        data.id,
        nome:      String(data.nome).trim(),
        email:     String(data.email || '').trim(),
        telefone:  String(data.telefone || '').trim(),
        servico:   String(data.servico || ''),
        data:      data.data,
        horario:   data.horario,
        status:    'Ativo',
        createdAt: data.createdAt || new Date().toISOString(),
      });

      const url = `${CONFIG.SCRIPT_URL}?${params.toString()}`;
      const result = await jsonpFetch(url);

      if (!result || !result.success) {
        throw new Error((result && result.error) || 'Erro ao criar agendamento');
      }

      return result;
    } catch (error) {
      console.error('[API] createAppointment error:', error);
      return { success: false, error: error.message };
    }
  },

  cancelAppointment: async (id) => {
    try {
      if (!id) throw new Error('ID é obrigatório');
      
      const url = `${CONFIG.SCRIPT_URL}?action=cancel&id=${encodeURIComponent(id)}`;
      const result = await jsonpFetch(url);

      if (!result || !result.success) {
        throw new Error((result && result.error) || 'Erro ao cancelar agendamento');
      }

      return result;
    } catch (error) {
      console.error('[API] cancelAppointment error:', error);
      return { success: false, error: error.message };
    }
  },
};