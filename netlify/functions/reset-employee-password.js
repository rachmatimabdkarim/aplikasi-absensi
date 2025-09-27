// netlify/functions/reset-employee-password.js
const { createClient } = require('@supabase/supabase-js');

exports.handler = async (event) => {
  try {
    // Hanya izinkan POST
    if (event.httpMethod !== 'POST') {
      return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
    }

    // Ambil email target
    const { email } = JSON.parse(event.body || '{}');
    if (!email) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Email is required' }) };
    }

    // Ambil access token admin (dikirim dari client)
    const authHeader = event.headers.authorization || event.headers.Authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!token) {
      return { statusCode: 401, body: JSON.stringify({ error: 'Missing bearer token' }) };
    }

    const SUPABASE_URL  = process.env.SUPABASE_URL;
    const ANON_KEY      = process.env.SUPABASE_ANON_KEY;         // verifikasi role Admin
    const SERVICE_KEY   = process.env.SUPABASE_SERVICE_ROLE_KEY; // panggil auth.admin

    if (!SUPABASE_URL || !SERVICE_KEY || !ANON_KEY) {
      return { statusCode: 500, body: JSON.stringify({ error: 'Server misconfigured: missing env vars' }) };
    }

    // 1) Verifikasi: token milik user yang berperan Admin
    const anonClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } }
    });

    const { data: userRes, error: uErr } = await anonClient.auth.getUser();
    if (uErr || !userRes?.user) {
      return { statusCode: 401, body: JSON.stringify({ error: 'Invalid session token' }) };
    }
    const adminUserId = userRes.user.id;

    // Cek ke tabel employees bahwa user ini Admin
    const { data: me, error: meErr } = await anonClient
      .from('employees')
      .select('id, position, organization_id')
      .eq('user_id', adminUserId)
      .maybeSingle();

    if (meErr || !me || String(me.position).toLowerCase() !== 'admin') {
      return { statusCode: 403, body: JSON.stringify({ error: 'Forbidden: not an admin' }) };
    }

    // 2) Kirim email reset password ke target menggunakan Service Role
    const serviceClient = createClient(SUPABASE_URL, SERVICE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    const { error: linkErr } = await serviceClient.auth.admin.generateLink({
      type: 'recovery',
      email
    });

    if (linkErr) {
      return { statusCode: 400, body: JSON.stringify({ error: linkErr.message }) };
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ ok: true })
    };
  } catch (e) {
    console.error('reset-employee-password error:', e);
    return { statusCode: 500, body: JSON.stringify({ error: 'Internal server error' }) };
  }
};
