(() => {
  'use strict';

  if (window.__scTicketWidgetLoaded) return;
  window.__scTicketWidgetLoaded = true;

  const getToken = () => localStorage.getItem('token');
  const isAuthenticatedView = () => Boolean(getToken()) && !location.pathname.startsWith('/login');

  const style = document.createElement('style');
  style.textContent = `
    #sc-ticket-launcher[hidden],#sc-ticket-modal[hidden],#sc-ticket-form[hidden],#sc-ticket-list[hidden],#sc-ticket-result[hidden]{display:none!important}
    #sc-ticket-launcher{position:fixed;right:18px;bottom:18px;z-index:2147483000;display:flex;gap:8px;align-items:center;font-family:system-ui,-apple-system,sans-serif}
    .sc-ticket-launcher-button{border:0;border-radius:999px;padding:12px 16px;font:700 14px system-ui,-apple-system,sans-serif;box-shadow:0 8px 28px #0004;cursor:pointer;white-space:nowrap}
    #sc-ticket-new-button{background:#7b342b;color:#fff}#sc-ticket-list-button{background:#fff;color:#4b2721;border:1px solid #cbbdb5}
    #sc-ticket-modal{position:fixed;inset:0;z-index:2147483001;background:#0009;display:grid;place-items:center;padding:16px;font-family:system-ui,-apple-system,sans-serif}
    #sc-ticket-card{position:relative;width:min(580px,100%);max-height:92vh;overflow:auto;background:#fff;color:#211d1a;border-radius:18px;padding:22px;box-sizing:border-box;font:14px system-ui,-apple-system,sans-serif;box-shadow:0 20px 70px #0008}
    #sc-ticket-card h2{margin:0 36px 6px 0;font-size:22px}#sc-ticket-card>p{color:#655d57;margin:0 0 16px}
    #sc-ticket-close{position:absolute;right:14px;top:12px;border:0;background:transparent;color:#574f49;font-size:27px;line-height:1;cursor:pointer;padding:6px}
    #sc-ticket-card label{display:grid;gap:5px;margin:12px 0;font-weight:600}
    #sc-ticket-card input,#sc-ticket-card select,#sc-ticket-card textarea{width:100%;box-sizing:border-box;border:1px solid #d8d1ca;border-radius:9px;padding:10px;font:inherit;background:#fff;color:#211d1a}
    #sc-ticket-card textarea{min-height:96px;resize:vertical}
    .sc-ticket-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:18px}.sc-ticket-actions button{border:0;border-radius:9px;padding:10px 14px;font-weight:700;cursor:pointer}.sc-ticket-cancel{background:#eee9e4;color:#332c28}.sc-ticket-submit{background:#7b342b;color:#fff}.sc-ticket-submit:disabled{opacity:.55;cursor:wait}
    #sc-ticket-result{margin-top:12px;padding:10px;border-radius:8px;background:#f3efe9;white-space:pre-wrap}
    #sc-ticket-result[data-kind="success"]{background:#e7f6eb;color:#195d2b}#sc-ticket-result[data-kind="error"]{background:#fdeaea;color:#8a1c1c}
    .sc-ticket-tabs{display:flex;gap:8px;margin:12px 0 16px}.sc-ticket-tab{border:1px solid #d8d1ca;background:#fff;color:#4d4540;border-radius:8px;padding:8px 11px;font-weight:650;cursor:pointer}.sc-ticket-tab[aria-selected="true"]{background:#f0e4df;border-color:#9b5b50;color:#6b2b22}
    .sc-ticket-row{border-top:1px solid #eee;padding:12px 0}.sc-ticket-row:first-child{border-top:0}.sc-ticket-row b{display:block}.sc-ticket-row small{display:block;color:#756d67;margin-top:3px}.sc-ticket-response{margin-top:7px;padding:8px;border-radius:7px;background:#f5f2ee}
    #sc-ticket-empty{color:#655d57}.sc-ticket-retry{margin-top:10px;border:1px solid #bdaea5;border-radius:8px;background:#fff;padding:8px 11px;cursor:pointer}
    @media(max-width:600px){#sc-ticket-launcher{left:10px;right:10px;bottom:72px;justify-content:flex-end}.sc-ticket-launcher-button{padding:11px 13px;font-size:13px}#sc-ticket-card{padding:18px}}
    @media(max-width:390px){#sc-ticket-launcher{gap:6px}.sc-ticket-launcher-button{padding:10px 11px;font-size:12px}}
  `;
  document.head.append(style);

  document.body.insertAdjacentHTML('beforeend', `
    <div id="sc-ticket-launcher" hidden aria-label="Mesa de ayuda">
      <button id="sc-ticket-list-button" class="sc-ticket-launcher-button" type="button">Mis tickets</button>
      <button id="sc-ticket-new-button" class="sc-ticket-launcher-button" type="button">+ Nuevo ticket</button>
    </div>
    <div id="sc-ticket-modal" hidden>
      <div id="sc-ticket-card" role="dialog" aria-modal="true" aria-labelledby="sc-ticket-title">
        <button id="sc-ticket-close" type="button" aria-label="Cerrar">×</button>
        <h2 id="sc-ticket-title">Mesa de ayuda</h2>
        <p>El reporte llegará al equipo responsable y podrás seguir su estado desde acá.</p>
        <div class="sc-ticket-tabs" role="tablist">
          <button class="sc-ticket-tab" type="button" role="tab" data-tab="new">Nuevo ticket</button>
          <button class="sc-ticket-tab" type="button" role="tab" data-tab="list">Mis tickets</button>
        </div>
        <form id="sc-ticket-form">
          <label>¿Qué pasó?<input name="title" maxlength="180" required placeholder="Ej: La canilla 4 pierde cerveza"></label>
          <label>Detalle<textarea name="description" maxlength="4000" placeholder="Contanos qué estabas haciendo y qué necesitás"></textarea></label>
          <label>Sucursal<select name="location"><option>Recoleta</option><option>Palermo</option><option>Central</option></select></label>
          <label>Sector<select name="area"><option>Salón</option><option>Cocina</option><option>Caja</option><option>Barra</option><option>Depósito</option><option>Administración</option></select></label>
          <label>Categoría<select name="category"><option>Operación general</option><option>Stock y cerveza</option><option>Sistemas y caja</option><option>Mantenimiento</option><option>Compras y proveedores</option></select></label>
          <label>Impacto<select name="impact"><option value="normal">Puedo seguir trabajando</option><option value="high">Afecta bastante la operación</option><option value="blocking">Impide trabajar o es peligroso</option></select></label>
          <label>Foto opcional<input type="file" name="photo" accept="image/*" capture="environment"></label>
          <div id="sc-ticket-result" hidden role="status" aria-live="polite"></div>
          <div class="sc-ticket-actions"><button class="sc-ticket-cancel" type="button">Cerrar</button><button class="sc-ticket-submit" type="submit">Crear ticket</button></div>
        </form>
        <div id="sc-ticket-list" hidden></div>
      </div>
    </div>`);

  const launcher = document.querySelector('#sc-ticket-launcher');
  const modal = document.querySelector('#sc-ticket-modal');
  const form = document.querySelector('#sc-ticket-form');
  const list = document.querySelector('#sc-ticket-list');
  const result = document.querySelector('#sc-ticket-result');
  const tabs = Array.from(document.querySelectorAll('.sc-ticket-tab'));

  const escapeHtml = (value = '') => {
    const div = document.createElement('div');
    div.textContent = String(value);
    return div.innerHTML;
  };
  const statusLabel = (status) => ({
    new: 'Nuevo', triage: 'En análisis', in_progress: 'En curso',
    waiting_reporter: 'Esperando al local', waiting: 'Esperando', resolved: 'Resuelto',
    pending_sync: 'Pendiente de sincronización', closed: 'Cerrado', cancelled: 'Cancelado',
  })[status] || status || 'Sin estado';
  const formatDate = (value) => {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '' : date.toLocaleString('es-AR');
  };
  const closeModal = () => { modal.hidden = true; };
  const ensureSession = () => {
    if (getToken()) return true;
    closeModal();
    launcher.hidden = true;
    return false;
  };
  const apiFetch = async (options = {}) => {
    if (!ensureSession()) throw new Error('Tu sesión terminó. Volvé a ingresar.');
    const headers = new Headers(options.headers || {});
    headers.set('Authorization', `Bearer ${getToken()}`);
    const response = await fetch('/api/tickets', { ...options, headers });
    let data = {};
    try { data = await response.json(); } catch { /* respuesta sin JSON */ }
    if (response.status === 401) {
      closeModal();
      launcher.hidden = true;
      throw new Error('Tu sesión terminó. Volvé a ingresar.');
    }
    if (!response.ok) throw new Error(data.detail || 'No se pudo completar la operación.');
    return data;
  };

  function selectTab(name) {
    tabs.forEach((tab) => tab.setAttribute('aria-selected', String(tab.dataset.tab === name)));
    const isList = name === 'list';
    form.hidden = isList;
    list.hidden = !isList;
    if (isList) loadTickets();
  }

  function openModal(tabName) {
    if (!ensureSession()) return;
    modal.hidden = false;
    selectTab(tabName);
    document.querySelector('#sc-ticket-close').focus();
  }

  async function loadTickets() {
    list.hidden = false;
    list.innerHTML = '<p id="sc-ticket-empty">Cargando tickets…</p>';
    try {
      const data = await apiFetch();
      const tickets = Array.isArray(data.tickets) ? data.tickets : [];
      list.innerHTML = tickets.length ? tickets.map((ticket) => `
        <div class="sc-ticket-row">
          <b>${escapeHtml(ticket.code || 'Pendiente')} · ${escapeHtml(ticket.title)}</b>
          <small>${escapeHtml(ticket.location || 'Sin sucursal')} · ${escapeHtml(statusLabel(ticket.status))}${ticket.updatedAt ? ` · actualizado ${escapeHtml(formatDate(ticket.updatedAt))}` : ''}</small>
          ${ticket.lastResponse ? `<div class="sc-ticket-response"><strong>Respuesta:</strong> ${escapeHtml(ticket.lastResponse)}</div>` : ''}
        </div>`).join('') : '<p id="sc-ticket-empty">Todavía no cargaste tickets.</p>';
    } catch (error) {
      list.innerHTML = `<p id="sc-ticket-empty">${escapeHtml(error.message)}</p><button class="sc-ticket-retry" type="button">Reintentar</button>`;
      const retry = list.querySelector('.sc-ticket-retry');
      if (retry) retry.onclick = loadTickets;
    }
  }

  document.querySelector('#sc-ticket-new-button').onclick = () => openModal('new');
  document.querySelector('#sc-ticket-list-button').onclick = () => openModal('list');
  document.querySelector('#sc-ticket-close').onclick = closeModal;
  document.querySelector('.sc-ticket-cancel').onclick = closeModal;
  modal.addEventListener('click', (event) => { if (event.target === modal) closeModal(); });
  document.addEventListener('keydown', (event) => { if (event.key === 'Escape' && !modal.hidden) closeModal(); });
  tabs.forEach((tab) => { tab.onclick = () => selectTab(tab.dataset.tab); });

  form.onsubmit = async (event) => {
    event.preventDefault();
    const submit = form.querySelector('.sc-ticket-submit');
    submit.disabled = true;
    result.hidden = false;
    result.dataset.kind = '';
    result.textContent = 'Creando ticket…';
    const payload = new FormData(form);
    payload.set('source_url', location.href);
    payload.set('context', JSON.stringify({ path: location.pathname, userAgent: navigator.userAgent }));
    try {
      const data = await apiFetch({ method: 'POST', body: payload });
      result.dataset.kind = 'success';
      result.textContent = `${data.ticket.code || 'Ticket pendiente de sincronización'} creado correctamente. Podés seguirlo en “Mis tickets”.`;
      form.reset();
    } catch (error) {
      result.dataset.kind = 'error';
      result.textContent = error.message;
    } finally {
      submit.disabled = false;
    }
  };

  function syncVisibility() {
    const shouldShow = isAuthenticatedView();
    launcher.hidden = !shouldShow;
    if (!shouldShow) closeModal();
  }

  window.addEventListener('storage', syncVisibility);
  window.addEventListener('popstate', syncVisibility);
  window.addEventListener('hashchange', syncVisibility);
  window.addEventListener('focus', syncVisibility);
  document.addEventListener('visibilitychange', syncVisibility);
  setInterval(syncVisibility, 750);
  syncVisibility();
})();
