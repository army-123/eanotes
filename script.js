/* =========================
   EA NOTES CLOUD - FIXED
   ========================= */

const SUPABASE_URL = "https://hlstgluwamsuuqlctdzk.supabase.co";
const SUPABASE_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...";

const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON);

/* DOM */
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

/* Viewer */
const docModal = document.getElementById("docModal");
const docFrame = document.getElementById("docFrame");
const docTitle = document.getElementById("docTitle");
const closeDoc = document.getElementById("closeDoc");

/* ============================
   LOGIN
============================= */
function showLoginLoading(s){
  btnLogin.disabled = s;
  btnLoginSpinner.style.display = s ? "inline-block" : "none";
  btnLoginText.textContent = s ? "Logging in…" : "Login";
}

async function loginHandler(){
  loginFeedback.textContent = "";

  const name = loginName.value.trim();
  const pw = loginPassword.value;

  if(!name || !pw){
    loginFeedback.textContent = "Enter username & password";
    loginFeedback.style.color = "var(--danger)";
    return;
  }

  showLoginLoading(true);
  await new Promise(r=>setTimeout(r,400));

  if(pw === "@armyamanu"){
    finishLogin("student", name);
    return;
  }
  if(pw === "@teacher123"){
    finishLogin("teacher", name);
    return;
  }

  loginFeedback.textContent = "Incorrect Password";
  loginFeedback.style.color = "var(--danger)";
  showLoginLoading(false);
}

btnLogin.onclick = loginHandler;
loginPassword.addEventListener("keyup", e => { if(e.key==="Enter") loginHandler(); });

function finishLogin(role, name){
  roleTag.textContent = role === "teacher" ? "Teacher" : "Student";
  welcomeText.textContent = role === "teacher" ? "Welcome, Teacher" : `Welcome, ${name}`;

  if(role === "student"){
    uploadBtn.style.display = "none";   // HIDE upload
  }

  localStorage.setItem("eanotes_user", JSON.stringify({ role, name }));

  showLoginLoading(false);
  loginBox.style.display = "none";
  dashboard.style.display = "block";

  loadFiles();
}

/* auto login */
(function(){
  const raw = localStorage.getItem("eanotes_user");
  if(raw){
    const u = JSON.parse(raw);
    finishLogin(u.role, u.name);
  }
})();

/* LOGOUT */
logoutBtn.onclick = () => {
  localStorage.removeItem("eanotes_user");
  loginName.value="";
  loginPassword.value="";
  dashboard.style.display="none";
  loginBox.style.display="block";
};

/* ============================
   UPLOAD (teacher only)
============================= */

uploadBtn.onclick = () => realFileInput.click();

realFileInput.onchange = async ev => {
  const file = ev.target.files?.[0];
  if(!file) return;

  const user = JSON.parse(localStorage.getItem("eanotes_user") || "{}");
  if(user.role !== "teacher"){
    alert("Only teachers can upload");
    return;
  }

  const subject = subjectSelect.value;
  const safe = encodeURIComponent(file.name.replace(/\s+/g,"_"));
  const path = `${subject}/${Date.now()}_${safe}`;

  try{
    await sb.storage.from("files").upload(path, file, { upsert:true });

    const { data: urlData } = sb.storage.from("files").getPublicUrl(path);

    await sb.from("files").insert({
      name:file.name,
      subject,
      url:urlData.publicUrl,
      path,
      created_at:new Date().toISOString()
    });

    loadFiles();
  }catch(e){
    alert("Upload failed");
  }

  realFileInput.value = "";
};

/* ============================
   LOAD FILE LIST
============================= */
async function loadFiles(){
  fileList.innerHTML = "Loading…";

  const { data } = await sb.from("files")
      .select("*")
      .eq("subject", subjectSelect.value)
      .order("created_at", { ascending:false });

  fileList.innerHTML = "";

  if(!data || data.length === 0){
    fileList.innerHTML = "<div class='muted'>No files yet</div>";
    return;
  }

  data.forEach(item => {
    const row = document.createElement("div");
    row.className = "file-row";
    row.innerHTML = `
      <div class="file-meta">
        <div class="file-title">${item.name}</div>
        <div class="file-sub">${item.subject} • ${new Date(item.created_at).toLocaleString()}</div>
      </div>
      <div class="file-actions">
        <button class="btn-view">View</button>
      </div>
    `;

    row.querySelector(".btn-view").onclick = () => openDoc(item.url, item.name);

    fileList.appendChild(row);
  });
}

subjectSelect.onchange = loadFiles;

/* ============================
   FULL-SCREEN DOCUMENT VIEWER
============================= */

function openDoc(url, name){
  // Google Docs viewer supports pdf, doc, ppt
  const gview = `https://docs.google.com/gview?url=${encodeURIComponent(url)}&embedded=true`;

  docTitle.textContent = name;
  docFrame.src = gview;
  docModal.style.display = "flex";
}

closeDoc.onclick = () => {
  docModal.style.display = "none";
  docFrame.src = "";
};
