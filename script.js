/* =========================
   EA NOTES CLOUD - script.js
   Fixed version (Supabase client name corrected)
   ========================= */

/* ---------- Supabase config ---------- */
const SUPABASE_URL = "https://hlstgluwamsuuqlctdzk.supabase.co";
const SUPABASE_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhsc3RnbHV3YW1zdXVxbGN0ZHprIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQyNzMwMzQsImV4cCI6MjA3OTg0OTAzNH0.KUPx3pzrcd3H5aEx2B7mFosWNUVOEzXDD5gL-TmyawQ";

/* ❗ FIX: DO NOT overwrite supabase — use sb instead */
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON);

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

/* ---------- UI Helpers ---------- */
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
  } else {
    loginBox.style.display = 'block';
    dashboard.style.display = 'none';
  }
}

/* ---------- Theme Toggle ---------- */
(function attachThemeToggle(){
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

/* ---------- Login logic ---------- */
async function loginHandler(){
  setFeedback('');
  const name = loginName.value.trim();
  const pw = loginPassword.value.trim();

  if(!name || !pw){
    setFeedback('Enter both username and password', true);
    return;
  }

  showLoginLoading(true);
  await new Promise(r=>setTimeout(r, 350));

  if(pw === '@armyamanu'){
    finishLogin('student', name);
    return;
  }
  if(pw === '@teacher123'){
    finishLogin('teacher', name);
    return;
  }

  setFeedback('Incorrect password', true);
  showLoginLoading(false);
}

/* complete login */
function finishLogin(role, name){
  roleTag.textContent = role === 'teacher' ? 'Teacher' : 'Student';
  welcomeText.textContent = role === 'teacher' ? 'Welcome, Teacher' : `Welcome, ${name}`;
  setFeedback('');

  if(role === 'teacher'){
    controlsRow.classList.remove('hidden');
    uploadBtn.style.display = 'inline-flex';
  } else {
    controlsRow.classList.add('hidden');
  }

  localStorage.setItem('eanotes_user', JSON.stringify({ role, name }));
  showDashboard(true);
  showLoginLoading(false);
  loadFiles();
}

/* attach login events */
btnLogin.addEventListener('click', loginHandler);
loginPassword.addEventListener('keyup', e => { if(e.key === 'Enter') loginHandler(); });

/* auto-login */
(function autoSession(){
  try{
    const raw = localStorage.getItem('eanotes_user');
    if(!raw) return;
    const user = JSON.parse(raw);
    finishLogin(user.role, user.name);
  }catch(e){}
})();

/* ---------- logout ---------- */
logoutBtn.addEventListener('click', () => {
  localStorage.removeItem('eanotes_user');
  loginName.value = '';
  loginPassword.value = '';
  showDashboard(false);
});

/* ---------- Upload ---------- */
uploadBtn.addEventListener('click', () => realFileInput.click());

realFileInput.addEventListener('change', async ev => {
  const file = ev.target.files?.[0];
  if(!file) return;

  const raw = localStorage.getItem('eanotes_user');
  const user = raw ? JSON.parse(raw) : null;
  if(!user || user.role !== 'teacher'){
    alert('Only teachers can upload');
    return;
  }

  const subject = subjectSelect.value || 'General';
  const place = createUploadingRow(file.name, subject);

  try{
    const safe = encodeURIComponent(file.name.replace(/\s+/g,'_'));
    const path = `${subject}/${Date.now()}_${safe}`;

    /* ❗ FIX: use sb not supabase */
    const { error: upErr } = await sb.storage.from('files').upload(path, file, { upsert:true });
    if(upErr) throw upErr;

    const { data: urlData } = sb.storage.from('files').getPublicUrl(path);
    const publicUrl = urlData?.publicUrl || '';

    const insertObj = {
      name: file.name,
      subject,
      url: publicUrl,
      path,
      created_at: new Date().toISOString()
    };

    const { data: insData, error: insErr } =
      await sb.from('files').insert([insertObj]).select().single();
    if(insErr) throw insErr;

    place.done(insData);

  }catch(err){
    console.error(err);
    place.fail();
    alert('Upload failed: ' + err.message);
  }finally{
    ev.target.value = '';
  }
});

/* uploading row */
function createUploadingRow(filename, subject){
  const row = document.createElement('div');
  row.className = 'file-row uploading';
  row.innerHTML = `
    <div class="file-meta">
      <div class="file-title">${escapeHtml(filename)}</div>
      <div class="file-sub">Subject: ${escapeHtml(subject)} • Uploading… <span class="spinner-inline"></span></div>
      <div class="progress"><b style="width:4%"></b></div>
    </div>
  `;
  fileList.prepend(row);

  const bar = row.querySelector('.progress > b');
  let pct = 8;
  const t = setInterval(()=>{
    pct = Math.min(92, pct + Math.random()*12);
    bar.style.width = pct + '%';
  }, 300);

  return {
    done(data){
      clearInterval(t);
      bar.style.width = '100%';
      row.classList.remove('uploading');
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
      row.querySelector('.btn-view').onclick = () => openPdf(data.url, data.name);
      row.querySelector('.btn-delete').onclick = () => deleteFile(data, row);
    },
    fail(){
      clearInterval(t);
      row.querySelector('.file-sub').textContent = 'Upload failed';
      row.style.opacity = '0.6';
    }
  };
}

/* ---------- Load Files ---------- */
async function loadFiles(){
  fileList.innerHTML = '<div class="muted">Loading…</div>';
  const subject = subjectSelect.value;

  try{
    const { data, error } =
      await sb.from('files').select('*').eq('subject', subject).order('created_at', { ascending:false });

    if(error) throw error;

    fileList.innerHTML = '';

    if(!data || data.length === 0){
      fileList.innerHTML = '<div class="muted">No files for this subject.</div>';
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
          ${getUserRole()==='teacher' ? '<button class="btn-delete">Delete</button>' : ''}
        </div>
      `;
      fileList.appendChild(div);

      div.querySelector('.btn-view').onclick = () => openPdf(item.url, item.name);

      if(getUserRole()==='teacher'){
        div.querySelector('.btn-delete').onclick = () => deleteFile(item, div);
      }
    });

  }catch(err){
    console.error(err);
    fileList.innerHTML = '<div class="muted">Failed to load files.</div>';
  }
}

/* delete handler */
async function deleteFile(item, div){
  if(!confirm('Delete this file?')) return;
  try{
    await sb.from('files').delete().eq('id', item.id);
    if(item.path) await sb.storage.from('files').remove([item.path]);
    div.remove();
  }catch(e){
    alert('Delete failed: ' + e.message);
  }
}

/* ---------- PDF Modal ---------- */
function openPdf(url, name){
  pdfTitle.textContent = name;
  pdfFrame.src = url;
  pdfModal.style.display = 'flex';
}
closePdf.onclick = () => {
  pdfModal.style.display = 'none';
  pdfFrame.src = '';
};

/* reload on subject change */
subjectSelect.addEventListener('change', loadFiles);

/* helpers */
function getUserRole(){
  try{
    return JSON.parse(localStorage.getItem('eanotes_user'))?.role || null;
  }catch(e){
    return null;
  }
}
function escapeHtml(s){
  return String(s||'').replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
