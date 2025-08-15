// scripts/dashboard.js

// ------------------------------
// Referencias del DOM
// ------------------------------
const btnLogout = document.getElementById('btn-logout');
const tradeForm = document.getElementById('trade-form');
const tradesTableBody = document.querySelector('#trades-table tbody');
const filterSymbol = document.getElementById('filter-symbol');
const filterOutcome = document.getElementById('filter-outcome');

const statTotal = document.getElementById('stat-total');
const statWinrate = document.getElementById('stat-winrate');
const statTrades = document.getElementById('stat-trades');
const ctxChart = document.getElementById('chart-monthly')?.getContext('2d');

let chartMonthly;

// ------------------------------
// Tabs
// ------------------------------
const tabLinks = document.querySelectorAll('.tab-link');
const tabContents = document.querySelectorAll('.tab-content');

tabLinks.forEach(link => {
  link.addEventListener('click', () => {
    tabLinks.forEach(l => l.classList.remove('active'));
    tabContents.forEach(c => c.classList.remove('active'));

    link.classList.add('active');
    const target = link.dataset.tab;
    if (target) {
      const el = document.getElementById(target);
      if (el) el.classList.add('active');
    }
  });
});

// ------------------------------
// Logout
// ------------------------------
btnLogout.addEventListener('click', async () => {
  try {
    await supabase.auth.signOut();
  } catch (err) {
    console.warn('Logout error:', err);
  } finally {
    window.location.href = 'index.html';
  }
});

// ------------------------------
// Auth helper
// ------------------------------
async function checkAuth() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    window.location.href = 'index.html';
    throw new Error('No session');
  }
  return session.user;
}

// ------------------------------
// Guardar operación (form submit)
// ------------------------------
tradeForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    const user = await checkAuth();

    const date = document.getElementById('trade-date').value;
    const symbol = document.getElementById('symbol').value.trim();
    const capital = parseFloat(document.getElementById('capital').value);
    const tp = parseFloat(document.getElementById('tp_percent').value) || 0;
    const sl = parseFloat(document.getElementById('sl_percent').value) || 0;
    const entry = parseFloat(document.getElementById('entry_price').value) || 0;
    const exit = parseFloat(document.getElementById('exit_price').value) || 0;
    const outcome = document.getElementById('outcome').value;
    const notes = document.getElementById('notes').value.trim();

    // Validaciones
    if (!symbol) { alert('El símbolo es obligatorio'); return; }
    if (isNaN(capital) || capital <= 0) { alert('El capital debe ser mayor a 0'); return; }
    if (isNaN(entry) || isNaN(exit) || entry <= 0 || exit <= 0) { alert('Precio de entrada y salida debe ser mayor a 0'); return; }

    const pnl = ((exit - entry) / entry) * capital;

    // Manejo de imagen: subir con prefijo user.id/<timestamp>.<ext>
    let imageUrl = null;
    let imagePath = null;
    const imageFile = document.getElementById('image').files[0];

    if (imageFile) {
      const fileExt = imageFile.name.split('.').pop();
      const fileName = `${user.id}/${Date.now()}.${fileExt}`; // importante: prefijo por usuario
      imagePath = fileName;

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('fichas')
        .upload(fileName, imageFile, { cacheControl: '3600', upsert: true });

      if (uploadError) {
        console.error('Storage upload error:', uploadError);
        alert('Error subiendo imagen: ' + uploadError.message);
        return;
      }

      // Obtener URL pública (si el bucket tiene lectura pública)
      const { data: urlData, error: urlError } = supabase.storage.from('fichas').getPublicUrl(fileName);
      if (urlError) {
        console.warn('getPublicUrl error:', urlError);
      } else {
        // Diferentes versiones de la API pueden devolver publicUrl o public_url
        imageUrl = urlData?.publicUrl || urlData?.public_url || null;
      }

      // Si prefieres signed URL en buckets privados:
      // const { data: signed, error: signedErr } = await supabase.storage.from('fichas').createSignedUrl(fileName, 60);
      // if (!signedErr) imageUrl = signed.signedURL;
    }

    // Insertar en tabla trades (guardar image_url e image_path)
    const { error: insertError } = await supabase.from('trades').insert([{
      user_id: user.id,
      date,
      symbol,
      capital,
      tp,
      sl,
      entry,
      exit,
      pnl,
      outcome,
      notes,
      image_url: imageUrl,
      image_path: imagePath
    }]);

    if (insertError) {
      console.error('Insert trade error:', insertError);
      alert('Error guardando operación: ' + insertError.message);
      return;
    }

    // Éxito
    tradeForm.reset();
    await loadTrades();
    const historyTab = document.querySelector('.tab-link[data-tab="history"]');
    if (historyTab) historyTab.click();

  } catch (err) {
    console.error('Submit handler error:', err);
    // Si checkAuth redirige, esto puede lanzar. Ya está bien.
  }
});

// ------------------------------
// Cargar historial
// ------------------------------
async function loadTrades() {
  try {
    const user = await checkAuth();

    const { data: trades, error } = await supabase
      .from('trades')
      .select('*')
      .eq('user_id', user.id)
      .order('date', { ascending: false });

    if (error) {
      console.error('Error loading trades:', error);
      alert('Error cargando historial: ' + error.message);
      return;
    }

    // Aplicar filtros en cliente
    let filtered = trades || [];
    if (filterSymbol && filterSymbol.value) {
      filtered = filtered.filter(t => t.symbol && t.symbol.toLowerCase().includes(filterSymbol.value.toLowerCase()));
    }
    if (filterOutcome && filterOutcome.value) {
      filtered = filtered.filter(t => t.outcome === filterOutcome.value);
    }

    // Render tabla sin inyectar HTML peligroso
    tradesTableBody.innerHTML = '';
    filtered.forEach(t => {
      const tr = document.createElement('tr');

      const tdDate = document.createElement('td'); tdDate.textContent = t.date || '-';
      const tdSymbol = document.createElement('td'); tdSymbol.textContent = t.symbol || '-';
      const tdCapital = document.createElement('td'); tdCapital.textContent = (typeof t.capital === 'number') ? t.capital.toFixed(2) : '-';
      const tdPnl = document.createElement('td'); tdPnl.textContent = (typeof t.pnl === 'number') ? t.pnl.toFixed(2) : '-';
      const tdResult = document.createElement('td'); tdResult.textContent = (typeof t.capital === 'number' && typeof t.pnl === 'number') ? (t.capital + t.pnl).toFixed(2) : '-';

      const tdImage = document.createElement('td');
      if (t.image_url) {
        const a = document.createElement('a');
        a.href = t.image_url;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        a.textContent = 'Ver';
        tdImage.appendChild(a);
      } else {
        tdImage.textContent = '-';
      }

      const tdActions = document.createElement('td');
      const btnDelete = document.createElement('button');
      btnDelete.textContent = 'Eliminar';
      btnDelete.addEventListener('click', () => deleteTrade(t.id, t.image_path));
      tdActions.appendChild(btnDelete);

      tr.appendChild(tdDate);
      tr.appendChild(tdSymbol);
      tr.appendChild(tdCapital);
      tr.appendChild(tdPnl);
      tr.appendChild(tdResult);
      tr.appendChild(tdImage);
      tr.appendChild(tdActions);

      tradesTableBody.appendChild(tr);
    });

    updateStats(filtered);
    updateChart(filtered);

  } catch (err) {
    console.error('loadTrades error:', err);
  }
}

// ------------------------------
// Borrar operación
// ------------------------------
async function deleteTrade(id, imagePath) {
  try {
    if (!confirm('¿Seguro quieres eliminar esta operación?')) return;

    // Primero borrar fichero (si existe)
    if (imagePath) {
      const { error: rmError } = await supabase.storage.from('fichas').remove([imagePath]);
      if (rmError) {
        console.warn('Storage remove error:', rmError);
        // no return; intentar borrar registro de todos modos
      }
    }

    const { error } = await supabase.from('trades').delete().eq('id', id);
    if (error) {
      console.error('Error deleting trade:', error);
      alert('Error al eliminar: ' + error.message);
    } else {
      await loadTrades();
    }
  } catch (err) {
    console.error('deleteTrade error:', err);
  }
}

// ------------------------------
// Estadísticas
// ------------------------------
function updateStats(trades) {
  const totalPnL = (trades || []).reduce((sum, t) => sum + (t.pnl || 0), 0);
  const wins = (trades || []).filter(t => t.outcome === 'win').length;
  const total = (trades || []).length;

  statTotal.textContent = `$${totalPnL.toFixed(2)}`;
  statWinrate.textContent = total ? ((wins / total) * 100).toFixed(1) + '%' : '-';
  statTrades.textContent = total;
}

// ------------------------------
// Gráfico mensual
// ------------------------------
function updateChart(trades) {
  if (!ctxChart) return;

  const monthly = {};
  (trades || []).forEach(t => {
    const month = (t.date || '').slice(0, 7); // YYYY-MM
    if (!monthly[month]) monthly[month] = 0;
    monthly[month] += (t.pnl || 0);
  });

  const labels = Object.keys(monthly).sort();
  const data = labels.map(m => monthly[m]);

  if (chartMonthly) chartMonthly.destroy();
  chartMonthly = new Chart(ctxChart, {
    type: 'bar',
    data: { labels, datasets: [{ label: 'PnL mensual', data, backgroundColor: '#1a73e8' }] },
    options: { responsive: true, plugins: { legend: { display: false } } }
  });
}

// ------------------------------
// Filtros
// ------------------------------
if (filterSymbol) filterSymbol.addEventListener('input', () => loadTrades());
if (filterOutcome) filterOutcome.addEventListener('change', () => loadTrades());

// ------------------------------
// Inicializar
// ------------------------------
window.addEventListener('DOMContentLoaded', async () => {
  try {
    await checkAuth();
    await loadTrades();
  } catch (err) {
    console.warn('Init warning:', err);
  }
});
