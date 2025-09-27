/** admin.js — Panel Admin terpisah (sinkron style & skema, plus CRUD Pegawai) */

/* =========================
   Inisialisasi Supabase
========================= */
(function initSupabaseClient(){
  const SUPABASE_URL  = window.__SUPABASE_URL  || window.SUPABASE_URL  || "";
  const SUPABASE_ANON = window.__SUPABASE_ANON || window.SUPABASE_ANON || "";
  const SB = (window.supabase && window.supabase.createClient)
           ? window.supabase
           : (window.Supabase && window.Supabase);

  if (!SB || !SB.createClient) {
    console.error("Supabase JS belum termuat. Pastikan CDN sudah disertakan.");
    window.__ADMIN_BOOT_ERROR__ = "Supabase JS belum termuat.";
    return;
  }
  if (!window.supabaseClient) {
    if (!SUPABASE_URL || !SUPABASE_ANON) {
      console.warn("SUPABASE_URL/ANON belum diisi di admin_styled.html.");
      window.__ADMIN_BOOT_ERROR__ = "Konfigurasi Supabase belum diisi pada admin_styled.html.";
    } else {
      window.supabaseClient = SB.createClient(SUPABASE_URL, SUPABASE_ANON);
    }
  }
})();

/* =========================
   Utilities
========================= */
function qs(id){ return document.getElementById(id); }
function setNumber(id, v){ const el = qs(id); if (el) el.textContent = (v ?? "—"); }
function showGuard(msg){
  const box = qs("guardMessage");
  if (box){ box.classList.remove("hidden"); box.textContent = msg; }
}

let ADMIN_ORG_ID = null;

/* =========================
   Auth & Guard Admin
========================= */
async function ensureAdmin(){
  try {
    if (!window.supabaseClient) {
      showGuard(window.__ADMIN_BOOT_ERROR__ || "Supabase client belum siap.");
      return false;
    }
    const { data: { session }, error } = await window.supabaseClient.auth.getSession();
    if (error) throw error;
    if (!session || !session.user) {
      showGuard("Anda belum login. Silakan kembali ke halaman utama untuk login.");
      return false;
    }

    // Cari profil di tabel umum aplikasi (prioritas employees)
    let profile = null;
    const candidateTables = ["employees", "profiles", "user_profiles"];
    for (const t of candidateTables) {
      const { data, error: e2 } = await window.supabaseClient
        .from(t)
        .select("id, email, name, position, organization_id")
        .eq("user_id", session.user.id)
        .maybeSingle();
      if (!e2 && data) { profile = data; break; }
    }

    if (!profile) { showGuard("Profil pengguna tidak ditemukan. Hubungi admin sistem."); return false; }
    if ((profile.position || "").toLowerCase() !== "admin") { showGuard("Akses ditolak: Anda bukan Admin."); return false; }

    ADMIN_ORG_ID = profile.organization_id || null;
    return true;
  } catch (err) {
    console.error(err);
    showGuard("Terjadi kesalahan saat memverifikasi sesi.");
    return false;
  }
}

/* =========================
   Statistik
========================= */
async function loadStats(){
  try {
    // Total Pegawai
    let totalEmployees = 0;
    {
      const { count, error } = await window.supabaseClient
        .from("employees")
        .select("id", { count: "exact", head: true });
      if (!error) totalEmployees = count || 0;
    }
    setNumber("statTotalEmployees", totalEmployees);

    // Lokasi Kantor (offices)
    let locations = 0;
    {
      const { count, error } = await window.supabaseClient
        .from("offices")
        .select("id", { count: "exact", head: true });
      if (!error) locations = count || 0;
    }
    setNumber("statLocations", locations);

    // Absensi hari ini — catatan: butuh RLS khusus agar Admin bisa lihat semua organisasi
    let todayCount = 0;
    {
      const d = new Date();
      const y = d.getFullYear();
      const m = String(d.getMonth()+1).padStart(2,"0");
      const dd = String(d.getDate()).padStart(2,"0");
      const start = `${y}-${m}-${dd} 00:00:00`;
      const end   = `${y}-${m}-${dd} 23:59:59`;

      const { count, error } = await window.supabaseClient
        .from("attendance")
        .select("id", { count: "exact", head: true })
        .gte("created_at", start)
        .lte("created_at", end);

      if (!error) todayCount = count || 0;
      else console.warn("attendance count error:", error?.message);
    }
    setNumber("statTodayAttendance", todayCount);
  } catch (err) {
    console.error("loadStats error:", err);
  }
}

/* =========================
   Daftar Pegawai + CRUD
========================= */
async function loadEmployees(q=""){
  const tbody = qs("employeesTbody");
  if (!tbody) return;
  tbody.innerHTML = `<tr><td colspan="5" class="px-4 py-3 text-gray-500">Memuat…</td></tr>`;
  try {
    let query = window.supabaseClient
      .from("employees")
      .select("id,name,nik,position,email")
      .order("name", { ascending: true })
      .limit(500);

    if (q) {
      query = query.or(`name.ilike.%${q}%,nik.ilike.%${q}%,email.ilike.%${q}%`);
    }

    const { data, error } = await query;
    if (error) throw error;

    if (!data || data.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5" class="px-4 py-3 text-gray-500">Tidak ada data</td></tr>`;
      return;
    }

    tbody.innerHTML = data.map(r => `
      <tr data-id="${r.id}">
        <td class="px-4 py-3">${r.name ?? "-"}</td>
        <td class="px-4 py-3">${r.nik ?? "-"}</td>
        <td class="px-4 py-3">${r.position ?? "-"}</td>
        <td class="px-4 py-3">${r.email ?? "-"}</td>
        <td class="px-4 py-3">
          <button class="edit-emp px-2 py-1 rounded-lg border border-gray-300 hover:bg-gray-50">Edit</button>
          <button class="del-emp px-2 py-1 rounded-lg border border-red-300 text-red-600 hover:bg-red-50">Hapus</button>
        </td>
      </tr>
    `).join("");
  } catch (err) {
    console.error("loadEmployees error:", err);
    tbody.innerHTML = `<tr><td colspan="5" class="px-4 py-3 text-red-600">Gagal memuat pegawai</td></tr>`;
  }
}

function openEmployeeModal(mode='create', rec=null){
  const m = qs('employeeModal');
  const title = qs('employeeModalTitle');
  const id = qs('empId');
  const name = qs('empName');
  const nik = qs('empNik');
  const email = qs('empEmail');
  const pos = qs('empPosition');
  const errBox = qs('employeeFormError');

  if (errBox) errBox.classList.add('hidden');
  if (mode === 'create') {
    title.textContent = 'Tambah Pegawai';
    id.value = '';
    name.value = ''; nik.value = ''; email.value = '';
    pos.value = 'Staff';
  } else {
    title.textContent = 'Edit Pegawai';
    id.value = rec.id;
    name.value = rec.name || '';
    nik.value = rec.nik || '';
    email.value = rec.email || '';
    pos.value = rec.position || 'Staff';
  }
  m.classList.remove('hidden');
}
function closeEmployeeModal(){ qs('employeeModal')?.classList.add('hidden'); }

async function saveEmployee(e){
  e.preventDefault();
  const id = qs('empId').value.trim();
  const name = qs('empName').value.trim();
  const nik = qs('empNik').value.trim();
  const email = qs('empEmail').value.trim();
  const position = qs('empPosition').value;
  const errBox = qs('employeeFormError');

  if (!name || !nik || !email || !position) {
    errBox.textContent = 'Nama, NIK, Email, dan Posisi wajib diisi.'; 
    errBox.classList.remove('hidden'); 
    return;
  }
  if (!ADMIN_ORG_ID) {
    errBox.textContent = 'Organization ID tidak ditemukan. Pastikan profil admin memiliki organization_id.'; 
    errBox.classList.remove('hidden'); 
    return;
  }

  try {
    if (id) {
      const { error } = await window.supabaseClient
        .from('employees')
        .update({ name, nik, email, position })
        .eq('id', id);
      if (error) throw error;
    } else {
      const payload = { name, nik, email, position, organization_id: ADMIN_ORG_ID };
      const { error } = await window.supabaseClient
        .from('employees')
        .insert(payload);
      if (error) throw error;
    }
    closeEmployeeModal();
    await loadEmployees(qs('employeeSearch')?.value?.trim() || '');
  } catch (err) {
    console.error('saveEmployee error:', err);
    errBox.textContent = err?.message || 'Gagal menyimpan data pegawai.';
    errBox.classList.remove('hidden');
  }
}

async function deleteEmployeeById(id){
  if (!confirm('Yakin ingin menghapus pegawai ini? Tindakan tidak dapat dibatalkan.')) return;
  try {
    const { error } = await window.supabaseClient
      .from('employees')
      .delete()
      .eq('id', id);
    if (error) throw error;
    await loadEmployees(qs('employeeSearch')?.value?.trim() || '');
  } catch (err) {
    console.error('deleteEmployee error:', err);
    alert('Gagal menghapus pegawai: ' + (err?.message || 'unknown error'));
  }
}

/* =========================
   Daftar Lokasi (offices)
========================= */
async function loadLocations(){
  const box = qs("locationsList");
  if (!box) return;
  box.textContent = "Memuat…";
  try {
    const { data, error } = await window.supabaseClient
      .from("offices")
      .select("id, name, address")
      .order("name", { ascending: true });
    if (error) throw error;

    if (!data || data.length === 0) {
      box.textContent = "Belum ada lokasi.";
      return;
    }
    box.innerHTML = data.map(l => `
      <div class="py-1.5">
        <div class="font-semibold">${l.name ?? "(Tanpa nama)"}</div>
        <div class="text-gray-500 text-sm">${l.address ?? ""}</div>
      </div>
    `).join("");
  } catch (err) {
    console.error("loadLocations error:", err);
    box.textContent = "Gagal memuat lokasi.";
  }
}

/* =========================
   Init
========================= */
async function initAdminPage(){
  if (!window.supabaseClient) {
    showGuard(window.__ADMIN_BOOT_ERROR__ || "Supabase client belum siap.");
    return;
  }
  const ok = await ensureAdmin();
  if (!ok) return;

  await loadStats();
  await loadEmployees();
  await loadLocations();

  // Logout
  qs("logoutBtn")?.addEventListener("click", async ()=>{
    try { await window.supabaseClient.auth.signOut(); } catch(e){}
    window.location.href = "index.html";
  });

  // Search debounce
  const search = qs("employeeSearch");
  if (search){
    let timer = null;
    search.addEventListener("input", ()=>{
      clearTimeout(timer);
      timer = setTimeout(()=> loadEmployees(search.value.trim()), 250);
    });
  }

  // Refresh list
  qs("refreshEmployees")?.addEventListener("click", ()=> loadEmployees(search ? search.value.trim() : ""));
  qs("refreshLocations")?.addEventListener("click", ()=> loadLocations());

  // Modal & CRUD Events
  qs("addEmployeeBtn")?.addEventListener("click", ()=> openEmployeeModal('create'));
  qs("closeEmployeeModal")?.addEventListener("click", closeEmployeeModal);
  qs("cancelEmployeeModal")?.addEventListener("click", closeEmployeeModal);
  qs("employeeForm")?.addEventListener("submit", saveEmployee);

  const tbody = qs("employeesTbody");
  if (tbody) {
    tbody.addEventListener("click", (ev) => {
      const tr = ev.target.closest("tr[data-id]");
      if (!tr) return;
      const id = tr.getAttribute("data-id");
      if (ev.target.classList.contains("edit-emp")) {
        const tds = tr.querySelectorAll("td");
        openEmployeeModal("edit", {
          id,
          name: tds[0].textContent.trim(),
          nik: tds[1].textContent.trim(),
          position: tds[2].textContent.trim(),
          email: tds[3].textContent.trim(),
        });
      } else if (ev.target.classList.contains("del-emp")) {
        deleteEmployeeById(id);
      }
    });
  }
}

document.addEventListener("DOMContentLoaded", initAdminPage);
