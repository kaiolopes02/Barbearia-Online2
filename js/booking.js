// js/booking.js

document.addEventListener('DOMContentLoaded', () => {
  const form               = document.getElementById('bookingForm');
  const telefoneInput      = document.getElementById('telefone');
  const dataInput          = document.getElementById('data');
  const servicoSelect      = document.getElementById('servico');
  const timeslotsContainer = document.getElementById('timeslotsContainer');
  const loadingTimes       = document.getElementById('loadingTimes');
  const horarioInput       = document.getElementById('horario');
  const submitBtn          = document.getElementById('submitBtn');

  // Seta data mínima como hoje
  const today = new Date().toISOString().split('T')[0];
  dataInput.min = today;

  let isSubmitting = false;

  // Configuração de horários de funcionamento
  const BUSINESS_HOURS = {
    0: { open: '10:00', close: '16:00', name: 'Domingo' },      // Domingo
    1: null,                                                    // Segunda - Fechado
    2: { open: '09:00', close: '20:00', name: 'Terça' },        // Terça
    3: { open: '09:00', close: '20:00', name: 'Quarta' },       // Quarta
    4: { open: '09:00', close: '20:00', name: 'Quinta' },       // Quinta
    5: { open: '09:00', close: '20:00', name: 'Sexta' },        // Sexta
    6: { open: '09:00', close: '18:00', name: 'Sábado' }        // Sábado
  };

  // Máscara de telefone
  telefoneInput.addEventListener('input', (e) => {
    e.target.value = Utils.formatPhone(e.target.value);
    Validation.clearFieldError('telefone');
  });

  // Limpa erros ao digitar
  ['nome', 'email', 'servico'].forEach(fieldId => {
    const field = document.getElementById(fieldId);
    if (field) {
      field.addEventListener('input', () => {
        Validation.clearFieldError(fieldId);
        updateSummary();
      });
    }
  });

  // Debounce para mudança de data
  let dateChangeTimeout;
  dataInput.addEventListener('change', () => {
    clearTimeout(dateChangeTimeout);
    dateChangeTimeout = setTimeout(() => handleDateChange(), 300);
  });

  async function handleDateChange() {
    Validation.clearFieldError('data');
    Validation.clearFieldError('horario');
    
    // Limpa o horário selecionado quando muda a data
    horarioInput.value = '';
    updateSummary();
    
    // Remove seleção visual anterior
    document.querySelectorAll('.timeslot-card').forEach(card => {
      card.classList.remove('timeslot-card--selected');
    });

    const date = dataInput.value;
    if (!date) { 
      renderPlaceholder(); 
      return; 
    }

    // Validação de segunda-feira (timezone-safe)
    const selectedDate = new Date(`${date}T12:00:00`);
    const dayOfWeek = selectedDate.getDay();
    
    if (dayOfWeek === 1) {
      Utils.showToast('Não atendemos às segundas-feiras', 'error');
      dataInput.value = '';
      renderPlaceholder();
      return;
    }

    await loadAvailableTimes(date);
  }

  servicoSelect.addEventListener('change', () => {
    Validation.clearFieldError('servico');
    updateSummary();
  });

  function renderPlaceholder() {
    timeslotsContainer.innerHTML = `
      <div class="timeslots-placeholder">
        <span class="timeslots-placeholder__icon">📅</span>
        <p>Selecione uma data para ver os horários disponíveis</p>
      </div>
    `;
    timeslotsContainer.classList.remove('timeslots-container--error');
  }

  /**
   * FILTRO DE HORÁRIOS POR FUNCIONAMENTO E HORA ATUAL
   * Remove horários fora do expediente e horários que já passaram (se for hoje)
   */
  function filterSlotsByBusinessHours(slots, selectedDateStr) {
    const selectedDate = new Date(`${selectedDateStr}T12:00:00`);
    const dayOfWeek = selectedDate.getDay();
    const businessHours = BUSINESS_HOURS[dayOfWeek];

    // Se não tem horário de funcionamento (segunda), retorna vazio
    if (!businessHours) return [];

    // Converte horários de funcionamento para minutos para comparação fácil
    const openMinutes = timeToMinutes(businessHours.open);
    const closeMinutes = timeToMinutes(businessHours.close);

    // Verifica se é hoje
    const now = new Date();
    const isToday = selectedDateStr === now.toISOString().split('T')[0];
    const currentMinutes = isToday ? (now.getHours() * 60 + now.getMinutes()) : 0;

    return slots.filter(slot => {
      const slotMinutes = timeToMinutes(slot.time);
      
      // Verifica se está dentro do horário de funcionamento
      if (slotMinutes < openMinutes || slotMinutes >= closeMinutes) {
        return false;
      }

      // Se for hoje, verifica se o horário já passou (com margem de 5 minutos)
      if (isToday && slotMinutes <= currentMinutes + 5) {
        return false;
      }

      return true;
    });
  }

  function timeToMinutes(timeStr) {
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + minutes;
  }

  async function loadAvailableTimes(date) {
    timeslotsContainer.innerHTML = '';
    loadingTimes.style.display = 'flex';
    timeslotsContainer.classList.remove('timeslots-container--error');

    try {
      const response = await APIService.getAvailableSlots(date);

      if (!response.success) {
        throw new Error(response.error || 'Erro ao carregar horários');
      }

      // APLICA O FILTRO DE HORÁRIO DE FUNCIONAMENTO E HORÁRIOS PASSADOS
      let availableSlots = response.slots;
      availableSlots = filterSlotsByBusinessHours(availableSlots, date);

      if (availableSlots.length === 0) {
        const selectedDate = new Date(`${date}T12:00:00`);
        const dayOfWeek = selectedDate.getDay();
        const businessHours = BUSINESS_HOURS[dayOfWeek];
        
        let message = 'Nenhum horário disponível para esta data.<br>Escolha outra data.';
        
        if (businessHours) {
          message = `Nenhum horário disponível para ${businessHours.name}.<br>` +
                   `Horário de funcionamento: ${businessHours.open} às ${businessHours.close}.`;
        }

        timeslotsContainer.innerHTML = `
          <div class="timeslots-placeholder timeslots-placeholder--error">
            <span class="timeslots-placeholder__icon">⚠️</span>
            <p>${message}</p>
          </div>
        `;
        return;
      }

      // Renderiza apenas os disponíveis e dentro do horário
      availableSlots.forEach(slot => {
        if (slot.available) {
          timeslotsContainer.appendChild(createTimeslotCard(slot));
        }
      });

    } catch (error) {
      console.error('[Booking] loadAvailableTimes error:', error);
      timeslotsContainer.innerHTML = `
        <div class="timeslots-placeholder timeslots-placeholder--error">
          <span class="timeslots-placeholder__icon">⚠️</span>
          <p><strong>Erro ao carregar horários</strong><br>${escapeHtml(error.message)}</p>
          <button onclick="location.reload()" style="margin-top:10px;padding:8px 16px;background:var(--color-secondary);color:white;border:none;border-radius:6px;cursor:pointer;">
            Tentar novamente
          </button>
        </div>
      `;
      Utils.showToast(error.message, 'error');
    } finally {
      loadingTimes.style.display = 'none';
    }
  }

  function createTimeslotCard(slot) {
    const card = document.createElement('div');
    card.className = 'timeslot-card';
    card.textContent = slot.time;
    card.setAttribute('role', 'button');
    card.setAttribute('aria-label', `Horário ${slot.time}`);
    
    card.addEventListener('click', () => selectTimeslot(card, slot.time));

    const check = document.createElement('span');
    check.className = 'timeslot-card__check';
    check.innerHTML = '✓';
    card.appendChild(check);

    return card;
  }

  function selectTimeslot(selectedCard, time) {
    // Remove seleção anterior
    document.querySelectorAll('.timeslot-card').forEach(card => {
      card.classList.remove('timeslot-card--selected');
      card.setAttribute('aria-pressed', 'false');
    });

    // Adiciona nova seleção
    selectedCard.classList.add('timeslot-card--selected');
    selectedCard.setAttribute('aria-pressed', 'true');
    horarioInput.value = time;

    Validation.clearFieldError('horario');
    updateSummary();

    // Scroll para resumo em mobile
    if (window.innerWidth < 768) {
      const summary = document.getElementById('formSummary');
      if (summary) {
        summary.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }
  }

  function updateSummary() {
    const servico = servicoSelect.value;
    const data    = dataInput.value;
    const horario = horarioInput.value;

    const servicoName = servico ? Utils.getServiceName(servico) : '-';
    const dataFormatada = data ? Utils.formatDate(data) : '-';
    const preco = servico ? Utils.formatCurrency(Utils.getServicePrice(servico)) : '-';

    document.getElementById('summaryServico').textContent = servicoName;
    document.getElementById('summaryData').textContent = dataFormatada;
    document.getElementById('summaryHorario').textContent = horario || '-';
    document.getElementById('summaryTotal').textContent = preco;
  }

  // Submit do formulário com proteções contra double-submit
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    if (isSubmitting) return; // Previne double-click
    
    Validation.clearAllErrors();

    const formData   = new FormData(form);
    const validation = Validation.validateForm(formData);

    if (!validation.isValid) {
      Object.keys(validation.errors).forEach(field => {
        Validation.showFieldError(field, validation.errors[field]);
      });
      Utils.showToast('Por favor, corrija os erros no formulário', 'error');
      return;
    }

    const date = formData.get('data');
    const time = formData.get('horario');

    // Validação adicional: verifica se o horário ainda está disponível (pode ter expirado)
    const selectedDate = new Date(`${date}T12:00:00`);
    const dayOfWeek = selectedDate.getDay();
    const businessHours = BUSINESS_HOURS[dayOfWeek];
    
    if (businessHours) {
      const slotMinutes = timeToMinutes(time);
      const openMinutes = timeToMinutes(businessHours.open);
      const closeMinutes = timeToMinutes(businessHours.close);
      
      if (slotMinutes < openMinutes || slotMinutes >= closeMinutes) {
        Utils.showToast(`Horário fora do expediente de ${businessHours.name}`, 'error');
        await loadAvailableTimes(date);
        return;
      }
    }

    Utils.toggleLoading(true);
    isSubmitting = true;
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span>Verificando disponibilidade...</span>';

    try {
      // Check final antes de criar
      const checkResponse = await APIService.getAvailableSlots(date);
      
      if (!checkResponse.success) {
        throw new Error(checkResponse.error || 'Erro ao verificar disponibilidade');
      }

      // Re-filtra no cliente para garantir que o horário ainda é válido
      const stillAvailableSlots = filterSlotsByBusinessHours(checkResponse.slots, date);
      const stillAvailable = stillAvailableSlots.some(s => s.time === time && s.available);

      if (!stillAvailable) {
        Utils.showToast('Este horário não está mais disponível. Por favor, escolha outro.', 'error');
        await loadAvailableTimes(date);
        horarioInput.value = '';
        updateSummary();
        timeslotsContainer.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
      }

      const appointmentData = {
        id:        Utils.generateId(),
        nome:      formData.get('nome'),
        email:     formData.get('email'),
        telefone:  formData.get('telefone'),
        servico:   formData.get('servico'),
        data:      date,
        horario:   time,
        status:    'Ativo',
        createdAt: new Date().toISOString(),
      };

      submitBtn.innerHTML = '<span>Confirmando...</span>';
      
      const result = await APIService.createAppointment(appointmentData);

      if (result.success) {
        Utils.storeSession('lastBooking', appointmentData);
        window.location.href = 'confirmation.html';
      } else {
        Utils.showToast(result.error || 'Erro ao criar agendamento', 'error');
        
        if (result.error && result.error.includes('ocupado')) {
          await loadAvailableTimes(date);
          horarioInput.value = '';
          updateSummary();
        }
      }

    } catch (error) {
      console.error('[Booking] submit error:', error);
      Utils.showToast('Erro ao processar. Tente novamente.', 'error');
    } finally {
      Utils.toggleLoading(false);
      isSubmitting = false;
      submitBtn.disabled = false;
      submitBtn.innerHTML = `
        <span>Confirmar Agendamento</span>
        <svg class="btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M5 12h14M12 5l7 7-7 7"/>
        </svg>
      `;
    }
  });
  
  // Helper para escape HTML
  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
});