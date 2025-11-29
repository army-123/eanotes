/* =========================
   EA NOTES CLOUD - script.js
   Single-page logic for index.html
   Features:
   - Login (password decides role)
   - Dashboard (separate UI shown after login)
   - Upload button triggers file picker
   - Shows uploading row immediately and updates when done
   - File listing, view, delete (teacher)
   - Small UI animations and loading indicators
   ========================= */

/* ---------- Supabase config (use your project values) ---------- */
const SUPABASE_URL = "https://hlstgluwamsuuqlctdzk.supabase.co";
const SUPABASE_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhsc3RnbHV3YW1zdXVxbGN0ZHprIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQyNzMwMzQsImV4cCI6MjA3OTg0OTAzNH0.KUPx3pzrcd3H5aEx2B7mFosWNUVOEzXDD5gL-TmyawQ";

const supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON);

/* ---------- DOM ---------- */
const loginBox = document.getElementById('loginBox');
const loginName = document.getElementById('loginName');
const loginPassword = document.getElementById('loginPassword');
const btnLogin = document.getElementById('btnLogin');
const btnLoginText = document.getElementById('btnLoginText');
const btnLoginSpinner = document.getElementById('btnLoginSpinner');
const loginFeedback = document.getElementById('loginFeedback');

const dashboard = document.getElementById('dashboard');
const roleTag = document.getElementById('roleTag');
const welcomeText = document.getElementById('welcomeText');
const controlsRow = document.getElementById('controlsRow');
const subjectSelect = document.getElementById('subjectSelect');
const uploadBtn = document.getElementById('uploadBtn');
const realFileInput = document.getElementById('realFileInput');
const fileList = document.getElementById('fileList');
const logoutBtn = document.getElementById('logoutBtn');

const pdfModal = document.getElementById('pdfModal');
const pdfFrame = document.getElementById('pdfFrame');
const pdfTitle = document.getElementById('pdfTitle');
const closePdf = document.getElementById('closePdf');

const headerRight = document.getElementById('headerRight');

/* ---------- helper UI ---------- */
function showLoginLoading(show){
  btnLogin.disabled = show;
  btnLoginSpinner.style.display = show ? 'inline-block' : 'none';
  btnLoginText.textContent = show ? 'Logging in…' : 'Login';
}
function setFeedback(msg, isErr=false){
  loginFeedback.textContent = msg || '';
  loginFeedback.style.color = isErr ? 'var(--danger)' : 'var(--muted)';
}
function showDashboard(show){
  if(show){
    loginBox.style.display = 'none';
    dashboard.style.display = 'block';
    dashboard.setAttribute('aria-hidden','false');
  } else {
    loginBox.style.display = 'block';
    dashboard.style.display = 'none';
    dashboard.setAttribute('aria-hidden','true');
  }
}

/* ---------- theme (liquid accent already applied in CSS) ---------- */
(function attachThemeToggle(){
  // small convenience: click headerRight toggles theme (optional)
  const themeButton = document.createElement('button');
  themeButton.textContent = '🌙';
  themeButton.className = 'btn btn-ghost';
  themeButton.style.border = '1px solid rgba(255,255,255,0.06)';
  themeButton.onclick = () => {
    document.documentElement.classList.toggle('light');
    themeButton.textContent = document.documentElement.classList.contains('light') ? '☀️' : '🌙';
  };
  headerRight.appendChild(themeButton);
})();

/* ---------- login logic: password decides role ---------- */
async function loginHandler(){
  setFeedback('');
  const name = loginName.value.trim();
  const pw = loginPassword.value;

  if(!name || !pw){
    setFeedback('Enter both username and password', true);
    return;
  }

  showLoginLoading(true);
  // tiny delay so spinner visible
  await new Promise(r=>setTimeout(r, 450));

  // student
  if(pw === '@armyamanu'){
    saveUser({ role:'student', name });
    finishLogin('student', name);
    return;
  }

  // teacher (client-side password as requested)
  if(pw === '@teacher123'){
    // allow any string as teacher email/identifier
    saveUser({ role:'teacher', name });
    finishLogin('teacher', name);
    return;
  }

  setFeedback('Incorrect password', true);
  showLoginLoading(false);
}

/* finish login: show dashboard, set UI */
function finishLogin(role, name){
  roleTag.textContent = role === 'teacher' ? 'Teacher' : 'Student';
  welcomeText.textContent = role === 'teacher' ? `Welcome, Teacher` : `Welcome, ${escapeHtml(name)}`;
  setFeedback('');

  // show/hide controls
  if(role === 'teacher'){
    controlsRow.classList.remove('hidden');
    uploadBtn.style.display = 'inline-flex';
  } else {
    controlsRow.classList.add('hidden');
  }

  showDashboard(true);
  showLoginLoading(false);
  // store session
  localStorage.setItem('eanotes_user', JSON.stringify({ role, name }));

  // load files for selected subject
  loadFiles();
}

/* attach login events */
btnLogin.addEventListener('click', loginHandler);
loginPassword.addEventListener('keyup', (e) => { if(e.key === 'Enter') loginHandler(); });

/* if session exists — auto-enter */
(function autoSession(){
  const raw = localStorage.getItem('eanotes_user');
  if(!raw) return;
  try{
    const user = JSON.parse(raw);
    finishLogin(user.role, user.name);
  }catch(e){}
})();

/* ---------- logout ---------- */
logoutBtn.addEventListener('click', () => {
  localStorage.removeItem('eanotes_user');
  // reset UI
  loginName.value = '';
  loginPassword.value = '';
  showDashboard(false);
});

/* ---------- upload logic ---------- */
/* Upload button triggers hidden file input */
uploadBtn.addEventListener('click', () => {
  realFileInput.click();
});

/* When file chosen, show uploading row immediately and perform upload */
realFileInput.addEventListener('change', async (ev) => {
  const file = ev.target.files && ev.target.files[0];
  if(!file) return;

  // ensure teacher
  const raw = localStorage.getItem('eanotes_user');
  const user = raw ? JSON.parse(raw) : null;
  if(!user || user.role !== 'teacher'){
    alert('Only teachers can upload');
    return;
  }

  const subject = subjectSelect.value || 'General';

  // create an uploading row
  const place = createUploadingRow(file.name, subject);

  try{
    // build path
    const safe = encodeURIComponent(file.name.replace(/\s+/g,'_'));
    const path = `${subject}/${Date.now()}_${safe}`;

    // upload (no native progress callback in this SDK)
    const { data: upData, error: upErr } = await supabase.storage.from('files').upload(path, file, { upsert:true });
    if(upErr) throw upErr;

    // get public url
    const { data: urlData } = supabase.storage.from('files').getPublicUrl(path);
    const publicUrl = urlData?.publicUrl || '';

    // insert DB row
    const insertObj = {
      name: file.name,
      subject,
      url: publicUrl,
      path,
      created_at: new Date().toISOString()
    };

    const { data: insData, error: insErr } = await supabase.from('files').insert([insertObj]).select().limit(1).single();
    if(insErr) throw insErr;

    // update uploading row to final item
    place.done(insData);
  }catch(err){
    console.error('upload err', err);
    place.fail();
    alert('Upload failed: ' + (err.message || JSON.stringify(err)));
  } finally {
    // clear input so same file can be selected again
    ev.target.value = '';
  }
});

/* create uploading row in UI and return helpers to update it */
function createUploadingRow(filename, subject){
  const row = document.createElement('div');
  row.className = 'file-row uploading';
  row.innerHTML = `
    <div class="file-meta">
      <div class="file-title">${escapeHtml(filename)}</div>
      <div class="file-sub">Subject: ${escapeHtml(subject)} • Uploading… <span class="spinner-inline"></span></div>
      <div class="progress"><b style="width:4%"></b></div>
    </div>
    <div class="file-actions"></div>
  `;
  // insert at top
  fileList.prepend(row);

  const bar = row.querySelector('.progress > b');

  // animate progress visually to keep user engaged
  let pct = 8;
  const t = setInterval(()=> {
    pct = Math.min(92, pct + Math.random()*12);
    bar.style.width = pct + '%';
  }, 300);

  return {
    done(data){
      clearInterval(t);
      bar.style.width = '100%';
      // replace row content with final display
      row.innerHTML = `
        <div class="file-meta">
          <div class="file-title">${escapeHtml(data.name)}</div>
          <div class="file-sub">${escapeHtml(data.subject)} • ${new Date(data.created_at).toLocaleString()}</div>
        </div>
        <div class="file-actions">
          <button class="btn-view">View</button>
          <button class="btn-delete">Delete</button>
        </div>
      `;
      // attach handlers
      row.querySelector('.btn-view').addEventListener('click', ()=> openPdf(data.url, data.name));
      row.querySelector('.btn-delete').addEventListener('click', async ()=>{
        if(!confirm('Delete this file?')) return;
        try{
          await supabase.from('files').delete().eq('id', data.id);
          if(data.path) await supabase.storage.from('files').remove([data.path]);
          row.remove();
        }catch(e){ alert('Delete failed: ' + (e.message || e)); }
      });
    },
    fail(){
      clearInterval(t);
      row.querySelector('.file-sub').textContent = 'Upload failed';
      row.style.opacity = '0.6';
    }
  };
}

/* ---------- loadFiles (by subject) ---------- */
async function loadFiles(){
  fileList.innerHTML = '<div class="muted">Loading files…</div>';
  const subject = subjectSelect.value || 'Anatomy';
  try{
    const { data, error } = await supabase.from('files').select('*').eq('subject', subject).order('created_at', { ascending:false });
    if(error) throw error;

    fileList.innerHTML = '';
    if(!data || data.length === 0){
      fileList.innerHTML = '<div class="muted">No files for this subject yet.</div>';
      return;
    }

    data.forEach(item => {
      const div = document.createElement('div');
      div.className = 'file-row';
      div.innerHTML = `
        <div class="file-meta">
          <div class="file-title">${escapeHtml(item.name)}</div>
          <div class="file-sub">${escapeHtml(item.subject)} • ${new Date(item.created_at).toLocaleString()}</div>
        </div>
        <div class="file-actions">
          <button class="btn-view">View</button>
          ${(getUserRole() === 'teacher') ? '<button class="btn-delete">Delete</button>' : ''}
        </div>
      `;
      fileList.appendChild(div);

      div.querySelector('.btn-view').addEventListener('click', ()=> openPdf(item.url, item.name));

      if(getUserRole() === 'teacher'){
        div.querySelector('.btn-delete').addEventListener('click', async ()=>{
          if(!confirm('Delete this file?')) return;
          try{
            await supabase.from('files').delete().eq('id', item.id);
            if(item.path) await supabase.storage.from('files').remove([item.path]);
            div.remove();
          }catch(e){ alert('Delete failed: ' + (e.message || e)); }
        });
      }
    });

  }catch(err){
    console.error(err);
    fileList.innerHTML = '<div class="muted">Failed to load files</div>';
  }
}

/* ---------- open PDF modal ---------- */
function openPdf(url, name){
  pdfTitle.textContent = name;
  pdfFrame.src = url;
  pdfModal.style.display = 'flex';
}
closePdf.addEventListener('click', ()=> { pdfModal.style.display = 'none'; pdfFrame.src = ''; });

/* ---------- subject change reload ---------- */
subjectSelect.addEventListener('change', loadFiles);

/* ---------- user helpers ---------- */
function getUserRole(){
  try{
    const raw = localStorage.getItem('eanotes_user');
    if(!raw) return null;
    return JSON.parse(raw).role;
  }catch(e){ return null; }
}
function escapeHtml(s){ return String(s||'').replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function saveUser(obj){ localStorage.setItem('eanotes_user', JSON.stringify(obj)); }

/* ---------- finish login (exposed to login button) ---------- */
/* Called by loginHandler in index (we attach globally) */
window.finishLogin = function(role, name){
  // not used here; kept for compatibility
};

/* ---------- expose small API to login script ---------- */
window.appLoginSuccess = function(role, name){
  // store session and show dashboard
  saveUser({ role, name });
  roleTag.textContent = role === 'teacher' ? 'Teacher' : 'Student';
  welcomeText.textContent = role === 'teacher' ? 'Welcome, Teacher' : `Welcome, ${name}`;
  if(role === 'teacher') controlsRow.classList.remove('hidden'); else controlsRow.classList.add('hidden');
  showDashboard(true);
  // load initial subject files
  loadFiles();
};

/* ---------- use login button event defined earlier: attach direct mapping ---------- */
/* The login button already uses loginHandler (above) which calls finishLogin via saveUser & finishLogin wrapper */
