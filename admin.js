/** admin.js — Panel Admin terpisah (versi sinkron skema) */

(function initSupabaseClient(){
  // 1) Ambil kredensial dari global (set di admin_styled.html) atau fallback
  const SUPABASE_URL  = window.__SUPABASE_URL  || window.SUPABASE_URL  || "https://rwascvkexdjirtvggaiu.supabase.co";
  const SUPABASE_ANON = window.__SUPABASE_ANON || window.SUPABASE_ANON || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ3YXNjdmtleGRqaXJ0dmdnYWl1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg5MjQzMjksImV4cCI6MjA3NDUwMDMyOX0.NkSE29IW1CO9o7z-mN0KxOwY9WHSedsDhH-TkAWtTjo";

  // 2) Pastikan lib @supabase/supabase-js ada
  const SB = (window.supabase && window.supabase.createClient)
           ? window.supabase
           : (window.Supabase && window.Supabase);

  if (!SB || !SB.createClient) {
    console.error("Supabase JS belum termuat. Pastikan CDN sudah disertakan.");
    window.__ADMIN_BOOT_ERROR__ = "Supabase JS belum termuat.";
    return;
  }

  // 3) Buat client jika belum ada
  if (!window.supabaseClient) {
    if (!SUPABASE_URL || !SUPABASE_ANON) {
      console.warn("SUPABASE_URL/ANON belum diisi di admin HTML.");
      window.__ADMIN_BOOT_ERROR__ = "Konfigurasi Supabase belum diisi pada admin_styled.html.";
    } else {
      window.supabaseClient = SB.createClient(SUPABASE_URL, SUPABASE_ANON);
    }
  }
})();

function qs(id){ return document.getElementById(id); }
function setNumber(id, v){ const el = qs(id); if (el) el.textContent = (v ?? "—"); }
function showGuard(msg){
  const box = qs("guardMessage");
  if (box){ box.classList.remove("hidden"); box.textContent = msg; }
}

/** Cek sesi & role Admin berdasar tabel employees.position */
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

    // Cari profil pada tabel yang umum dipakai aplikasi
    let profile = null;
    const candidateTables = ["employees", "profiles", "user_profiles"];
    for (const t of candidateTables) {
      const { data, error: e2 } = await window.supabaseClient
        .from(t)
        .select("id, email, name, position")
        .eq("user_id", session.user.id)
        .maybeSingle();
      if (!e2 && data) { profile = data; break; }
    }

    if (!profile) {
      showGuard("Profil pengguna tidak ditemukan. Hubungi admin sistem.");
      return false;
    }
    if ((profile.position || "").toLowerCase() !== "admin") {
      showGuard("Akses ditolak: Anda bukan Admin.");
      return false;
    }
    return true;
  } catch (err) {
    console.error(err);
    showGuard("Terjadi kesalahan saat memverifikasi sesi.");
    return false;
  }
}

/** Statistik: total pegawai, total lokasi (offices), absensi hari ini */
async function loadStats(){
  try {
    // Total Pegawai (employees)
    let totalEmployees = 0;
    {
      const { count, error } = await window.supabaseClient
        .from("employees")
        .select("id", { count: "exact", head: true });
      if (!error) totalEmployees = count || 0;
    }
    setNumber("statTotalEmployees", totalEmployees);

    // Lokasi Kantor (offices) — ganti dari office_locations -> offices
    let locations = 0;
    {
      const { count, error } = await window.supabaseClient
        .from("offices")
        .select("id", { count: "exact", head: true });
      if (!error) locations = count || 0;
    }
    setNumber("statLocations", locations);

    // Absensi hari ini (attendance)
    // Catatan: dengan RLS default, ini hanya menghitung milik user sendiri.
    // Untuk rekap semua pegawai, tambahkan policy SELECT untuk Admin di DB.
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

/** Tabel pegawai */
async function loadEmployees(q=""){
  const tbody = qs("employeesTbody");
  if (!tbody) return;
  tbody.innerHTML = `<tr><td colspan="4" class="text-gray-500">Memuat…</td></tr>`;
  try {
    // pakai kolom nik (bukan nip)
    let query = window.supabaseClient
      .from("employees")
      .select("name,nik,position,email")
      .order("name", { ascending: true })
      .limit(500);

    if (q) {
      // cari di name / nik / email
      query = query.or(`name.ilike.%${q}%,nik.ilike.%${q}%,email.ilike.%${q}%`);
    }

    const { data, error } = await query;
    if (error) throw error;

    if (!data || data.length === 0) {
      tbody.innerHTML = `<tr><td colspan="4" class="text-gray-500">Tidak ada data</td></tr>`;
      return;
    }

    tbody.innerHTML = data.map(r => `
      <tr>
        <td class="px-4 py-3">${r.name ?? "-"}</td>
        <td class="px-4 py-3">${r.nik ?? "-"}</td>
        <td class="px-4 py-3">${r.position ?? "-"}</td>
        <td class="px-4 py-3">${r.email ?? "-"}</td>
      </tr>
    `).join("");
  } catch (err) {
    console.error("loadEmployees error:", err);
    tbody.innerHTML = `<tr><td colspan="4" class="text-red-600">Gagal memuat pegawai</td></tr>`;
  }
}

/** Daftar lokasi (offices) */
async function loadLocations(){
  const box = qs("locationsList");
  if (!box) return;
  box.textContent = "Memuat…";
  try {
    // app utama pakai offices + field name, address, latitude, longitude, radius_meters
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

async function initAdminPage(){
  // Tampilkan pesan kalau client gagal terbuat
  if (!window.supabaseClient) {
    showGuard(window.__ADMIN_BOOT_ERROR__ || "Supabase client belum siap.");
    return;
  }

  const ok = await ensureAdmin();
  if (!ok) return;

  await loadStats();
  await loadEmployees();
  await loadLocations();

  // UI handlers
  const logoutBtn = qs("logoutBtn");
  if (logoutBtn){
    logoutBtn.addEventListener("click", async ()=>{
      try { await window.supabaseClient.auth.signOut(); } catch(e){}
      window.location.href = "index.html";
    });
  }

  const search = qs("employeeSearch");
  if (search){
    let timer = null;
    search.addEventListener("input", ()=>{
      clearTimeout(timer);
      timer = setTimeout(()=> loadEmployees(search.value.trim()), 250);
    });
  }

  const refreshEmployees = qs("refreshEmployees");
  if (refreshEmployees){
    refreshEmployees.addEventListener("click", ()=> loadEmployees(search ? search.value.trim() : ""));
  }

  const refreshLocations = qs("refreshLocations");
  if (refreshLocations){
    refreshLocations.addEventListener("click", ()=> loadLocations());
  }
}

document.addEventListener("DOMContentLoaded", initAdminPage);
