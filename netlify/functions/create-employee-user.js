// netlify/functions/create-employee-user.js
const { createClient } = require('@supabase/supabase-js');

exports.handler = async (event) => {
  try {
    if (event.httpMethod !== 'POST') {
      return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
    }

    const { email, tempPassword, employeePayload } = JSON.parse(event.body || '{}');
    if (!email) return { statusCode: 400, body: JSON.stringify({ error: 'Email is required' }) };

    // Ambil access token admin dari client
    const authHeader = event.headers.authorization || event.headers.Authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!token) return { statusCode: 401, body: JSON.stringify({ error: 'Missing bearer token' }) };

    const SUPABASE_URL  = process.env.SUPABASE_URL;
    const ANON_KEY      = process.env.SUPABASE_ANON_KEY;
    const SERVICE_KEY   = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!SUPABASE_URL || !ANON_KEY || !SERVICE_KEY) {
      return { statusCode: 500, body: JSON.stringify({ error: 'Server misconfigured: missing env vars' }) };
    }

    // 1) Verifikasi pemanggil adalah Admin
    const anonClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } }
    });

    const { data: userRes, error: uErr } = await anonClient.auth.getUser();
    if (uErr || !userRes?.user) {
      return { statusCode: 401, body: JSON.stringify({ error: 'Invalid session token' }) };
    }
    const adminUserId = userRes.user.id;

    const { data: me, error: meErr } = await anonClient
      .from('employees')
      .select('id, position, organization_id')
      .eq('user_id', adminUserId)
      .maybeSingle();

    if (meErr || !me || String(me.position).toLowerCase() !== 'admin') {
      return { statusCode: 403, body: JSON.stringify({ error: 'Forbidden: not an admin' }) };
    }

    // 2) Password sementara
    const pwd = (tempPassword && String(tempPassword).trim().length >= 8)
      ? String(tempPassword).trim()
      : Math.random().toString(36).slice(-10) + 'A1'; // generate sederhana: 12+ chars

    // 3) Buat user via Service Role
    const serviceClient = createClient(SUPABASE_URL, SERVICE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    const { data: created, error: cErr } = await serviceClient.auth.admin.createUser({
      email,
      password: pwd,
      email_confirm: true, // TANPA verifikasi email
      user_metadata: {
        must_change_password: true,
        // taruh metadata tambahan jika mau:
        organization_id: employeePayload?.organization_id || null,
      }
    });

    if (cErr) return { statusCode: 400, body: JSON.stringify({ error: cErr.message }) };

    const authUserId = created.user?.id;

    // (Opsional) Kamu bisa langsung buat/insert row employees di sini juga,
    // tapi banyak tim lebih suka insert employees lewat front-end setelah tahu auth_user_id.

    return {
      statusCode: 200,
      body: JSON.stringify({ ok: true, auth_user_id: authUserId, temp_password: pwd })
    };
  } catch (e) {
    console.error('create-employee-user error:', e);
    return { statusCode: 500, body: JSON.stringify({ error: 'Internal server error' }) };
  }
};
