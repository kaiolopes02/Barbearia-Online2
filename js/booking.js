// js/booking.js

document.addEventListener('DOMContentLoaded', () => {
  const form               = document.getElementById('bookingForm');
  const telefoneInput      = document.getElementById('telefone');
  const dataInput          = document.getElementById('data');
  const servicoSelect      = document.getElementById('servico');
  const timeslotsContainer = document.getElementById('timeslotsContainer');
  const loadingTimes       = document.getElementById('loadingTimes');
  const horarioInput       = document.getElementById('horario');

  const today = new Date().toISOString().split('T')[0];
  dataInput.min = today;

  // Máscara de telefone
  telefoneInput.addEventListener('input', (e) => {
    e.target.value = Utils.formatPhone(e.target.value);
    Validation.clearFieldError('telefone');
  });

  // Limpa erros ao digitar
  ['nome', 'email', 'servico'].forEach(fieldId => {
    document.getElementById(fieldId).addEventListener('input', () => {
      Validation.clearFieldError(fieldId);
      updateSummary();
    });
  });

  // Mudança de data → carrega horários disponíveis
  dataInput.addEventListener('change', async () => {
    Validation.clearFieldError('data');
    Validation.clearFieldError('horario');
    horarioInput.value = '';
    updateSummary();

    const date = dataInput.value;
    if (!date) { renderPlaceholder(); return; }

    // Bloqueia segunda-feira (timezone-safe)
    const dayOfWeek = new Date(`${date}T12:00:00`).getDay();
    if (dayOfWeek === 1) {
      Utils.showToast('Não atendemos às segundas-feiras', 'error');
      dataInput.value = '';
      renderPlaceholder();
      return;
    }

    await loadAvailableTimes(date);
  });

  servicoSelect.addEventListener('change', () => {
    Validation.clearFieldError('servico');
    updateSummary();
  });

  // ── Placeholder ───────────────────────────────────────────────
  function renderPlaceholder() {
    timeslotsContainer.innerHTML = `
      <div class="timeslots-placeholder">
        <span class="timeslots-placeholder__icon">📅</span>
        <p>Selecione uma data para ver os horários disponíveis</p>
      </div>
    `;
  }

  // ── Carrega horários ──────────────────────────────────────────
  async function loadAvailableTimes(date) {
    timeslotsContainer.innerHTML = '';
    loadingTimes.style.display = 'flex';

    try {
      const response = await APIService.getAvailableSlots(date);

      if (!response.success) {
        throw new Error(response.error || response.message || 'Erro ao carregar horários');
      }

      /**
       * O GAS agora retorna apenas os slots disponíveis.
       * Mesmo assim filtramos aqui por segurança caso a versão
       * antiga do GAS ainda esteja deployada.
       */
      const availableSlots = response.slots.filter(s => s.available);

      if (availableSlots.length === 0) {
        timeslotsContainer.innerHTML = `
          <div class="timeslots-placeholder timeslots-placeholder--error">
            <span class="timeslots-placeholder__icon">⚠️</span>
            <p>Nenhum horário disponível para esta data.<br>Escolha outra data.</p>
          </div>
        `;
        return;
      }

      // Renderiza APENAS os horários disponíveis — ocupados não aparecem
      availableSlots.forEach(slot => {
        timeslotsContainer.appendChild(createTimeslotCard(slot));
      });

    } catch (error) {
      console.error('[Booking] loadAvailableTimes error:', error);
      timeslotsContainer.innerHTML = `
        <div class="timeslots-placeholder timeslots-placeholder--error">
          <span class="timeslots-placeholder__icon">⚠️</span>
          <p><strong>Erro ao carregar horários</strong><br>${error.message}</p>
          <small>Verifique o console (F12) para detalhes técnicos</small>
        </div>
      `;
    } finally {
      loadingTimes.style.display = 'none';
    }
  }

  // ── Card de horário ───────────────────────────────────────────
  function createTimeslotCard(slot) {
    const card = document.createElement('div');
    card.className = 'timeslot-card';
    card.textContent = slot.time;
    card.addEventListener('click', () => selectTimeslot(card, slot.time));

    const check = document.createElement('span');
    check.className = 'timeslot-card__check';
    check.innerHTML = '✓';
    card.appendChild(check);

    return card;
  }

  // ── Seleciona horário ─────────────────────────────────────────
  function selectTimeslot(selectedCard, time) {
    document.querySelectorAll('.timeslot-card').forEach(card => {
      card.classList.remove('timeslot-card--selected');
    });

    selectedCard.classList.add('timeslot-card--selected');
    horarioInput.value = time;

    Validation.clearFieldError('horario');
    updateSummary();

    if (window.innerWidth < 768) {
      document.getElementById('formSummary').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }

  // ── Resumo ────────────────────────────────────────────────────
  function updateSummary() {
    const servico = servicoSelect.value;
    const data    = dataInput.value;
    const horario = horarioInput.value;

    document.getElementById('summaryServico').textContent =
      servico ? Utils.getServiceName(servico) : '-';
    document.getElementById('summaryData').textContent =
      data ? Utils.formatDate(data) : '-';
    document.getElementById('summaryHorario').textContent = horario || '-';
    document.getElementById('summaryTotal').textContent =
      servico ? Utils.formatCurrency(Utils.getServicePrice(servico)) : '-';
  }

  // ── Submit ────────────────────────────────────────────────────
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
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

    Utils.toggleLoading(true);

    try {
      // Re-verifica disponibilidade antes de confirmar (race condition)
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
        return;
      }

      const appointmentData = {
        id:        Utils.generateId(),
        nome:      formData.get('nome'),
        email:     formData.get('email'),
        telefone:  formData.get('telefone'),
        servico:   formData.get('servico'),
        data:      formData.get('data'),
        horario:   formData.get('horario'),
        status:    'Ativo',
        createdAt: new Date().toISOString(),
      };

      const result = await APIService.createAppointment(appointmentData);

      if (result.success) {
        Utils.storeSession('lastBooking', appointmentData);
        window.location.href = 'confirmation.html';
      } else {
        Utils.showToast(result.error || 'Erro ao criar agendamento. Tente novamente.', 'error');
      }

    } catch (error) {
      console.error('[Booking] submit error:', error);
      Utils.showToast('Erro ao processar agendamento. Tente novamente.', 'error');
    } finally {
      Utils.toggleLoading(false);
    }
  });
});