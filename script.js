// FINAL script.js — Full Supabase app (teacher + student)
// Supabase project (you provided these values earlier)
const SUPABASE_URL = "https://hlstgluwamsuuqlctdzk.supabase.co";
const SUPABASE_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhsc3RnbHV3YW1zdXVxbGN0ZHprIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQyNzMwMzQsImV4cCI6MjA3OTg0OTAzNH0.KUPx3pzrcd3H5aEx2B7mFosWNUVOEzXDD5gL-TmyawQ";

const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON);

// UI elements
const roleSelect = document.getElementById('roleSelect');
const usernameEl = document.getElementById('username');
const passwordEl = document.getElementById('password');
const loginBtn = document.getElementById('loginBtn');
const guestBtn = document.getElementById('guestBtn');
const loginMsg = document.getElementById('loginMsg');
const userRole = document.getElementById('userRole');

const subjectSelect = document.getElementById('subjectSelect');
const currentSubject = document.getElementById('currentSubject');
const fileInput = document.getElementById('fileInput');
const uploadLabel = document.getElementById('uploadLabel');
const uploadProgress = document.getElementById('uploadProgress');
const uploadBar = document.getElementById('uploadBar');
const uploadPercent = document.getElementById('uploadPercent');
const uploadStatus = document.getElementById('uploadStatus');
const logoutBtn = document.getElementById('logoutBtn');

const fileList = document.getElementById('fileList');
const searchInput = document.getElementById('searchInput');
const refreshBtn = document.getElementById('refreshBtn');

const pdfOverlay = document.getElementById('pdfOverlay');
const pdfFrame = document.getElementById('pdfFrame');
const pdfTitle = document.getElementById('pdfTitle');
const closePdfBtn = document.getElementById('closePdfBtn');

const themeToggle = document.getElementById('themeToggle');
const loadingOverlay = document.getElementById('loadingOverlay');

// global user object
let currentUser = null; // { role: 'student'|'teacher', name/email }

// helpers
function showLoading(){ loadingOverlay.style.display = 'flex'; }
function hideLoading(){ loadingOverlay.style.display = 'none'; }
function setLoginMessage(msg, isError = false){
  loginMsg.textContent = msg || '';
  loginMsg.style.color = isError ? '#dc2626' : '#6b7280';
}

// theme
themeToggle.onclick = () => {
  document.body.classList.toggle('dark');
};

// role switch updates labels
roleSelect.onchange = () => {
  const role = roleSelect.value;
  document.getElementById('labelUser').textContent = role === 'teacher' ? 'Teacher email' : 'Student name';
  usernameEl.placeholder = role === 'teacher' ? 'teacher@example.com' : 'Student name';
};

// quick guest student
guestBtn.onclick = () => {
  const name = usernameEl.value.trim() || 'Student';
  // student common password required to proceed
  const pw = passwordEl.value;
  if (pw !== '@armyamanu') {
    setLoginMessage('Student common password is: @armyamanu', true);
    return;
  }
  // set as student
  currentUser = { role: 'student', name };
  userRole.textContent = `student: ${name}`;
  setLoginMessage('Logged in as student');
  // UI changes
  document.getElementById('uploadLabel').style.display = 'none';
  loadFiles(subjectSelect.value);
};

// login handler (teacher via Supabase)
loginBtn.onclick = async () => {
  setLoginMessage('');
  showLoading();

  const role = roleSelect.value;
  const identifier = usernameEl.value.trim();
  const pw = passwordEl.value;

  if (!identifier || !pw) {
    setLoginMessage('Please fill both fields', true);
    hideLoading();
    return;
  }

  if (role === 'student') {
    // student path: check common password
    if (pw !== '@armyamanu') {
      setLoginMessage('Wrong student password', true);
      hideLoading();
      return;
    }
    currentUser = { role: 'student', name: identifier };
    userRole.textContent = `student: ${identifier}`;
    document.getElementById('uploadLabel').style.display = 'none';
    setLoginMessage('Logged in as student');
    hideLoading();
    loadFiles(subjectSelect.value);
    return;
  }

  // teacher: Supabase Auth
  try {
    const res = await sb.auth.signInWithPassword({ email: identifier, password: pw });
    if (res.error) throw res.error;
    currentUser = { role: 'teacher', email: identifier };
    userRole.textContent = `teacher: ${identifier}`;
    document.getElementById('uploadLabel').style.display = 'inline-block';
    setLoginMessage('Logged in as teacher');
    loadFiles(subjectSelect.value);
  } catch (err) {
    setLoginMessage(err.message || 'Login failed', true);
  } finally {
    hideLoading();
  }
};

// logout
logoutBtn.onclick = async () => {
  try { await sb.auth.signOut(); } catch(e){}
  currentUser = null;
  userRole.textContent = 'Not logged in';
  setLoginMessage('Logged out');
  // hide UI-sensitive elements
  document.getElementById('uploadLabel').style.display = 'none';
  fileList.innerHTML = '';
};

// keep session if teacher already logged in
(async function init() {
  try {
    const s = await sb.auth.getSession();
    if (s && s.data && s.data.session) {
      currentUser = { role: 'teacher', email: s.data.session.user.email };
      userRole.textContent = `teacher: ${currentUser.email}`;
      document.getElementById('uploadLabel').style.display = 'inline-block';
    } else {
      document.getElementById('uploadLabel').style.display = 'none';
    }
  } catch (e) {
    console.warn('session init err', e);
  }
})();

// file selection handling
fileInput.onchange = (e) => {
  const file = e.target.files[0];
  if (!file) return;
  if (!currentUser) { alert('Please login first'); return; }
  uploadFile(file, subjectSelect.value);
};

// upload function: uploads to Supabase storage then inserts DB row (table 'files')
// stores: name, subject, url, path, created_at (Supabase SQL should have these)
async function uploadFile(file, subject) {
  try {
    showLoading();
    uploadProgress.style.display = 'block';
    uploadBar.style.width = '0%';
    uploadPercent.textContent = '0%';
    uploadStatus.textContent = '';

    // safe file name and unique path
    const ts = Date.now();
    const safe = encodeURIComponent(file.name.replace(/\s+/g,'_'));
    const path = `${subject}/${ts}_${safe}`;

    // upload (upsert true allows overwrite)
    const { data: uploadData, error: uploadErr } = await sb.storage
      .from('files')
      .upload(path, file, { upsert: true });

    if (uploadErr) throw uploadErr;

    // we can't reliably stream progress with this API; show complete
    uploadBar.style.width = '100%';
    uploadPercent.textContent = '100%';
    uploadStatus.textContent = 'Stored. Saving DB record...';

    // get public URL
    const { data: publicData } = sb.storage.from('files').getPublicUrl(path);
    const publicUrl = publicData?.publicUrl || '';

    // insert into DB
    const { error: insertErr } = await sb.from('files').insert([{
      name: file.name,
      subject,
      url: publicUrl,
      path,
      created_at: new Date().toISOString()
    }]);

    if (insertErr) throw insertErr;

    uploadStatus.textContent = 'Saved.';
    setTimeout(()=>{ uploadProgress.style.display = 'none'; uploadBar.style.width = '0%'; uploadPercent.textContent = '0%';}, 900);
    loadFiles(subject);
  } catch (err) {
    alert('Upload error: ' + (err.message || JSON.stringify(err)));
    uploadStatus.textContent = 'Error';
  } finally {
    hideLoading();
  }
}

// load files for selected subject: queries 'files' table in Supabase
async function loadFiles(subject) {
  showLoading();
  fileList.innerHTML = '';
  currentSubject.textContent = subject;
  const q = (searchInput.value || '').trim();

  try {
    let query = sb.from('files').select('*').eq('subject', subject).order('created_at',{ ascending:false });
    if (q) query = query.ilike('name', `%${q}%`);

    const { data, error } = await query;
    if (error) throw error;

    if (!data || data.length === 0) {
      fileList.innerHTML = '<div class="muted">No files yet.</div>';
      return;
    }

    data.forEach(item => {
      const row = document.createElement('div');
      row.className = 'file-row';
      row.innerHTML = `
        <div style="min-width:0;">
          <div style="font-weight:700">${escapeHtml(item.name)}</div>
          <div class="muted" style="font-size:12px;">${escapeHtml(item.subject)} • ${new Date(item.created_at).toLocaleString()}</div>
        </div>
        <div style="display:flex; gap:8px; align-items:center;">
          <button class="btn btn-ghost viewBtn">View</button>
          ${currentUser && currentUser.role === 'teacher' ? '<button class="btn btn-danger deleteBtn">Delete</button>' : ''}
        </div>
      `;

      // view
      row.querySelector('.viewBtn').onclick = () => {
        pdfFrame.src = item.url;
        pdfTitle.textContent = item.name;
        pdfOverlay.style.display = 'flex';
      };

      // delete
      if (currentUser && currentUser.role === 'teacher') {
        row.querySelector('.deleteBtn').onclick = async () => {
          if (!confirm('Delete this file?')) return;
          try {
            // delete DB row
            const { error: delErr } = await sb.from('files').delete().eq('id', item.id);
            if (delErr) throw delErr;

            // delete storage object using stored path
            if (item.path) {
              const { error: rmErr } = await sb.storage.from('files').remove([item.path]);
              if (rmErr) console.warn('storage remove error', rmErr);
            } else {
              // fallback: try to derive path from URL (not ideal)
              const u = new URL(item.url);
              const pathParts = decodeURIComponent(u.pathname).split('/');
              // remove first two parts (/storage/v1/object/public/{bucket}/path...)
              const idx = pathParts.indexOf('files');
              if (idx >= 0) {
                const path = pathParts.slice(idx+1).join('/');
                await sb.storage.from('files').remove([path]);
              }
            }
            loadFiles(subjectSelect.value);
          } catch (e) {
            alert('Delete failed: ' + (e.message || JSON.stringify(e)));
          }
        };
      }

      fileList.appendChild(row);
    });

  } catch (err) {
    fileList.innerHTML = '<div class="muted">Error loading files: ' + (err.message || err) + '</div>';
  } finally {
    hideLoading();
  }
}

// utilities
function escapeHtml(s){ return String(s||'').replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

// search / refresh handlers
refreshBtn.onclick = () => loadFiles(subjectSelect.value);
searchInput.oninput = () => loadFiles(subjectSelect.value);
subjectSelect.onchange = () => loadFiles(subjectSelect.value);

// PDF close
closePdfBtn.onclick = () => { pdfOverlay.style.display = 'none'; pdfFrame.src = ''; };

// initialize UI state
(function ready(){
  // start with student selected
  roleSelect.value = 'student';
  document.getElementById('labelUser').textContent = 'Student name';
  uploadProgress.style.display = 'none';
  document.getElementById('uploadLabel').style.display = 'none';
  // load default subject
  loadFiles(subjectSelect.value);
})();
