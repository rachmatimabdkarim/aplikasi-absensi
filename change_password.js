(async function(){
  const msg = document.getElementById('msg');
  function show(type, text){
    msg.className = 'mb-3 p-3 rounded-lg ' + (type==='ok' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200');
    msg.textContent = text;
    msg.classList.remove('hidden');
  }

  // Pastikan user login
  const { data: { user } } = await window.supabaseClient.auth.getUser();
  if (!user) { show('err','Sesi berakhir. Silakan login ulang.'); return; }

  // Jika user metadata tidak meminta perubahan, kamu bisa redirect ke halaman utama.
  // const mustChange = user?.user_metadata?.must_change_password === true;
  // if (!mustChange) window.location.href = 'index.html';

  document.getElementById('pwForm').addEventListener('submit', async (e)=>{
    e.preventDefault();
    const pw1 = document.getElementById('newPw').value.trim();
    const pw2 = document.getElementById('newPw2').value.trim();

    if (pw1.length < 8) return show('err','Password minimal 8 karakter.');
    if (pw1 !== pw2)  return show('err','Konfirmasi password tidak cocok.');

    // Update password di Supabase (butuh sesi aktif)
    const { error } = await window.supabaseClient.auth.updateUser({ password: pw1 });
    if (error) return show('err', error.message || 'Gagal memperbarui password.');

    // Bersihkan flag must_change_password di metadata
    const { data: u2, error: e2 } = await window.supabaseClient.auth.updateUser({
      data: { must_change_password: false }
    });
    if (e2) console.warn('Gagal unset metadata:', e2?.message);

    show('ok', 'Password berhasil diperbarui. Mengalihkan ke halaman utama...');
    setTimeout(()=> location.href='index.html', 1200);
  });
})();
