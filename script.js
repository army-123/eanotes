/* =====================
   CONFIG (Supabase)
   ===================== */
const SUPABASE_URL = "https://hlstgluwamsuuqlctdzk.supabase.co";
const SUPABASE_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhsc3RnbHV3YW1zdXVxbGN0ZHprIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQyNzMwMzQsImV4cCI6MjA3OTg0OTAzNH0.KUPx3pzrcd3H5aEx2B7mFosWNUVOEzXDD5gL-TmyawQ";

const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON);

/* =====================
   ELEMENTS
   ===================== */
const roleSelect = document.getElementById('roleSelect');
const labelUser = document.getElementById('labelUser');
const usernameEl = document.getElementById('username');
const passwordEl = document.getElementById('password');
const loginBtn = document.getElementById('loginBtn');
const quickBtn = document.getElementById('quickBtn');
const loginMsg = document.getElementById('loginMsg');
const logoutBtn = document.getElementById('logoutBtn');

const searchInput = document.getElementById('searchInput');

const uploadSection = document.getElementById('uploadSection');
const subjectSelect = document.getElementById('subjectSelect');
const fileInput = document.getElementById('fileInput');
const uploadBtn = document.getElementById('uploadBtn');
const uploadInfo = document.getElementById('uploadInfo');
const uploadPercent = document.getElementById('uploadPercent');

const fileList = document.getElementById('fileList');

const loadingOverlay = document.getElementById('loadingOverlay');

const pdfOverlay = document.getElementById('pdfOverlay');
const pdfFrame = document.getElementById('pdfFrame');
const pdfTitle = document.getElementById('pdfTitle');
const closePdf = document.getElementById('closePdf');

const themeToggle = document.getElementById('themeToggle');
const userRole = document.getElementById('userRole');

/* =====================
   HELPERS
   ===================== */
function showLoading(){ loadingOverlay.style.display = 'flex'; }
function hideLoading(){ loadingOverlay.style.display = 'none'; }
function setMsg(text, isError = false){
  loginMsg.textContent = text || '';
  loginMsg.style.color = isError ? '#ff7b7b' : 'var(--muted)';
}
function saveUser(obj){ localStorage.setItem('eanotes_user', JSON.stringify(obj)); }
function getUser(){ try { return JSON.parse(localStorage.getItem('eanotes_user')); } catch { return null; } }

/* Prevent credential/password manager popups as much as possible:
   - inputs are not inside a <form>
   - login button is type="button"
   - password has autocomplete="new-password"
*/
roleSelect.addEventListener('change', () => {
  if (roleSelect.value === 'teacher') {
    labelUser.textContent = 'Teacher Email';
    usernameEl.placeholder = 'teacher@example.com';
  } else {
    labelUser.textContent = 'Student name';
    usernameEl.placeholder = 'Student name';
  }
});

/* Theme */
themeToggle.onclick = () => {
  document.body.classList.toggle('light');
  themeToggle.textContent = document.body.classList.contains('light') ? '☀️' : '🌙';
};

/* Quick button fills student creds */
quickBtn.onclick = () => {
  roleSelect.value = 'student';
  roleSelect.dispatchEvent(new Event('change'));
  usernameEl.value = usernameEl.value || 'Student';
  passwordEl.value = '@armyamanu';
  setMsg('Quick student ready — click Login');
};

/* LOGIN logic */
loginBtn.addEventListener('click', async () => {
  setMsg('');
  showLoading();

  const role = roleSelect.value;
  const id = usernameEl.value.trim();
  const pw = passwordEl.value;

  if (!id || !pw) {
    setMsg('Fill username and password', true);
    hideLoading();
    return;
  }

  try {
    if (role === 'student') {
      // simple local student login with common password
      if (pw !== '@armyamanu') {
        setMsg('Incorrect student password', true);
        hideLoading();
        return;
      }
      saveUser({ role:'student', name: id });
      userRole.textContent = `student: ${id}`;
      uploadSection.style.display = 'none';
      logoutBtn.style.display = 'inline-block';
      setMsg('Logged in as student');
      hideLoading();
      await loadFiles();
      return;
    }

    // teacher: use Supabase email/password
    const res = await sb.auth.signInWithPassword({ email: id, password: pw });
    if (res.error) throw res.error;

    saveUser({ role:'teacher', email: id });
    userRole.textContent = `teacher: ${id}`;
    uploadSection.style.display = 'block';
    logoutBtn.style.display = 'inline-block';
    setMsg('Logged in as teacher');
    hideLoading();
    await loadFiles();
  } catch (err) {
    setMsg(err.message || 'Login failed', true);
    hideLoading();
  }
});

/* LOGOUT */
logoutBtn.addEventListener('click', async () => {
  try { await sb.auth.signOut(); } catch {}
  localStorage.removeItem('eanotes_user');
  uploadSection.style.display = 'none';
  logoutBtn.style.display = 'none';
  userRole.textContent = 'Not logged in';
  setMsg('Logged out');
  fileList.innerHTML = '';
});

/* UPLOAD */
uploadBtn.addEventListener('click', async () => {
  const file = fileInput.files[0];
  if (!file) return alert('Choose a PDF first');
  const user = getUser();
  if (!user || user.role !== 'teacher') return alert('Only teachers can upload');

  uploadInfo.style.display = 'block';
  uploadPercent.textContent = '0%';
  showLoading();

  const subject = subjectSelect.value;
  const safe = encodeURIComponent(file.name.replace(/\s+/g,'_'));
  const path = `${subject}/${Date.now()}_${safe}`;

  try {
    // upload (no fine-grained progress available in this SDK)
    const { error: upErr } = await sb.storage.from('files').upload(path, file, { upsert: true });
    if (upErr) throw upErr;

    uploadPercent.textContent = '100%';

    const { data: urlData } = sb.storage.from('files').getPublicUrl(path);
    const publicUrl = urlData?.publicUrl || '';

    const { error: insErr } = await sb.from('files').insert([{
      name: file.name,
      subject,
      url: publicUrl,
      path,
      created_at: new Date().toISOString()
    }]);
    if (insErr) throw insErr;

    setMsg('Upload successful');
    fileInput.value = '';
    await loadFiles();
  } catch (e) {
    alert('Upload failed: ' + (e.message || e));
  } finally {
    uploadInfo.style.display = 'none';
    hideLoading();
  }
});

/* SEARCH inside login area — used to filter file list */
searchInput.addEventListener('input', () => {
  // small debounce
  if (window._searchTimer) clearTimeout(window._searchTimer);
  window._searchTimer = setTimeout(() => loadFiles(), 250);
});

/* LOAD FILES from DB */
async function loadFiles(){
  const subj = subjectSelect.value;
  const q = (searchInput.value || '').trim();

  fileList.innerHTML = 'Loading...';
  showLoading();

  try {
    let query = sb.from('files').select('*').eq('subject', subj).order('created_at', { ascending: false });
    if (q) query = query.ilike('name', `%${q}%`);

    const { data, error } = await query;
    if (error) throw error;

    if (!data || data.length === 0) {
      fileList.innerHTML = '<div class="muted">No files found.</div>';
      hideLoading();
      return;
    }

    fileList.innerHTML = '';
    const user = getUser();

    data.forEach(item => {
      const div = document.createElement('div');
      div.className = 'fileRow';
      div.innerHTML = `
        <div style="min-width:0">
          <div style="font-weight:700">${escapeHtml(item.name)}</div>
          <div class="muted" style="font-size:12px">${escapeHtml(item.subject)} • ${new Date(item.created_at).toLocaleString()}</div>
        </div>
        <div class="row" style="gap:8px">
          <button class="btn-ghost" type="button">View</button>
          ${user && user.role === 'teacher' ? `<button class="btn-danger" type="button">Delete</button>` : ''}
        </div>
      `;

      // view button
      const viewBtn = div.querySelector('.btn-ghost');
      viewBtn.onclick = () => {
        pdfTitle.textContent = item.name;
        pdfFrame.src = item.url;
        pdfOverlay.style.display = 'flex';
      };

      // delete button (teacher only)
      if (user && user.role === 'teacher') {
        const delBtn = div.querySelector('.btn-danger');
        delBtn.onclick = async () => {
          if (!confirm('Delete this file?')) return;
          try {
            const { error: delErr } = await sb.from('files').delete().eq('id', item.id);
            if (delErr) throw delErr;
            if (item.path) await sb.storage.from('files').remove([item.path]);
            await loadFiles();
          } catch (e) {
            alert('Delete failed: ' + (e.message || e));
          }
        };
      }

      fileList.appendChild(div);
    });

  } catch (err) {
    fileList.innerHTML = '<div class="muted">Error loading files</div>';
    console.error(err);
  } finally {
    hideLoading();
  }
}

/* PDF close */
closePdf.addEventListener('click', () => { pdfOverlay.style.display = 'none'; pdfFrame.src = ''; });

/* initial state */
(function init(){
  const u = getUser();
  if (u) {
    userRole.textContent = u.role === 'teacher' ? `teacher: ${u.email||u.name}` : `student: ${u.name}`;
    logoutBtn.style.display = 'inline-block';
    uploadSection.style.display = (u.role === 'teacher') ? 'block' : 'none';
    loadFiles();
  } else {
    uploadSection.style.display = 'none';
  }
})();

/* utils */
function escapeHtml(s){ return String(s||'').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
