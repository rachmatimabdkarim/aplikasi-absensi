
/** admin.js — Halaman admin terpisah
 * Fitur:
 * - Guard: hanya user dengan profile.position === 'Admin' yang boleh akses
 * - Statistik ringkas + tabel pegawai + daftar lokasi kantor
 * - Logout
 *
 * Integrasi Supabase:
 * - Jika window.supabase sudah ada (dari file lain), gunakan itu.
 * - Jika belum ada, inisialisasi dari window.__SUPABASE_URL dan window.__SUPABASE_ANON
 *   → Silakan set keduanya di index.html atau di sini secara langsung.
 */

(function(){
  const SUPABASE_URL = window.__SUPABASE_URL || window.SUPABASE_URL || "";
  const SUPABASE_ANON = window.__SUPABASE_ANON || window.SUPABASE_ANON || "";

  if (!window.supabase) {
    if (typeof window.supabase === 'undefined' && typeof window.Supabase === 'undefined') {
      console.error('Supabase JS belum termuat. Pastikan CDN @supabase/supabase-js ada di halaman.');
    }
  }

  // Buat client jika belum ada
  if (!window.supabaseClient) {
    try {
      const sb = (window.supabase && window.supabase.createClient)
        ? window.supabase
        : (window.Supabase && window.Supabase);
      if (sb && sb.createClient) {
        window.supabaseClient = sb.createClient(SUPABASE_URL, SUPABASE_ANON);
      }
    } catch (err) {
      console.error('Gagal membuat Supabase client:', err);
    }
  }
})();

function qs(id){ return document.getElementById(id); }
function setNumber(id, v){ const el = qs(id); if (el) el.textContent = (v ?? '—'); }
function showGuard(msg){
  const box = qs('guardMessage');
  if (box){ box.classList.remove('hidden'); box.textContent = msg; }
}

/** Cek sesi dan role Admin */
async function ensureAdmin(){
  try {
    const { data: { session }, error } = await window.supabaseClient.auth.getSession();
    if (error) throw error;
    if (!session || !session.user) {
      showGuard('Anda belum login. Silakan kembali ke halaman utama untuk login.');
      return false;
    }
    // Ambil profil user (asumsi tabel: profiles / employees / user_profiles — silakan sesuaikan)
    let profile = null;
    // Coba beberapa nama tabel yang umum dipakai aplikasi Anda
    const candidateTables = ['employees', 'profiles', 'user_profiles'];
    for (const t of candidateTables) {
      const { data, error: e2 } = await window.supabaseClient
        .from(t)
        .select('id, email, name, position')
        .eq('user_id', session.user.id)
        .maybeSingle();
      if (!e2 && data) { profile = data; break; }
    }
    if (!profile) {
      showGuard('Profil pengguna tidak ditemukan. Hubungi admin sistem.');
      return false;
    }
    if ((profile.position || '').toLowerCase() !== 'admin') {
      showGuard('Akses ditolak: Anda bukan Admin.');
      return false;
    }
    return true;
  } catch (err) {
    console.error(err);
    showGuard('Terjadi kesalahan saat memverifikasi sesi.');
    return false;
  }
}

/** Muat statistik ringkas */
async function loadStats(){
  try {
    // Total Pegawai
    let totalEmployees = 0;
    {
      const { count, error } = await window.supabaseClient
        .from('employees')
        .select('id', { count: 'exact', head: true });
      if (!error) totalEmployees = count || 0;
    }
    setNumber('statTotalEmployees', totalEmployees);

    // Lokasi Kantor
    let locations = 0;
    {
      const { count, error } = await window.supabaseClient
        .from('office_locations')
        .select('id', { count: 'exact', head: true });
      if (!error) locations = count || 0;
    }
    setNumber('statLocations', locations);

    // Absensi hari ini
    let todayCount = 0;
    {
      const d = new Date();
      const y = d.getFullYear();
      const m = String(d.getMonth()+1).padStart(2,'0');
      const dd = String(d.getDate()).padStart(2,'0');
      const today = `${y}-${m}-${dd}`;
      const { count, error } = await window.supabaseClient
        .from('attendance')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', `${today} 00:00:00`)
        .lte('created_at', `${today} 23:59:59`);
      if (!error) todayCount = count || 0;
    }
    setNumber('statTodayAttendance', todayCount);
  } catch (err) {
    console.error('loadStats error:', err);
  }
}

/** Tabel pegawai */
async function loadEmployees(q=''){
  const tbody = qs('employeesTbody');
  if (!tbody) return;
  tbody.innerHTML = `<tr><td colspan="4" class="muted">Memuat…</td></tr>`;
  try {
    let query = window.supabaseClient.from('employees').select('name,nip,position,email').order('name', { ascending: true }).limit(500);
    if (q) {
      query = query.or(`name.ilike.%${q}%,nip.ilike.%${q}%,email.ilike.%${q}%`);
    }
    const { data, error } = await query;
    if (error) throw error;
    if (!data || data.length === 0) {
      tbody.innerHTML = `<tr><td colspan="4" class="muted">Tidak ada data</td></tr>`;
      return;
    }
    tbody.innerHTML = data.map(r=>`<tr>
      <td>${r.name ?? '-'}</td>
      <td>${r.nip ?? '-'}</td>
      <td>${r.position ?? '-'}</td>
      <td>${r.email ?? '-'}</td>
    </tr>`).join('');
  } catch (err) {
    console.error('loadEmployees error:', err);
    tbody.innerHTML = `<tr><td colspan="4" class="muted">Gagal memuat pegawai</td></tr>`;
  }
}

/** Daftar lokasi */
async function loadLocations(){
  const box = qs('locationsList');
  if (!box) return;
  box.textContent = 'Memuat…';
  try {
    const { data, error } = await window.supabaseClient
      .from('office_locations')
      .select('id, office_name, address')
      .order('office_name', { ascending: true });
    if (error) throw error;
    if (!data || data.length === 0) {
      box.textContent = 'Belum ada lokasi.';
      return;
    }
    box.innerHTML = data.map(l => `<div style="padding:6px 0;">
      <div style="font-weight:600">${l.office_name ?? '(Tanpa nama)'}</div>
      <div class="muted">${l.address ?? ''}</div>
    </div>`).join('');
  } catch (err) {
    console.error('loadLocations error:', err);
    box.textContent = 'Gagal memuat lokasi.';
  }
}

async function initAdminPage(){
  const ok = await ensureAdmin();
  if (!ok) return;
  await loadStats();
  await loadEmployees();
  await loadLocations();

  const logoutBtn = qs('logoutBtn');
  if (logoutBtn){
    logoutBtn.addEventListener('click', async ()=>{
      try { await window.supabaseClient.auth.signOut(); } catch(e){}
      window.location.href = 'index.html';
    });
  }
  const search = qs('employeeSearch');
  if (search){
    let timer = null;
    search.addEventListener('input', ()=>{
      clearTimeout(timer);
      timer = setTimeout(()=> loadEmployees(search.value.trim()), 250);
    });
  }
  const refreshEmployees = qs('refreshEmployees');
  if (refreshEmployees){
    refreshEmployees.addEventListener('click', ()=> loadEmployees(search ? search.value.trim() : ''));
  }
  const refreshLocations = qs('refreshLocations');
  if (refreshLocations){
    refreshLocations.addEventListener('click', ()=> loadLocations());
  }
}

document.addEventListener('DOMContentLoaded', initAdminPage);
