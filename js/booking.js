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

  // Debounce para mudança de data (evita spam de requests)
  let dateChangeTimeout;
  dataInput.addEventListener('change', () => {
    clearTimeout(dateChangeTimeout);
    dateChangeTimeout = setTimeout(() => handleDateChange(), 300);
  });

  async function handleDateChange() {
    Validation.clearFieldError('data');
    Validation.clearFieldError('horario');
    
    // CRÍTICO: Limpa o horário selecionado quando muda a data
    // Isso evita o bug de manter horário de outra data selecionado
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
    const dayOfWeek = new Date(`${date}T12:00:00`).getDay();
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

  async function loadAvailableTimes(date) {
    timeslotsContainer.innerHTML = '';
    loadingTimes.style.display = 'flex';
    timeslotsContainer.classList.remove('timeslots-container--error');

    try {
      const response = await APIService.getAvailableSlots(date);

      if (!response.success) {
        throw new Error(response.error || 'Erro ao carregar horários');
      }

      const availableSlots = response.slots;

      if (availableSlots.length === 0) {
        timeslotsContainer.innerHTML = `
          <div class="timeslots-placeholder timeslots-placeholder--error">
            <span class="timeslots-placeholder__icon">⚠️</span>
            <p><strong>Sem horários disponíveis</strong><br>Escolha outra data.</p>
          </div>
        `;
        return;
      }

      // Renderiza apenas disponíveis (já filtrado pelo backend, mas double-check)
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

    // Confirmação final de disponibilidade (prevenção de race condition no cliente)
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

      const stillAvailable = checkResponse.slots.some(s => s.time === time && s.available);
      
      if (!stillAvailable) {
        Utils.showToast('Este horário acabou de ser reservado. Por favor, escolha outro.', 'error');
        await loadAvailableTimes(date);
        horarioInput.value = '';
        updateSummary();
        // Dá scroll para os horários
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
        // Erro específico do servidor (ex: "Horário já ocupado")
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