// js/api.js

const CONFIG = {
  SCRIPT_URL: 'https://script.google.com/macros/s/AKfycbw5arlK9wQ8CGkkqBkOUqi3r5bX7J5ckpwxIIf_un4dFw6JUJ0nK9h1zg9zhSpFkx18IA/exec',
};

/**
 * JSONP Fetch — solução definitiva para o CORS do Google Apps Script.
 *
 * O GAS faz um redirect 302 interno (script.google.com →
 * script.googleusercontent.com) sem headers CORS. O browser bloqueia
 * a resposta antes dela chegar, independente do que o GAS coloque nos
 * headers da resposta final.
 *
 * JSONP injeta uma <script> tag em vez de fetch/XHR.
 * Script tags não estão sujeitas ao CORS, então o redirect é
 * seguido e a resposta é executada normalmente.
 *
 * Requer que o GAS envolva a resposta em: callbackName(jsonData)
 */
function jsonpFetch(url, timeoutMs = 10000) {
  return new Promise((resolve, reject) => {
    const callbackName = '__gasCallback_' + Date.now() + '_' + Math.random().toString(36).slice(2);
    const script = document.createElement('script');
    let settled = false;

    const cleanup = () => {
      settled = true;
      delete window[callbackName];
      if (script.parentNode) script.parentNode.removeChild(script);
    };

    const timer = setTimeout(() => {
      if (!settled) {
        cleanup();
        reject(new Error('Timeout: o servidor demorou demais para responder'));
      }
    }, timeoutMs);

    window[callbackName] = (data) => {
      clearTimeout(timer);
      cleanup();
      resolve(data);
    };

    script.onerror = () => {
      clearTimeout(timer);
      cleanup();
      reject(new Error('Falha de rede ao conectar com o servidor'));
    };

    script.src = `${url}&callback=${callbackName}`;
    document.head.appendChild(script);
  });
}

const APIService = {

  /**
   * Busca horários disponíveis para uma data.
   */
  getAvailableSlots: async (date) => {
    try {
      const url = `${CONFIG.SCRIPT_URL}?action=getSlots&date=${encodeURIComponent(date)}&_=${Date.now()}`;
      const data = await jsonpFetch(url);

      if (!data.success) {
        throw new Error(data.error || data.message || 'Erro desconhecido no servidor');
      }

      return data;

    } catch (error) {
      console.error('[API] getAvailableSlots error:', error);
      return { success: false, error: error.message };
    }
  },

  /**
   * Cria um novo agendamento via GET + JSONP.
   *
   * POST dispara CORS preflight (OPTIONS) que o GAS não suporta.
   * Solução: converter para GET com URLSearchParams + JSONP.
   * O GAS foi atualizado para aceitar action=create via doGet.
   */
  createAppointment: async (data) => {
    try {
      const params = new URLSearchParams({
        action:    'create',
        id:        data.id,
        nome:      data.nome,
        email:     data.email     || '',
        telefone:  data.telefone  || '',
        servico:   data.servico   || '',
        data:      data.data,
        horario:   data.horario,
        status:    data.status    || 'Ativo',
        createdAt: data.createdAt || new Date().toISOString(),
        _:         Date.now(),
      });

      const url = `${CONFIG.SCRIPT_URL}?${params.toString()}`;
      const result = await jsonpFetch(url);

      if (!result.success) {
        throw new Error(result.error || result.message || 'Erro ao criar agendamento');
      }

      return result;

    } catch (error) {
      console.error('[API] createAppointment error:', error);
      return { success: false, error: error.message };
    }
  },

  /**
   * Cancela um agendamento pelo ID via GET + JSONP.
   * O GAS foi atualizado para aceitar action=cancel via doGet.
   */
  cancelAppointment: async (id) => {
    try {
      const url = `${CONFIG.SCRIPT_URL}?action=cancel&id=${encodeURIComponent(id)}&_=${Date.now()}`;
      const result = await jsonpFetch(url);

      if (!result.success) {
        throw new Error(result.error || result.message || 'Erro ao cancelar agendamento');
      }

      return result;

    } catch (error) {
      console.error('[API] cancelAppointment error:', error);
      return { success: false, error: error.message };
    }
  },
};