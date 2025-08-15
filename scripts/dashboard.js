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
    // Quitar active a todos
    tabLinks.forEach(l => l.classList.remove('active'));
    tabContents.forEach(c => c.classList.remove('active'));

    // Activar el seleccionado
    link.classList.add('active');
    document.getElementById(link.dataset.tab).classList.add('active');
  });
});

// ------------------------------
// Cerrar sesión
// ------------------------------
btnLogout.addEventListener('click', async () => {
  await supabase.auth.signOut();
  window.location.href = 'index.html';
});

// ------------------------------
// Verificar usuario logueado
// ------------------------------
async function checkAuth() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) window.location.href = 'index.html';
  return session.user;
}

// ------------------------------
// Guardar operación
// ------------------------------
tradeForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const user = await checkAuth();
  const date = document.getElementById('trade-date').value;
  const symbol = document.getElementById('symbol').value;
  const capital = parseFloat(document.getElementById('capital').value);
  const tp = parseFloat(document.getElementById('tp_percent').value) || 0;
  const sl = parseFloat(document.getElementById('sl_percent').value) || 0;
  const entry = parseFloat(document.getElementById('entry_price').value) || 0;
  const exit = parseFloat(document.getElementById('exit_price').value) || 0;
  const outcome = document.getElementById('outcome').value;
  const notes = document.getElementById('notes').value;

  if(entry <= 0 || exit <= 0) {
    alert('El precio de entrada y salida debe ser mayor a 0');
    return;
  }

  const pnl = ((exit - entry) / entry) * capital;

  // Manejo de imagen
  const imageFile = document.getElementById('image').files[0];
  let imageUrl = null;

  if(imageFile) {
    const fileExt = imageFile.name.split('.').pop();
    const fileName = `${user.id}_${Date.now()}.${fileExt}`;
    const { data, error } = await supabase.storage
      .from('fichas')
      .upload(fileName, imageFile, { cacheControl: '3600', upsert: false });

    if(error) {
      alert('Error subiendo imagen: ' + error.message);
      return;
    }

    const { data: urlData } = supabase.storage.from('fichas').getPublicUrl(fileName);
    imageUrl = urlData.publicUrl;
  }

  const { error } = await supabase
    .from('trades')
    .insert([{ user_id: user.id, date, symbol, capital, tp, sl, entry, exit, pnl, outcome, notes, image_url: imageUrl }]);

  if(error) alert('Error guardando operación: ' + error.message);
  else {
    tradeForm.reset();
    loadTrades();
    // Opcional: cambiar a tab historial automáticamente
    document.querySelector('.tab-link[data-tab="tab-history"]').click();
  }
});

// ------------------------------
// Cargar historial
// ------------------------------
async function loadTrades() {
  const user = await checkAuth();
  const { data: trades, error } = await supabase
    .from('trades')
    .select('*')
    .eq('user_id', user.id)
    .order('date', { ascending: false });

  if(error) { alert('Error cargando historial: ' + error.message); return; }

  // Filtrar
  let filtered = trades;
  if(filterSymbol.value) filtered = filtered.filter(t => t.symbol.toLowerCase().includes(filterSymbol.value.toLowerCase()));
  if(filterOutcome.value) filtered = filtered.filter(t => t.outcome === filterOutcome.value);

  tradesTableBody.innerHTML = '';
  filtered.forEach(t => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${t.date}</td>
      <td>${t.symbol}</td>
      <td>${t.capital.toFixed(2)}</td>
      <td>${t.pnl.toFixed(2)}</td>
      <td>${(t.capital + t.pnl).toFixed(2)}</td>
      <td>${t.image_url ? `<a href="${t.image_url}" target="_blank">Ver</a>` : '-'}</td>
      <td><button onclick="deleteTrade(${t.id}, '${t.image_url}')">Eliminar</button></td>
    `;
    tradesTableBody.appendChild(tr);
  });

  updateStats(filtered);
  updateChart(filtered);
}

// ------------------------------
// Borrar operación
// ------------------------------
async function deleteTrade(id, imageUrl) {
  if(!confirm('¿Seguro quieres eliminar esta operación?')) return;

  if(imageUrl) {
    const fileName = imageUrl.split('/').pop();
    const { error } = await supabase.storage.from('fichas').remove([fileName]);
    if(error) console.warn('No se pudo borrar la imagen:', error.message);
  }

  const { error } = await supabase.from('trades').delete().eq('id', id);
  if(error) alert('Error al eliminar: ' + error.message);
  else loadTrades();
}

// ------------------------------
// Estadísticas
// ------------------------------
function updateStats(trades) {
  const totalPnL = trades.reduce((sum, t) => sum + t.pnl, 0);
  const wins = trades.filter(t => t.outcome === 'win').length;
  const total = trades.length;
  statTotal.textContent = `$${totalPnL.toFixed(2)}`;
  statWinrate.textContent = total ? ((wins/total)*100).toFixed(1) + '%' : '-';
  statTrades.textContent = total;
}

// ------------------------------
// Gráfico mensual
// ------------------------------
function updateChart(trades) {
  if(!ctxChart) return; // Evitar error si no hay canvas
  const monthly = {};
  trades.forEach(t => {
    const month = t.date.slice(0,7);
    if(!monthly[month]) monthly[month] = 0;
    monthly[month] += t.pnl;
  });

  const labels = Object.keys(monthly).sort();
  const data = labels.map(m => monthly[m]);

  if(chartMonthly) chartMonthly.destroy();
  chartMonthly = new Chart(ctxChart, {
    type: 'bar',
    data: { labels, datasets: [{ label: 'PnL mensual', data, backgroundColor: '#1a73e8' }] },
    options: { responsive: true, plugins: { legend: { display: false } } }
  });
}

// ------------------------------
// Filtros
// ------------------------------
filterSymbol.addEventListener('input', loadTrades);
filterOutcome.addEventListener('change', loadTrades);

// ------------------------------
// Inicializar
// ------------------------------
window.addEventListener('DOMContentLoaded', async () => {
  await checkAuth();
  loadTrades();
});
