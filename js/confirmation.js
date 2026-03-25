// js/confirmation.js

document.addEventListener('DOMContentLoaded', () => {
  const bookingData = Utils.getSession('lastBooking');

  if (!bookingData) {
    Utils.showToast('Nenhum agendamento encontrado', 'error');
    setTimeout(() => {
      window.location.href = 'booking.html';
    }, 2000);
    return;
  }

  // Preenche os detalhes na tela
  document.getElementById('detailNome').textContent    = bookingData.nome;
  document.getElementById('detailServico').textContent = Utils.getServiceName(bookingData.servico);
  document.getElementById('detailData').textContent    = Utils.formatDate(bookingData.data);
  document.getElementById('detailHorario').textContent = bookingData.horario;
  document.getElementById('detailId').textContent      = bookingData.id;

  // Handler do botão de cancelamento
  document.getElementById('cancelBtn').addEventListener('click', async () => {
    if (!confirm('Tem certeza que deseja cancelar este agendamento?')) {
      return;
    }

    Utils.toggleLoading(true);

    try {
      /**
       * BUG CORRIGIDO (indiretamente): APIService.cancelAppointment não
       * existia em api.js — foi implementado lá. Aqui a chamada estava
       * correta, mas lançava "is not a function" em runtime.
       */
      const result = await APIService.cancelAppointment(bookingData.id);

      if (result.success) {
        Utils.showToast('Agendamento cancelado com sucesso', 'success');
        Utils.clearSession('lastBooking');
        setTimeout(() => {
          window.location.href = '../index.html';
        }, 2000);
      } else {
        Utils.showToast(result.error || 'Erro ao cancelar agendamento', 'error');
      }
    } catch (error) {
      console.error('[Confirmation] cancel error:', error);
      Utils.showToast('Erro ao cancelar. Tente novamente.', 'error');
    } finally {
      Utils.toggleLoading(false);
    }
  });
});