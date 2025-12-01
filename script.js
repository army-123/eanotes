/* =========================
   EA NOTES CLOUD - script.js
   ========================= */

/* ---------- Supabase config (use your project values) ---------- */
const SUPABASE_URL = "https://hlstgluwamsuuqlctdzk.supabase.co";
const SUPABASE_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhsc3RnbHV3YW1zdXVxbGN0ZHprIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQyNzMwMzQsImV4cCI6MjA3OTg0OTAzNH0.KUPx3pzrcd3H5aEx2B7mFosWNUVOEzXDD5gL-TmyawQ";

/* ---------- ONLY ONE FIX: use correct Supabase client ---------- */
const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON);

/* ---------- DEVICE FINGERPRINT ---------- */
let deviceId = null;
const fpPromise = FingerprintJS.load();

async function getDeviceId() {
  const fp = await fpPromise;
  const result = await fp.get();
  deviceId = result.visitorId;
  return deviceId;
}

/* ======================================
   ONE DEVICE LOGIN PROTECTION (SAFE)
   ====================================== */
async function handleDeviceLock(username) {
  const device = await getDeviceId();

  const { data: row, error } = await sb
    .from("students_devices")
    .select("*")
    .eq("username", username)
    .single();

  if (!row) {
    setFeedback("❌ You are not registered. Contact admin.", true);
    showLoginLoading(false);
    throw new Error("Not registered");
  }

  if (!row.device_id) {
    await sb
      .from("students_devices")
      .update({
        device_id: device,
        last_login: new Date().toISOString(),
      })
      .eq("username", username);
    return;
  }

  if (row.device_id === device) return;

  setFeedback("❌ This account already logged in on another device.", true);
  showLoginLoading(false);
  throw new Error("Device mismatch");
}

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

/* ---------- theme toggle ---------- */
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

/* ======================================================
   NEW SECTION: Dynamic Subjects (add/remove via admin)
   ====================================================== */
async function loadSubjectsDropdown() {
  try {
    const { data, error } = await sb
      .from("subjects")
      .select("*")
      .order("name", { ascending: true });

    if (error) throw error;

    subjectSelect.innerHTML = "";

    data.forEach(sub => {
      const opt = document.createElement("option");
      opt.value = sub.name;
      opt.textContent = sub.name;
      subjectSelect.appendChild(opt);
    });

    loadFiles(); // refresh files after subjects load
  } catch (err) {
    console.error("Subject load error:", err);
  }
}

/* ---------- login logic ---------- */
async function loginHandler(){
  setFeedback('');
  const name = loginName.value.trim();
  const pw = loginPassword.value;

  if(!name || !pw){
    setFeedback('Enter both username and password', true);
    return;
  }

  showLoginLoading(true);
  await new Promise(r=>setTimeout(r, 450));

  if(pw === '@teacher123'){
    saveUser({ role:'teacher', name });
    finishLogin('teacher', name);
    return;
  }

  /* ⭐⭐⭐ ONLY THIS LINE CHANGED ⭐⭐⭐ */
  if (pw === '@student123') {
    const { data: studentRow, error: checkErr } = await sb
      .from("students_devices")
      .select("*")
      .eq("username", name)
      .single();

    if (checkErr || !studentRow) {
      setFeedback("❌ You are not registered. Contact admin.", true);
      showLoginLoading(false);
      return;
    }

    try {
      await handleDeviceLock(name);
    } catch (err) { return; }

    saveUser({ role:'student', name });
    finishLogin('student', name);
    return;
  }

  setFeedback('Incorrect password', true);
  showLoginLoading(false);
}

function finishLogin(role, name){
  roleTag.textContent = role === 'teacher' ? 'Teacher' : 'Student';
  welcomeText.textContent = role === 'teacher' ? `Welcome, Teacher` : `Welcome, ${escapeHtml(name)}`;

  if(role === 'teacher'){
    uploadBtn.style.display = 'inline-flex';
  } else {
    uploadBtn.style.display = 'none';
  }

  showDashboard(true);
  showLoginLoading(false);

  localStorage.setItem('eanotes_user', JSON.stringify({ role, name }));

  /* NEW: load dynamic subjects instead of static subjects */
  loadSubjectsDropdown();
}

btnLogin.addEventListener('click', loginHandler);
loginPassword.addEventListener('keyup', (e) => { if(e.key === 'Enter') loginHandler(); });

/* auto session */
(function autoSession(){
  const raw = localStorage.getItem('eanotes_user');
  if(!raw) return;
  try{
    const user = JSON.parse(raw);
    showDashboard(true);
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

/* ---------- upload logic (unchanged) ---------- */
uploadBtn.addEventListener('click', () => {
  realFileInput.click();
});

realFileInput.addEventListener('change', async (ev) => {
  const file = ev.target.files && ev.target.files[0];
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
      await sb.from('files').insert([insertObj]).select().limit(1).single();

    if(insErr) throw insErr;

    place.done(insData);
  }catch(err){
    console.error('upload err', err);
    place.fail();
    alert('Upload failed: ' + (err.message || JSON.stringify(err)));
  } finally {
    ev.target.value = '';
  }
});

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
  fileList.prepend(row);

  const bar = row.querySelector('.progress > b');

  let pct = 8;
  const t = setInterval(()=> {
    pct = Math.min(92, pct + Math.random()*12);
    bar.style.width = pct + '%';
  }, 300);

  return {
    done(data){
      clearInterval(t);
      bar.style.width = '100%';
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
      row.querySelector('.btn-view').addEventListener('click', ()=> openPdf(data.url, data.name));
      row.querySelector('.btn-delete').addEventListener('click', async ()=>{
        if(!confirm('Delete this file?')) return;
        try{
          await sb.from('files').delete().eq('id', data.id);

          if(data.path) await sb.storage.from('files').remove([data.path]);
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

/* ---------- load files ---------- */
async function loadFiles(){
  fileList.innerHTML = '<div class="muted">Loading files…</div>';
  const subject = subjectSelect.value;

  try{
    const { data, error } =
      await sb.from('files')
        .select('*')
        .eq('subject', subject)
        .order('created_at', { ascending:false });

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
            await sb.from('files').delete().eq('id', item.id);

            if(item.path) await sb.storage.from('files').remove([item.path]);
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

/* ---------- PDF modal ---------- */
function openPdf(url, name){
  pdfTitle.textContent = name || '';
  const viewer = `https://docs.google.com/gview?url=${encodeURIComponent(url)}&embedded=true`;
  pdfFrame.src = viewer;
  pdfModal.style.display = 'flex';
}
closePdf.addEventListener('click', ()=> { pdfModal.style.display = 'none'; pdfFrame.src = ''; });

subjectSelect.addEventListener('change', loadFiles);

/* ---------- helpers ---------- */
function getUserRole(){
  try{
    const raw = localStorage.getItem('eanotes_user');
    if(!raw) return null;
    return JSON.parse(raw).role;
  }catch(e){ return null; }
}
function escapeHtml(s){ return String(s||'').replace(/[&<>"']/g,
  c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c])); }
function saveUser(obj){ localStorage.setItem('eanotes_user', JSON.stringify(obj)); }
