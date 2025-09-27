// =============================================
// KONFIGURASI SUPABASE - GANTI DENGAN DATA ANDA
// =============================================
const SUPABASE_URL = 'https://rwascvkexdjirtvggaiu.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ3YXNjdmtleGRqaXJ0dmdnYWl1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg5MjQzMjksImV4cCI6MjA3NDUwMDMyOX0.NkSE29IW1CO9o7z-mN0KxOwY9WHSedsDhH-TkAWtTjo';

// Inisialisasi Supabase client
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// =============================================
// VARIABEL GLOBAL
// =============================================
let currentUser = null;
let userProfile = null;
let userLocation = null;
let todayAttendance = null;
let officeLocations = [];
let nearestOffice = null;
let map = null;
let userMarker = null;
let officeMarkers = [];
let allEmployees = [];
let filteredEmployees = [];
let hasAdmin = false;

// =============================================
// INISIALISASI APLIKASI
// =============================================
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 Aplikasi Absensi PPNPN dimulai...');
    initializeApp();
    setupEventListeners();
    updateDateTime();
    setInterval(updateDateTime, 1000);
});

async function initializeApp() {
    try {
        showLoadingOverlay(true);
        
        // Cek apakah sudah ada admin terdaftar
        await checkAdminExists();
        
        // Cek session yang aktif
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (session && session.user) {
            console.log('✅ User sudah login dari session');
            currentUser = session.user;
            await loadUserProfile();
            showMainApp();
        } else {
            console.log('ℹ️ User belum login, tampilkan halaman login');
            showLoginScreen();
        }
    } catch (error) {
        console.error('❌ Error saat inisialisasi:', error);
        showLoginScreen();
    } finally {
        showLoadingOverlay(false);
    }
}

// Fungsi untuk mengecek apakah sudah ada admin
async function checkAdminExists() {
    try {
        const { data, error } = await supabase
            .from('employees')
            .select('id')
            .eq('position', 'Admin')
            .limit(1);
        
        if (!error && data && data.length > 0) {
            hasAdmin = true;
            // Sembunyikan tombol register jika sudah ada admin
            const registerBtn = document.getElementById('showRegisterBtn');
            if (registerBtn) {
                registerBtn.style.display = 'none';
            }
        } else {
            hasAdmin = false;
        }
        console.log('✅ Admin check completed. Has admin:', hasAdmin);
    } catch (error) {
        console.error('❌ Error checking admin:', error);
        hasAdmin = false;
    }
}

function setupEventListeners() {
    // Login form
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    }
    
    // Logout button
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', handleLogout);
    }
    
    // Attendance buttons
    const checkInBtn = document.getElementById('checkInBtn');
    if (checkInBtn) {
        checkInBtn.addEventListener('click', handleCheckIn);
    }
    
    const checkOutBtn = document.getElementById('checkOutBtn');
    if (checkOutBtn) {
        checkOutBtn.addEventListener('click', handleCheckOut);
    }
    
    // Location refresh
    const refreshLocationBtn = document.getElementById('refreshLocationBtn');
    if (refreshLocationBtn) {
        refreshLocationBtn.addEventListener('click', getUserLocation);
    }
    
    // History refresh
    const refreshHistoryBtn = document.getElementById('refreshHistoryBtn');
    if (refreshHistoryBtn) {
        refreshHistoryBtn.addEventListener('click', loadRecentActivity);
    }
    
    // Modal close
    const closeModalBtn = document.getElementById('closeModal');
    if (closeModalBtn) {
        closeModalBtn.addEventListener('click', closeModal);
    }
    
    // Admin panel navigation
    const adminPanelBtn = document.getElementById('adminPanelBtn');
    if (adminPanelBtn) {
        adminPanelBtn.addEventListener('click', showAdminPanel);
    }
    
    const backToMainBtn = document.getElementById('backToMainBtn');
    if (backToMainBtn) {
        backToMainBtn.addEventListener('click', showMainApp);
    }
    
    // Search and filter
    const searchEmployee = document.getElementById('searchEmployee');
    if (searchEmployee) {
        searchEmployee.addEventListener('input', filterEmployees);
    }
    
    const filterPosition = document.getElementById('filterPosition');
    if (filterPosition) {
        filterPosition.addEventListener('change', filterEmployees);
    }
    
    // Register functionality
    setupRegisterListeners();
}

// =============================================
// FUNGSI REGISTRASI ADMIN - PERBAIKAN UTAMA
// =============================================
function setupRegisterListeners() {
    console.log('🔧 Setting up register listeners...');
    
    // Tombol show register modal
    const showRegisterBtn = document.getElementById('showRegisterBtn');
    if (showRegisterBtn) {
        console.log('✅ Register button found, adding event listener');
        showRegisterBtn.addEventListener('click', showRegisterModal);
    } else {
        console.log('❌ Register button not found');
    }
    
    // Tombol close register modal
    const closeRegisterModalBtn = document.getElementById('closeRegisterModal');
    if (closeRegisterModalBtn) {
        closeRegisterModalBtn.addEventListener('click', closeRegisterModal);
    }
    
    const cancelRegisterBtn = document.getElementById('cancelRegisterBtn');
    if (cancelRegisterBtn) {
        cancelRegisterBtn.addEventListener('click', closeRegisterModal);
    }
    
    // Form submit
    const registerForm = document.getElementById('registerForm');
    if (registerForm) {
        registerForm.addEventListener('submit', handleRegister);
    }
    
    // Real-time validation
    const registerPassword = document.getElementById('registerPassword');
    if (registerPassword) {
        registerPassword.addEventListener('input', validatePasswordStrength);
    }
    
    const registerConfirmPassword = document.getElementById('registerConfirmPassword');
    if (registerConfirmPassword) {
        registerConfirmPassword.addEventListener('input', validatePasswordMatch);
    }
    
    const registerNik = document.getElementById('registerNik');
    if (registerNik) {
        registerNik.addEventListener('input', formatEmailFromNIK);
    }
    
    console.log('✅ Register listeners setup completed');
}

function showRegisterModal() {
    console.log('🎯 Show register modal called');
    
    // Jika sudah ada admin, jangan tampilkan modal
    if (hasAdmin) {
        console.log('❌ Admin already exists, blocking registration');
        showErrorModal('Akses Ditolak', 'Fitur registrasi sudah dinonaktifkan karena sudah ada admin terdaftar.');
        return;
    }
    
    const registerModal = document.getElementById('registerModal');
    if (registerModal) {
        console.log('✅ Register modal element found');
        
        // PERBAIKAN UTAMA: Hapus hidden class dan set display flex
        registerModal.classList.remove('hidden');
        registerModal.style.display = 'flex';
        
        console.log('✅ Register modal shown with display:', registerModal.style.display);
    } else {
        console.log('❌ Register modal element not found');
        return;
    }
    
    // Reset form
    const registerForm = document.getElementById('registerForm');
    if (registerForm) {
        registerForm.reset();
    }
    
    const registerError = document.getElementById('registerError');
    if (registerError) {
        registerError.classList.add('hidden');
    }
    
    const registerSuccess = document.getElementById('registerSuccess');
    if (registerSuccess) {
        registerSuccess.classList.add('hidden');
    }
    
    // Reset password strength indicator
    const strengthContainer = document.querySelector('.password-strength');
    if (strengthContainer) {
        strengthContainer.classList.add('hidden');
    }
}

function closeRegisterModal() {
    const registerModal = document.getElementById('registerModal');
    if (registerModal) {
        registerModal.classList.add('hidden');
        registerModal.style.display = 'none';
        console.log('✅ Register modal closed');
    }
}

function formatEmailFromNIK() {
    const nik = document.getElementById('registerNik').value;
    const emailField = document.getElementById('registerEmail');
    
    if (nik.length === 16) {
        emailField.value = `${nik}@ppnpn-malut.go.id`;
    }
}

function validatePasswordStrength() {
    const password = document.getElementById('registerPassword').value;
    const strengthBar = document.querySelector('.password-strength-bar');
    const strengthText = document.querySelector('.password-strength-text');
    const strengthContainer = document.querySelector('.password-strength');
    
    if (password.length === 0) {
        strengthContainer.classList.add('hidden');
        return;
    }
    
    strengthContainer.classList.remove('hidden');
    
    let strength = 0;
    if (password.length >= 6) strength += 25;
    if (/[A-Z]/.test(password)) strength += 25;
    if (/[0-9]/.test(password)) strength += 25;
    if (/[^A-Za-z0-9]/.test(password)) strength += 25;
    
    if (strengthBar) strengthBar.style.width = `${strength}%`;
    
    if (strengthText) {
        if (strength < 50) {
            strengthBar.className = 'h-1 bg-red-500 rounded-full password-strength-bar';
            strengthText.textContent = 'Lemah';
            strengthText.className = 'text-xs text-red-500 password-strength-text';
        } else if (strength < 75) {
            strengthBar.className = 'h-1 bg-yellow-500 rounded-full password-strength-bar';
            strengthText.textContent = 'Cukup';
            strengthText.className = 'text-xs text-yellow-500 password-strength-text';
        } else {
            strengthBar.className = 'h-1 bg-green-500 rounded-full password-strength-bar';
            strengthText.textContent = 'Kuat';
            strengthText.className = 'text-xs text-green-500 password-strength-text';
        }
    }
}

function validatePasswordMatch() {
    const password = document.getElementById('registerPassword').value;
    const confirmPassword = document.getElementById('registerConfirmPassword').value;
    const errorElement = document.getElementById('passwordMatchError');
    
    if (confirmPassword.length > 0 && password !== confirmPassword) {
        errorElement.classList.remove('hidden');
        return false;
    } else {
        errorElement.classList.add('hidden');
        return true;
    }
}

async function handleRegister(e) {
    e.preventDefault();
    
    const registerBtn = document.getElementById('registerBtn');
    const registerBtnText = document.getElementById('registerBtnText');
    const registerSpinner = document.getElementById('registerSpinner');
    const errorDiv = document.getElementById('registerError');
    const successDiv = document.getElementById('registerSuccess');
    
    // Get form data
    const nik = document.getElementById('registerNik').value.trim();
    const name = document.getElementById('registerName').value.trim();
    const position = document.getElementById('registerPosition').value;
    const unitKerja = document.getElementById('registerUnit').value.trim();
    const phone = document.getElementById('registerPhone').value.trim();
    const email = document.getElementById('registerEmail').value.trim();
    const password = document.getElementById('registerPassword').value;
    const confirmPassword = document.getElementById('registerConfirmPassword').value;
    
    // Validation
    if (!nik || !name || !position || !email || !password || !confirmPassword) {
        showRegisterError('Semua field bertanda * harus diisi!');
        return;
    }
    
    if (!/^\d{16}$/.test(nik)) {
        showRegisterError('NIK harus terdiri dari 16 digit angka!');
        return;
    }
    
    if (password.length < 6) {
        showRegisterError('Password harus minimal 6 karakter!');
        return;
    }
    
    if (!validatePasswordMatch()) {
        showRegisterError('Password dan konfirmasi password tidak cocok!');
        return;
    }
    
    // Show loading state
    registerBtn.disabled = true;
    registerBtnText.textContent = 'Mendaftarkan...';
    registerSpinner.classList.remove('hidden');
    errorDiv.classList.add('hidden');
    successDiv.classList.add('hidden');
    
    try {
        console.log('🚀 Memulai proses registrasi admin...');
        
        // Step 1: Sign up user dengan Supabase Auth
        const { data: authData, error: authError } = await supabase.auth.signUp({
            email: email,
            password: password,
            options: {
                data: {
                    nik: nik,
                    name: name,
                    role: 'admin'
                }
            }
        });
        
        if (authError) {
            console.error('❌ Auth error:', authError);
            
            // Handle specific errors
            if (authError.message.includes('User already registered')) {
                throw new Error('Email/NIK sudah terdaftar!');
            } else if (authError.message.includes('Password')) {
                throw new Error('Password terlalu lemah! Gunakan kombinasi huruf dan angka.');
            } else {
                throw new Error(`Error auth: ${authError.message}`);
            }
        }
        
        if (!authData.user) {
            throw new Error('Gagal membuat user. Silakan coba lagi.');
        }
        
        console.log('✅ User auth created:', authData.user.id);
        
        // Step 2: Get organization ID (create if not exists)
        let organizationId;
        const { data: orgData, error: orgError } = await supabase
            .from('organizations')
            .select('id')
            .limit(1);
        
        if (orgError || !orgData || orgData.length === 0) {
            // Create organization if not exists
            const { data: newOrg, error: newOrgError } = await supabase
                .from('organizations')
                .insert([{
                    name: 'Kantor Guru dan Tenaga Kependidikan Provinsi Maluku Utara',
                    address: 'Jl. Raya Sofifi, Maluku Utara',
                    phone: '(0921) 123456',
                    email: 'gtk.malut@kemdikbud.go.id'
                }])
                .select();
            
            if (newOrgError) throw new Error(`Gagal membuat organization: ${newOrgError.message}`);
            organizationId = newOrg[0].id;
        } else {
            organizationId = orgData[0].id;
        }
        
        // Step 3: Create employee record
        const { error: employeeError } = await supabase
            .from('employees')
            .insert([{
                organization_id: organizationId,
                user_id: authData.user.id,
                nik: nik,
                name: name,
                position: position,
                unit_kerja: unitKerja || 'Kantor GTK Provinsi Maluku Utara',
                phone: phone || null,
                email: email,
                is_active: true
            }]);
        
        if (employeeError) {
            console.error('❌ Employee creation error:', employeeError);
            
            // Rollback: Delete auth user if employee creation fails
            await supabase.auth.admin.deleteUser(authData.user.id);
            
            if (employeeError.message.includes('duplicate key')) {
                throw new Error('NIK atau email sudah terdaftar di sistem!');
            } else {
                throw new Error(`Gagal membuat data pegawai: ${employeeError.message}`);
            }
        }
        
        console.log('✅ Employee record created');
        
        // Step 4: Create default office if not exists
        const { data: officeData, error: officeError } = await supabase
            .from('offices')
            .select('id')
            .limit(1);
        
        if (officeError || !officeData || officeData.length === 0) {
            await supabase
                .from('offices')
                .insert([{
                    organization_id: organizationId,
                    name: 'Kantor GTK Provinsi Maluku Utara - Sofifi',
                    address: 'Jl. Raya Sofifi, Kota Sofifi, Maluku Utara',
                    latitude: 1.2379,
                    longitude: 127.5669,
                    radius_meters: 500,
                    is_active: true
                }]);
        }
        
        // Update flag bahwa sudah ada admin
        hasAdmin = true;
        
        // Sembunyikan tombol register
        document.getElementById('showRegisterBtn').style.display = 'none';
        
        // Success
        showRegisterSuccess(
            '✅ Pendaftaran Berhasil!', 
            `Akun admin <strong>${name}</strong> berhasil dibuat. Anda sekarang bisa login dengan NIK <strong>${nik}</strong> dan password yang telah dibuat.`
        );
        
        // Auto-close modal after 5 seconds
        setTimeout(() => {
            closeRegisterModal();
        }, 5000);
        
    } catch (error) {
        console.error('❌ Registration error:', error);
        showRegisterError(error.message || 'Terjadi kesalahan saat mendaftar. Silakan coba lagi.');
    } finally {
        registerBtn.disabled = false;
        registerBtnText.textContent = 'Daftar Admin';
        registerSpinner.classList.add('hidden');
    }
}

function showRegisterError(message) {
    const errorDiv = document.getElementById('registerError');
    const errorMessage = document.getElementById('registerErrorMessage');
    const successDiv = document.getElementById('registerSuccess');
    
    if (errorMessage) errorMessage.innerHTML = message;
    if (errorDiv) errorDiv.classList.remove('hidden');
    if (successDiv) successDiv.classList.add('hidden');
    
    // Auto-hide after 10 seconds
    setTimeout(() => {
        if (errorDiv) errorDiv.classList.add('hidden');
    }, 10000);
}

function showRegisterSuccess(title, message) {
    const successDiv = document.getElementById('registerSuccess');
    const successMessage = document.getElementById('registerSuccessMessage');
    const errorDiv = document.getElementById('registerError');
    
    if (successMessage) successMessage.innerHTML = `<strong>${title}</strong><br>${message}`;
    if (successDiv) successDiv.classList.remove('hidden');
    if (errorDiv) errorDiv.classList.add('hidden');
}

// =============================================
// FUNGSI AUTHENTIKASI (TIDAK BERUBAH)
// =============================================
async function handleLogin(e) {
    e.preventDefault();
    
    const nik = document.getElementById('nikInput').value.trim();
    const password = document.getElementById('passwordInput').value;
    const loginBtn = document.getElementById('loginBtn');
    const loginBtnText = document.getElementById('loginBtnText');
    const loginSpinner = document.getElementById('loginSpinner');
    const errorDiv = document.getElementById('loginError');
    
    // Validasi
    if (!nik || !password) {
        showError(errorDiv, 'NIK dan password harus diisi!');
        return;
    }
    
    // Show loading state
    loginBtn.disabled = true;
    loginBtnText.textContent = 'Masuk...';
    loginSpinner.classList.remove('hidden');
    errorDiv.classList.add('hidden');
    
    try {
        console.log('🔐 Mencoba login dengan NIK:', nik);
        
        // Login dengan Supabase Auth
        const { data, error } = await supabase.auth.signInWithPassword({
            email: `${nik}@ppnpn-malut.go.id`,
            password: password
        });
        
        if (error) throw error;
        
        console.log('✅ Login berhasil:', data.user.email);
        currentUser = data.user;
        
        await loadUserProfile();
        showMainApp();
        
        // Clear form
        document.getElementById('nikInput').value = '';
        document.getElementById('passwordInput').value = '';
        
    } catch (error) {
        console.error('❌ Login error:', error);
        showError(errorDiv, 'NIK atau password salah! Periksa kembali data Anda.');
    } finally {
        loginBtn.disabled = false;
        loginBtnText.textContent = 'Masuk';
        loginSpinner.classList.add('hidden');
    }
}

async function handleLogout() {
    try {
        console.log('🚪 Logout...');
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
        
        currentUser = null;
        userProfile = null;
        userLocation = null;
        todayAttendance = null;
        showLoginScreen();
        console.log('✅ Logout berhasil');
    } catch (error) {
        console.error('❌ Logout error:', error);
    }
}

// =============================================
// FUNGSI PROFIL USER (TIDAK BERUBAH)
// =============================================
async function loadUserProfile() {
    try {
        console.log('👤 Loading user profile...');
        
        // Ambil data profil dari tabel employees
        const { data, error } = await supabase
            .from('employees')
            .select('*')
            .eq('user_id', currentUser.id)
            .single();
        
        if (error) throw error;
        
        userProfile = data;
        console.log('✅ Profile loaded:', userProfile.name);
        
        updateUserInterface();
        await Promise.all([
            loadTodayAttendance(),
            loadAttendanceStats(),
            loadRecentActivity(),
            loadOfficeLocationsForUser()
        ]);
        
        // Get location setelah semua data dimuat
        setTimeout(getUserLocation, 1000);
        
    } catch (error) {
        console.error('❌ Error loading user profile:', error);
        showError(document.getElementById('loginError'), 'Gagal memuat profil pengguna. Silakan login ulang.');
        handleLogout();
    }
}

function updateUserInterface() {
    if (!userProfile) return;
    
    const initials = userProfile.name.split(' ')
        .map(n => n[0])
        .join('')
        .substring(0, 2)
        .toUpperCase();
    
    document.getElementById('userInitials').textContent = initials;
    document.getElementById('userName').textContent = userProfile.name;
    document.getElementById('userPosition').textContent = userProfile.position;
    document.getElementById('userNik').textContent = `NIK: ${userProfile.nik}`;
    document.getElementById('userPhone').textContent = userProfile.phone ? `📱 ${userProfile.phone}` : '';
    document.getElementById('userUnit').textContent = userProfile.unit_kerja || '';
    
    // Tampilkan tombol admin panel jika user adalah admin
    if (userProfile.position === 'Admin') {
        document.getElementById('adminPanelBtn').classList.remove('hidden');
    }
}

// =============================================
// FUNGSI ABSENSI (TIDAK BERUBAH)
// =============================================
async function loadTodayAttendance() {
    try {
        const today = new Date().toISOString().split('T')[0];
        console.log('📅 Loading attendance for:', today);
        
        const { data, error } = await supabase
            .from('attendance')
            .select('*')
            .eq('employee_id', userProfile.id)
            .eq('date', today)
            .single();
        
        if (error && error.code !== 'PGRST116') throw error; // PGRST116 = no rows returned
        
        todayAttendance = data || null;
        updateAttendanceStatus();
        console.log('✅ Today attendance loaded:', todayAttendance ? 'Found' : 'Not found');
        
    } catch (error) {
        console.error('❌ Error loading today attendance:', error);
    }
}

function updateAttendanceStatus() {
    const checkInBtn = document.getElementById('checkInBtn');
    const checkOutBtn = document.getElementById('checkOutBtn');
    
    if (todayAttendance) {
        if (todayAttendance.check_in_time) {
            const checkInTime = new Date(todayAttendance.check_in_time);
            const timeString = checkInTime.toLocaleTimeString('id-ID', {
                hour: '2-digit',
                minute: '2-digit'
            });
            
            document.getElementById('checkInTime').textContent = timeString;
            document.getElementById('checkInLocation').textContent = todayAttendance.check_in_location || '';
            
            checkInBtn.disabled = true;
            checkInBtn.innerHTML = `
                <div class="flex items-center justify-center space-x-3">
                    <span class="text-3xl">✅</span>
                    <div class="text-left">
                        <div class="text-lg">Sudah Absen Masuk</div>
                        <div class="text-sm opacity-90">Pukul ${timeString}</div>
                    </div>
                </div>
            `;
            checkOutBtn.disabled = false;
        }
        
        if (todayAttendance.check_out_time) {
            const checkOutTime = new Date(todayAttendance.check_out_time);
            const timeString = checkOutTime.toLocaleTimeString('id-ID', {
                hour: '2-digit',
                minute: '2-digit'
            });
            
            document.getElementById('checkOutTime').textContent = timeString;
            document.getElementById('checkOutLocation').textContent = todayAttendance.check_out_location || '';
            
            checkOutBtn.disabled = true;
            checkOutBtn.innerHTML = `
                <div class="flex items-center justify-center space-x-3">
                    <span class="text-3xl">✅</span>
                    <div class="text-left">
                        <div class="text-lg">Sudah Absen Pulang</div>
                        <div class="text-sm opacity-90">Pukul ${timeString}</div>
                    </div>
                </div>
            `;
        }
        
        // Update work hours
        if (todayAttendance.work_hours) {
            const hours = Math.floor(todayAttendance.work_hours);
            const minutes = Math.round((todayAttendance.work_hours - hours) * 60);
            document.getElementById('workHours').textContent = `${hours} jam ${minutes} menit`;
        }
    }
}

async function handleCheckIn() {
    if (!userLocation) {
        showErrorModal('Lokasi Tidak Terdeteksi', 'Harap aktifkan GPS dan refresh lokasi sebelum absen.');
        return;
    }
    
    if (!isWithinOfficeArea()) {
        showErrorModal('Lokasi Diluar Area Kantor', 'Anda harus berada dalam radius kantor untuk melakukan absensi.');
        return;
    }
    
    try {
        showLoadingOverlay(true);
        console.log('⏰ Processing check-in...');
        
        const now = new Date();
        const today = now.toISOString().split('T')[0];
        const locationString = `${userLocation.lat.toFixed(6)}, ${userLocation.lng.toFixed(6)}`;
        
        // Cek apakah sudah ada absensi hari ini
        if (todayAttendance) {
            // Update existing record
            const { data, error } = await supabase
                .from('attendance')
                .update({
                    check_in_time: now.toISOString(),
                    check_in_location: locationString,
                    check_in_latitude: userLocation.lat,
                    check_in_longitude: userLocation.lng,
                    status: 'present'
                })
                .eq('id', todayAttendance.id)
                .select();
            
            if (error) throw error;
            todayAttendance = data[0];
        } else {
            // Create new record
            const { data, error } = await supabase
                .from('attendance')
                .insert([{
                    employee_id: userProfile.id,
                    date: today,
                    check_in_time: now.toISOString(),
                    check_in_location: locationString,
                    check_in_latitude: userLocation.lat,
                    check_in_longitude: userLocation.lng,
                    status: 'present'
                }])
                .select();
            
            if (error) throw error;
            todayAttendance = data[0];
        }
        
        console.log('✅ Check-in successful');
        
        await loadTodayAttendance();
        await loadAttendanceStats();
        await loadRecentActivity();
        
        const timeString = now.toLocaleTimeString('id-ID', { 
            hour: '2-digit', 
            minute: '2-digit' 
        });
        
        const isLate = now.getHours() > 8 || (now.getHours() === 8 && now.getMinutes() > 0);
        const status = isLate ? 'Terlambat' : 'Tepat Waktu';
        const icon = isLate ? '⚠️' : '✅';
        
        showSuccessModal(
            `${icon} Absensi Masuk ${status}!`, 
            `Absensi masuk tercatat pada pukul ${timeString}. ${isLate ? 'Harap datang tepat waktu.' : 'Selamat bekerja!'}`
        );
        
    } catch (error) {
        console.error('❌ Check-in error:', error);
        showErrorModal('Gagal Absen Masuk', 'Terjadi kesalahan saat mencatat absensi masuk. Silakan coba lagi.');
    } finally {
        showLoadingOverlay(false);
    }
}

async function handleCheckOut() {
    if (!todayAttendance || !todayAttendance.check_in_time) {
        showErrorModal('Belum Absen Masuk', 'Anda harus melakukan absensi masuk terlebih dahulu sebelum absen pulang.');
        return;
    }
    
    if (!userLocation) {
        showErrorModal('Lokasi Tidak Terdeteksi', 'Harap aktifkan GPS dan refresh lokasi sebelum absen.');
        return;
    }
    
    if (!isWithinOfficeArea()) {
        showErrorModal('Lokasi Diluar Area Kantor', 'Anda harus berada dalam radius kantor untuk melakukan absensi.');
        return;
    }
    
    try {
        showLoadingOverlay(true);
        console.log('🏃‍♂️ Processing check-out...');
        
        const now = new Date();
        const locationString = `${userLocation.lat.toFixed(6)}, ${userLocation.lng.toFixed(6)}`;
        
        // Calculate work hours
        const checkInTime = new Date(todayAttendance.check_in_time);
        const workHours = (now - checkInTime) / (1000 * 60 * 60); // hours
        
        // Update attendance record
        const { data, error } = await supabase
            .from('attendance')
            .update({
                check_out_time: now.toISOString(),
                check_out_location: locationString,
                check_out_latitude: userLocation.lat,
                check_out_longitude: userLocation.lng,
                work_hours: workHours
            })
            .eq('id', todayAttendance.id)
            .select();
        
        if (error) throw error;
        todayAttendance = data[0];
        
        console.log('✅ Check-out successful');
        
        await loadTodayAttendance();
        await loadRecentActivity();
        
        const timeString = now.toLocaleTimeString('id-ID', { 
            hour: '2-digit', 
            minute: '2-digit' 
        });
        
        showSuccessModal(
            '🏃‍♂️ Absensi Pulang Berhasil!', 
            `Absensi pulang tercatat pada pukul ${timeString}. Terima kasih atas kerja keras Anda hari ini!`
        );
        
    } catch (error) {
        console.error('❌ Check-out error:', error);
        showErrorModal('Gagal Absen Pulang', 'Terjadi kesalahan saat mencatat absensi pulang. Silakan coba lagi.');
    } finally {
        showLoadingOverlay(false);
    }
}

// =============================================
// FUNGSI LOKASI DAN PETA (TIDAK BERUBAH)
// =============================================
function getUserLocation() {
    console.log('📍 Getting user location...');
    
    const statusEl = document.getElementById('locationStatus');
    const currentLocationEl = document.getElementById('currentLocation');
    const distanceEl = document.getElementById('distanceFromOffice');
    const refreshBtn = document.getElementById('refreshLocationBtn');
    const spinner = refreshBtn.querySelector('.loading-spinner');
    
    // Set loading state
    statusEl.textContent = 'Mendeteksi lokasi...';
    statusEl.className = 'text-sm text-gray-600';
    currentLocationEl.textContent = 'Mendeteksi...';
    distanceEl.textContent = 'Menghitung...';
    distanceEl.className = 'font-semibold text-gray-600';
    
    if (spinner) {
        spinner.classList.remove('hidden');
    }

    if (!navigator.geolocation) {
        handleLocationError({ code: 0, message: 'Browser tidak mendukung geolokasi' });
        return;
    }

    navigator.geolocation.getCurrentPosition(
        position => {
            userLocation = {
                lat: position.coords.latitude,
                lng: position.coords.longitude,
                accuracy: position.coords.accuracy
            };
            
            console.log('📍 Location detected:', userLocation);
            updateLocationInfo();
            initMap();
            
            if (spinner) {
                spinner.classList.add('hidden');
            }
        },
        error => {
            handleLocationError(error);
        },
        {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 60000
        }
    );
}

function handleLocationError(error) {
    console.error('❌ Location error:', error);
    
    let errorMessage = 'Gagal mendeteksi lokasi';
    
    if (error && error.code) {
        switch(error.code) {
            case 1: // PERMISSION_DENIED
                errorMessage = 'Akses lokasi ditolak';
                break;
            case 2: // POSITION_UNAVAILABLE
                errorMessage = 'Lokasi tidak tersedia';
                break;
            case 3: // TIMEOUT
                errorMessage = 'Timeout mendeteksi lokasi';
                break;
            default:
                errorMessage = 'Error lokasi tidak dikenal';
        }
    }
    
    const statusEl = document.getElementById('locationStatus');
    const currentLocationEl = document.getElementById('currentLocation');
    const distanceEl = document.getElementById('distanceFromOffice');
    const refreshBtn = document.getElementById('refreshLocationBtn');
    const spinner = refreshBtn ? refreshBtn.querySelector('.loading-spinner') : null;
    
    if (statusEl) {
        statusEl.textContent = errorMessage;
        statusEl.className = 'text-sm text-red-600';
    }
    
    if (currentLocationEl) {
        currentLocationEl.textContent = 'Tidak dapat mendeteksi';
    }
    
    if (distanceEl) {
        distanceEl.textContent = 'Tidak dapat menghitung';
        distanceEl.className = 'font-semibold text-red-600';
    }
    
    if (spinner) {
        spinner.classList.add('hidden');
    }
}

async function loadOfficeLocationsForUser() {
    try {
        console.log('🏢 Loading office locations for user...');
        
        const { data, error } = await supabase
            .from('offices')
            .select('*')
            .eq('is_active', true);
        
        if (error) throw error;
        
        officeLocations = data || [];
        console.log('✅ Active office locations loaded:', officeLocations.length, 'offices');
        
    } catch (error) {
        console.error('❌ Error loading office locations:', error);
        officeLocations = [];
    }
}

function updateLocationInfo() {
    if (!userLocation || officeLocations.length === 0) return;
    
    // Find nearest office
    let minDistance = Infinity;
    nearestOffice = null;
    
    officeLocations.forEach(office => {
        const distance = calculateDistance(
            userLocation.lat, userLocation.lng,
            office.latitude, office.longitude
        );
        
        if (distance < minDistance) {
            minDistance = distance;
            nearestOffice = office;
        }
    });
    
    if (!nearestOffice) return;
    
    const distance = minDistance;
    
    // Update UI
    document.getElementById('currentLocation').textContent = 
        `${userLocation.lat.toFixed(6)}, ${userLocation.lng.toFixed(6)}`;
    
    const distanceText = distance < 1000 ? 
        `${Math.round(distance)} meter` : 
        `${(distance / 1000).toFixed(1)} km`;
    document.getElementById('distanceFromOffice').textContent = distanceText;
    
    document.getElementById('nearestOffice').textContent = nearestOffice.name;
    document.getElementById('officeAddress').textContent = nearestOffice.address;
    
    const locationStatusEl = document.getElementById('locationStatus');
    const distanceEl = document.getElementById('distanceFromOffice');
    
    if (distance <= nearestOffice.radius_meters) {
        locationStatusEl.innerHTML = '✅ Di dalam area kantor';
        locationStatusEl.className = 'text-sm text-green-600 font-medium';
        distanceEl.className = 'font-semibold text-green-600';
    } else {
        locationStatusEl.innerHTML = '❌ Di luar area kantor';
        locationStatusEl.className = 'text-sm text-red-600 font-medium';
        distanceEl.className = 'font-semibold text-red-600';
    }
    
    console.log('✅ Location info updated. Distance:', distanceText);
}

function isWithinOfficeArea() {
    if (!userLocation || officeLocations.length === 0) return false;
    
    return officeLocations.some(office => {
        const distance = calculateDistance(
            userLocation.lat, userLocation.lng,
            office.latitude, office.longitude
        );
        return distance <= office.radius_meters;
    });
}

function calculateDistance(lat1, lng1, lat2, lng2) {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = lat1 * Math.PI/180;
    const φ2 = lat2 * Math.PI/180;
    const Δφ = (lat2-lat1) * Math.PI/180;
    const Δλ = (lng2-lng1) * Math.PI/180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return R * c;
}

// =============================================
// FUNGSI PETA (TIDAK BERUBAH)
// =============================================
function initMap() {
    if (!userLocation) return;
    
    const mapContainer = document.getElementById('mapContainer');
    mapContainer.innerHTML = '<p class="text-gray-500">Memuat peta...</p>';
    
    // Load Leaflet CSS and JS dynamically
    if (!window.L) {
        const leafletCSS = document.createElement('link');
        leafletCSS.rel = 'stylesheet';
        leafletCSS.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
        document.head.appendChild(leafletCSS);
        
        const leafletJS = document.createElement('script');
        leafletJS.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
        leafletJS.onload = createMap;
        document.head.appendChild(leafletJS);
    } else {
        createMap();
    }
}

function createMap() {
    const mapContainer = document.getElementById('mapContainer');
    mapContainer.innerHTML = '';
    
    // Create map
    map = L.map('mapContainer').setView([userLocation.lat, userLocation.lng], 16);
    
    // Add tile layer
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
    }).addTo(map);
    
    // Add user marker
    userMarker = L.marker([userLocation.lat, userLocation.lng])
        .addTo(map)
        .bindPopup('Lokasi Anda Saat Ini')
        .openPopup();
    
    // Add office markers
    officeMarkers = [];
    officeLocations.forEach(office => {
        const marker = L.marker([office.latitude, office.longitude])
            .addTo(map)
            .bindPopup(`<b>${office.name}</b><br>${office.address}`);
        
        // Add circle for radius
        L.circle([office.latitude, office.longitude], {
            color: 'blue',
            fillColor: '#30b1ff',
            fillOpacity: 0.2,
            radius: office.radius_meters
        }).addTo(map);
        
        officeMarkers.push(marker);
    });
    
    // Fit map to show all markers
    const group = new L.featureGroup([userMarker, ...officeMarkers]);
    map.fitBounds(group.getBounds().pad(0.1));
}

// =============================================
// FUNGSI STATISTIK DAN RIWAYAT (TIDAK BERUBAH)
// =============================================
async function loadAttendanceStats() {
    try {
        console.log('📊 Loading attendance statistics...');
        
        // Get last 30 days attendance
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        
        const { data, error } = await supabase
            .from('attendance')
            .select('*')
            .eq('employee_id', userProfile.id)
            .gte('date', thirtyDaysAgo.toISOString().split('T')[0]);
        
        if (error) throw error;
        
        let presentDays = 0;
        let lateDays = 0;
        let totalHours = 0;
        
        data.forEach(record => {
            if (record.check_in_time) {
                presentDays++;
                const checkInTime = new Date(record.check_in_time);
                if (checkInTime.getHours() > 8 || (checkInTime.getHours() === 8 && checkInTime.getMinutes() > 0)) {
                    lateDays++;
                }
                if (record.work_hours) {
                    totalHours += parseFloat(record.work_hours);
                }
            }
        });
        
        // Calculate absent days (approximate weekdays in 30 days)
        const totalWeekdays = 22;
        const absentDays = Math.max(0, totalWeekdays - presentDays);
        
        document.getElementById('presentDays').textContent = presentDays;
        document.getElementById('absentDays').textContent = absentDays;
        document.getElementById('lateDays').textContent = lateDays;
        document.getElementById('totalHours').textContent = Math.round(totalHours);
        
        console.log('✅ Statistics loaded:', { presentDays, absentDays, lateDays, totalHours });
        
    } catch (error) {
        console.error('❌ Error loading attendance stats:', error);
    }
}

async function loadRecentActivity() {
    try {
        console.log('📋 Loading recent activity...');
        
        const container = document.getElementById('recentActivity');
        
        // Get last 7 days
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        
        const { data, error } = await supabase
            .from('attendance')
            .select('*')
            .eq('employee_id', userProfile.id)
            .gte('date', sevenDaysAgo.toISOString().split('T')[0])
            .order('date', { ascending: false });
        
        if (error) throw error;
        
        if (!data || data.length === 0) {
            container.innerHTML = `
                <div class="text-center py-8">
                    <span class="text-4xl">📝</span>
                    <p class="text-gray-500 mt-2">Belum ada riwayat absensi</p>
                </div>
            `;
            return;
        }
        
        container.innerHTML = data.map(record => {
            const date = new Date(record.date);
            const dateString = date.toLocaleDateString('id-ID', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });
            
            const checkIn = record.check_in_time ? 
                new Date(record.check_in_time).toLocaleTimeString('id-ID', { 
                    hour: '2-digit', 
                    minute: '2-digit' 
                }) : 'Tidak absen';
            
            const checkOut = record.check_out_time ? 
                new Date(record.check_out_time).toLocaleTimeString('id-ID', { 
                    hour: '2-digit', 
                    minute: '2-digit' 
                }) : 'Tidak absen';
            
            let status = 'Tidak Hadir';
            let statusClass = 'status-red border-red';
            let bgClass = 'bg-red-50';
            let statusIcon = '❌';
            
            if (record.check_in_time) {
                const checkInTime = new Date(record.check_in_time);
                if (checkInTime.getHours() <= 8) {
                    status = 'Tepat Waktu';
                    statusClass = 'status-green border-green';
                    bgClass = 'bg-green-50';
                    statusIcon = '✅';
                } else {
                    status = 'Terlambat';
                    statusClass = 'status-yellow border-yellow';
                    bgClass = 'bg-yellow-50';
                    statusIcon = '⚠️';
                }
            }
            
            const workHours = record.work_hours ? 
                `${Math.floor(record.work_hours)} jam ${Math.round((record.work_hours - Math.floor(record.work_hours)) * 60)} menit` : 
                '-';
            
            return `
                <div class="flex items-center justify-between p-4 border-l-4 ${statusClass} ${bgClass} rounded-r-lg hover:shadow-md transition">
                    <div class="flex-grow">
                        <div class="flex items-center space-x-2 mb-1">
                            <span>${statusIcon}</span>
                            <p class="font-semibold text-gray-800">${dateString}</p>
                        </div>
                        <div class="text-sm text-gray-600 space-y-1">
                            <p>🌅 Masuk: ${checkIn} | 🌇 Pulang: ${checkOut}</p>
                            <p>⏱️ Total: ${workHours}</p>
                        </div>
                    </div>
                    <div class="text-right">
                        <span class="font-semibold text-sm px-2 py-1 rounded-full ${statusClass}">
                            ${status}
                        </span>
                    </div>
                </div>
            `;
        }).join('');
        
        console.log('✅ Recent activity loaded:', data.length, 'records');
        
    } catch (error) {
        console.error('❌ Error loading recent activity:', error);
        container.innerHTML = `
            <div class="text-center py-8">
                <span class="text-4xl">⚠️</span>
                <p class="text-red-500 mt-2">Error memuat riwayat absensi</p>
            </div>
        `;
    }
}

// =============================================
// FUNGSI PANEL ADMIN (TIDAK BERUBAH)
// =============================================
async function showAdminPanel() {
    if (userProfile.position !== 'Admin') {
        showErrorModal('Akses Ditolak', 'Anda tidak memiliki akses ke panel admin.');
        return;
    }
    
    document.getElementById('mainApp').style.display = 'none';
    document.getElementById('adminPanel').classList.remove('hidden');
    
    await loadAdminStatistics();
    await loadOfficeLocations();
    await loadAllEmployees();
}

function showMainApp() {
    document.getElementById('adminPanel').classList.add('hidden');
    document.getElementById('mainApp').style.display = 'block';
}

async function loadAdminStatistics() {
    try {
        // Total employees
        const { data: employees, error: empError } = await supabase
            .from('employees')
            .select('id');
        
        if (!empError) {
            document.getElementById('adminTotalEmployees').textContent = employees.length;
        }
        
        // Today's attendance
        const today = new Date().toISOString().split('T')[0];
        const { data: attendance, error: attError } = await supabase
            .from('attendance')
            .select('*')
            .eq('date', today);
        
        if (!attError) {
            const present = attendance.filter(a => a.check_in_time).length;
            const late = attendance.filter(a => {
                if (!a.check_in_time) return false;
                const time = new Date(a.check_in_time);
                return time.getHours() > 8 || (time.getHours() === 8 && time.getMinutes() > 0);
            }).length;
            
            document.getElementById('adminPresentToday').textContent = present;
            document.getElementById('adminAbsentToday').textContent = (employees.length - present);
            document.getElementById('adminLateToday').textContent = late;
        }
        
    } catch (error) {
        console.error('Error loading admin statistics:', error);
    }
}

async function loadOfficeLocations() {
    try {
        const { data, error } = await supabase
            .from('offices')
            .select('*')
            .order('name');
        
        if (error) throw error;
        
        officeLocations = data || [];
        renderOfficeTable();
        
    } catch (error) {
        console.error('Error loading offices:', error);
        document.getElementById('officeTableBody').innerHTML = `
            <tr>
                <td colspan="6" class="border border-gray-200 px-4 py-8 text-center">
                    <span class="text-4xl">⚠️</span>
                    <p class="text-red-500 mt-2">Error memuat data lokasi kantor</p>
                </td>
            </tr>
        `;
    }
}

function renderOfficeTable() {
    const tbody = document.getElementById('officeTableBody');
    
    if (officeLocations.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" class="border border-gray-200 px-4 py-8 text-center">
                    <span class="text-4xl">🏢</span>
                    <p class="text-gray-500 mt-2">Belum ada lokasi kantor yang terdaftar</p>
                </td>
            </tr>
        `;
        return;
    }
    
    tbody.innerHTML = officeLocations.map(office => {
        const statusClass = office.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800';
        const statusText = office.is_active ? '✅ Aktif' : '❌ Nonaktif';
        
        return `
            <tr class="hover:bg-gray-50">
                <td class="border border-gray-200 px-4 py-3 font-medium">${office.name}</td>
                <td class="border border-gray-200 px-4 py-3 text-sm">${office.address}</td>
                <td class="border border-gray-200 px-4 py-3 text-xs font-mono">
                    ${office.latitude.toFixed(6)}, ${office.longitude.toFixed(6)}
                </td>
                <td class="border border-gray-200 px-4 py-3 text-center">
                    <span class="px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                        ${office.radius_meters}m
                    </span>
                </td>
                <td class="border border-gray-200 px-4 py-3 text-center">
                    <span class="px-2 py-1 text-xs font-semibold rounded-full ${statusClass}">
                        ${statusText}
                    </span>
                </td>
                <td class="border border-gray-200 px-4 py-3 text-center">
                    <div class="flex justify-center space-x-2">
                        <button onclick="toggleOfficeStatus('${office.id}')" class="bg-${office.is_active ? 'orange' : 'green'}-500 hover:bg-${office.is_active ? 'orange' : 'green'}-600 text-white px-3 py-1 rounded text-xs font-medium transition">
                            ${office.is_active ? '⏸️ Nonaktif' : '▶️ Aktif'}
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

async function loadAllEmployees() {
    try {
        const { data, error } = await supabase
            .from('employees')
            .select('*')
            .order('name');
        
        if (error) throw error;
        
        allEmployees = data || [];
        filteredEmployees = [...allEmployees];
        renderEmployeeTable();
        
    } catch (error) {
        console.error('Error loading employees:', error);
        document.getElementById('employeeTableBody').innerHTML = `
            <tr>
                <td colspan="6" class="border border-gray-200 px-4 py-8 text-center">
                    <span class="text-4xl">⚠️</span>
                    <p class="text-red-500 mt-2">Error memuat data pegawai</p>
                </td>
            </tr>
        `;
    }
}

function renderEmployeeTable() {
    const tbody = document.getElementById('employeeTableBody');
    
    if (filteredEmployees.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" class="border border-gray-200 px-4 py-8 text-center">
                    <span class="text-4xl">👥</span>
                    <p class="text-gray-500 mt-2">Tidak ada data pegawai</p>
                </td>
            </tr>
        `;
        return;
    }
    
    tbody.innerHTML = filteredEmployees.map(employee => `
        <tr class="hover:bg-gray-50">
            <td class="border border-gray-200 px-4 py-3">${employee.nik}</td>
            <td class="border border-gray-200 px-4 py-3 font-medium">${employee.name}</td>
            <td class="border border-gray-200 px-4 py-3">
                <span class="px-2 py-1 text-xs font-semibold rounded-full ${getPositionColor(employee.position)}">
                    ${employee.position}
                </span>
            </td>
            <td class="border border-gray-200 px-4 py-3 text-sm">${employee.unit_kerja || '-'}</td>
            <td class="border border-gray-200 px-4 py-3 text-sm">${employee.phone || '-'}</td>
            <td class="border border-gray-200 px-4 py-3 text-center">
                <div class="flex justify-center space-x-2">
                    <button onclick="viewEmployeeAttendance('${employee.id}')" class="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded text-xs font-medium transition">
                        📊 Lihat
                    </button>
                </div>
            </td>
        </tr>
    `).join('');
}

function getPositionColor(position) {
    switch(position) {
        case 'Admin': return 'bg-purple-100 text-purple-800';
        case 'Guru': return 'bg-green-100 text-green-800';
        case 'Staff': return 'bg-blue-100 text-blue-800';
        case 'PPNPN': return 'bg-orange-100 text-orange-800';
        default: return 'bg-gray-100 text-gray-800';
    }
}

function filterEmployees() {
    const searchTerm = document.getElementById('searchEmployee').value.toLowerCase();
    const positionFilter = document.getElementById('filterPosition').value;
    
    filteredEmployees = allEmployees.filter(employee => {
        const matchesSearch = employee.name.toLowerCase().includes(searchTerm) || 
                            employee.nik.includes(searchTerm);
        const matchesPosition = !positionFilter || employee.position === positionFilter;
        
        return matchesSearch && matchesPosition;
    });
    
    renderEmployeeTable();
}

// =============================================
// FUNGSI UTILITAS (TIDAK BERUBAH)
// =============================================
function updateDateTime() {
    const now = new Date();
    const timeOptions = { 
        hour: '2-digit', 
        minute: '2-digit', 
        second: '2-digit',
        timeZone: 'Asia/Jayapura'
    };
    const dateOptions = { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric',
        timeZone: 'Asia/Jayapura'
    };
    
    const timeEl = document.getElementById('currentTime');
    const dateEl = document.getElementById('currentDate');
    
    if (timeEl) timeEl.textContent = now.toLocaleTimeString('id-ID', timeOptions);
    if (dateEl) dateEl.textContent = now.toLocaleDateString('id-ID', dateOptions);
}

function showLoginScreen() {
    document.getElementById('loginScreen').classList.remove('hidden');
    document.getElementById('mainApp').classList.add('hidden');
}

function showMainApp() {
    document.getElementById('loginScreen').classList.add('hidden');
    document.getElementById('mainApp').classList.remove('hidden');
    document.getElementById('mainApp').classList.add('fade-in');
}

function showError(element, message) {
    if (!element) return;
    
    const messageEl = element.querySelector('p');
    if (messageEl) messageEl.textContent = message;
    element.classList.remove('hidden');
    
    setTimeout(() => {
        element.classList.add('hidden');
    }, 5000);
}

function showSuccessModal(title, message) {
    document.getElementById('modalIcon').textContent = '✅';
    document.getElementById('modalTitle').textContent = title;
    document.getElementById('modalMessage').textContent = message;
    document.getElementById('successModal').classList.remove('hidden');
    document.getElementById('successModal').classList.add('flex');
}

function showErrorModal(title, message) {
    document.getElementById('modalIcon').textContent = '❌';
    document.getElementById('modalTitle').textContent = title;
    document.getElementById('modalMessage').textContent = message;
    document.getElementById('successModal').classList.remove('hidden');
    document.getElementById('successModal').classList.add('flex');
}

function closeModal() {
    document.getElementById('successModal').classList.add('hidden');
    document.getElementById('successModal').classList.remove('flex');
}

function showLoadingOverlay(show) {
    const overlay = document.getElementById('loadingOverlay');
    if (show) {
        overlay.classList.remove('hidden');
        overlay.classList.add('flex');
    } else {
        overlay.classList.add('hidden');
        overlay.classList.remove('flex');
    }
}

// =============================================
// FUNGSI GLOBAL UNTUK PANEL ADMIN (TIDAK BERUBAH)
// =============================================
window.toggleOfficeStatus = async function(officeId) {
    try {
        const office = officeLocations.find(off => off.id === officeId);
        if (!office) return;
        
        const { error } = await supabase
            .from('offices')
            .update({ is_active: !office.is_active })
            .eq('id', officeId);
        
        if (error) throw error;
        
        await loadOfficeLocations();
        
        const statusText = !office.is_active ? 'diaktifkan' : 'dinonaktifkan';
        showSuccessModal(
            '✅ Status Berhasil Diubah!',
            `Lokasi kantor "${office.name}" berhasil ${statusText}.`
        );
        
    } catch (error) {
        console.error('Toggle office status error:', error);
        showErrorModal('Gagal Mengubah Status', 'Terjadi kesalahan saat mengubah status lokasi kantor.');
    }
}

window.viewEmployeeAttendance = function(employeeId) {
    const employee = allEmployees.find(emp => emp.id === employeeId);
    if (employee) {
        showSuccessModal(
            '📊 Data Absensi Pegawai',
            `Fitur lihat data absensi untuk ${employee.name} akan segera tersedia.`
        );
    }
}

console.log('🎉 Aplikasi Absensi PPNPN siap digunakan!');
