/**********************************
   SUPABASE CONFIG
**********************************/
const SUPABASE_URL = "https://hlstgluwamsuuqlctdzk.supabase.co";
const SUPABASE_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhsc3RnbHV3YW1zdXVxbGN0ZHprIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQyNzMwMzQsImV4cCI6MjA3OTg0OTAzNH0.KUPx3pzrcd3H5aEx2B7mFosWNUVOEzXDD5gL-TmyawQ";

const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON);

/**********************************
   ELEMENTS
**********************************/
const roleSelect = document.getElementById("roleSelect");
const labelUser = document.getElementById("labelUser");
const username = document.getElementById("username");
const password = document.getElementById("password");
const loginBtn = document.getElementById("loginBtn");
const quickBtn = document.getElementById("quickBtn");
const logoutBtn = document.getElementById("logoutBtn");
const loginMsg = document.getElementById("loginMsg");

const uploadSection = document.getElementById("uploadSection");
const fileInput = document.getElementById("fileInput");
const uploadBtn = document.getElementById("uploadBtn");
const uploadProgress = document.getElementById("uploadProgress");
const uploadPercent = document.getElementById("uploadPercent");

const subjectSelect = document.getElementById("subjectSelect");

const fileList = document.getElementById("fileList");
const searchInput = document.getElementById("searchInput");

const themeToggle = document.getElementById("themeToggle");
const loadingOverlay = document.getElementById("loadingOverlay");

const pdfOverlay = document.getElementById("pdfOverlay");
const pdfFrame = document.getElementById("pdfFrame");
const pdfTitle = document.getElementById("pdfTitle");
const closePdf = document.getElementById("closePdf");

/**********************************
   UTIL
**********************************/
function showLoading() { loadingOverlay.style.display = "flex"; }
function hideLoading() { loadingOverlay.style.display = "none"; }

function msg(t, err = false) {
  loginMsg.textContent = t;
  loginMsg.style.color = err ? "#ff6b6b" : "var(--muted)";
}

function saveUser(obj) {
  localStorage.setItem("eanotes_user", JSON.stringify(obj));
}

function getUser() {
  try { return JSON.parse(localStorage.getItem("eanotes_user")); }
  catch { return null; }
}

/**********************************
   THEME
**********************************/
themeToggle.onclick = () => {
  document.body.classList.toggle("light");
  themeToggle.textContent = document.body.classList.contains("light") ? "☀️" : "🌙";
};

/**********************************
   ROLE CHANGE
**********************************/
roleSelect.onchange = () => {
  if (roleSelect.value === "teacher") {
    labelUser.textContent = "Teacher Email";
    username.placeholder = "teacher@example.com";
  } else {
    labelUser.textContent = "Student Name";
    username.placeholder = "Student name";
  }
};

/**********************************
   QUICK STUDENT
**********************************/
quickBtn.onclick = () => {
  roleSelect.value = "student";
  username.value = username.value || "Student";
  password.value = "@armyamanu";
  msg("Ready — click Login");
};

/**********************************
   LOGIN
**********************************/
loginBtn.onclick = async () => {
  msg("");
  showLoading();

  const role = roleSelect.value;
  const user = username.value.trim();
  const pw = password.value;

  if (!user || !pw) {
    msg("Fill all fields", true);
    hideLoading();
    return;
  }

  // student login
  if (role === "student") {
    if (pw !== "@armyamanu") {
      msg("Wrong student password", true);
      hideLoading();
      return;
    }

    saveUser({ role: "student", name: user });
    uploadSection.style.display = "none";  
    logoutBtn.style.display = "block";
    hideLoading();
    loadFiles();
    return;
  }

  // teacher login (Supabase Auth)
  try {
    const res = await sb.auth.signInWithPassword({ email: user, password: pw });
    if (res.error) throw res.error;

    saveUser({ role: "teacher", email: user });
    uploadSection.style.display = "block";
    logoutBtn.style.display = "block";

    msg("Logged in!");
    hideLoading();
    loadFiles();
  } catch (e) {
    msg(e.message, true);
    hideLoading();
  }
};

/**********************************
   LOGOUT
**********************************/
logoutBtn.onclick = async () => {
  await sb.auth.signOut();
  localStorage.removeItem("eanotes_user");
  uploadSection.style.display = "none";
  logoutBtn.style.display = "none";
  fileList.innerHTML = "";
  msg("Logged out");
};

/**********************************
   FILE UPLOAD
**********************************/
uploadBtn.onclick = () => {
  const f = fileInput.files[0];
  if (!f) return alert("Choose file first");
  uploadFile(f);
};

async function uploadFile(file) {
  const user = getUser();
  if (!user || user.role !== "teacher") return alert("Teacher only");

  showLoading();
  uploadProgress.style.display = "block";
  uploadPercent.textContent = "0%";

  try {
    const name = file.name;
    const subject = subjectSelect.value;
    const safe = encodeURIComponent(name.replace(/\s+/g,"_"));
    const path = `${subject}/${Date.now()}_${safe}`;

    // upload
    const { error: e1 } = await sb.storage.from("files").upload(path, file, { upsert: true });
    if (e1) throw e1;

    uploadPercent.textContent = "100%";

    // get URL
    const { data: pub } = sb.storage.from("files").getPublicUrl(path);

    // db insert
    const { error: e2 } = await sb.from("files").insert([{ 
      name,
      subject,
      path,
      url: pub.publicUrl,
      created_at: new Date().toISOString()
    }]);

    if (e2) throw e2;

    msg("Uploaded!");
    loadFiles();

  } catch (err) {
    alert("Upload error: " + err.message);
  }

  uploadProgress.style.display = "none";
  hideLoading();
}

/**********************************
   LOAD FILES
**********************************/
async function loadFiles() {
  const q = searchInput.value.trim();
  const subject = subjectSelect.value;

  fileList.innerHTML = "Loading...";

  try {
    let query = sb.from("files").select("*").eq("subject", subject).order("created_at",{ascending:false});
    if (q) query = query.ilike("name", `%${q}%`);

    const { data, error } = await query;
    if (error) throw error;

    if (!data.length) {
      fileList.innerHTML = "<div class='muted'>No files</div>";
      return;
    }

    fileList.innerHTML = "";

    const user = getUser();

    data.forEach(item => {
      const row = document.createElement("div");
      row.className = "fileRow";

      row.innerHTML = `
        <div>
          <div><b>${item.name}</b></div>
          <div class='muted'>${item.subject} • ${new Date(item.created_at).toLocaleString()}</div>
        </div>
        <div class="row" style="gap:6px">
          <button class="ghost" onclick="viewPDF('${item.url}','${item.name}')">View</button>
          ${user && user.role === "teacher" ? `<button class="danger" onclick="delFile('${item.id}','${item.path}')">Delete</button>` : ""}
        </div>
      `;

      fileList.appendChild(row);
    });

  } catch (e) {
    fileList.innerHTML = "Error loading files";
  }
}

/**********************************
   PDF VIEWER
**********************************/
window.viewPDF = (url, name) => {
  pdfTitle.textContent = name;
  pdfFrame.src = url;
  pdfOverlay.style.display = "flex";
};

closePdf.onclick = () => {
  pdfOverlay.style.display = "none";
  pdfFrame.src = "";
};

/**********************************
   DELETE FILE
**********************************/
window.delFile = async (id, path) => {
  if (!confirm("Delete file?")) return;

  try {
    const { error: e1 } = await sb.from("files").delete().eq("id", id);
    if (e1) throw e1;

    await sb.storage.from("files").remove([path]);

    loadFiles();
  } catch (err) {
    alert("Delete failed: " + err.message);
  }
};

/**********************************
   SEARCH
**********************************/
searchInput.oninput = () => {
  setTimeout(loadFiles, 200);
};

/**********************************
   INIT
**********************************/
(function init(){
  const user = getUser();
  if (user) {
    logoutBtn.style.display = "block";
    if (user.role === "teacher") uploadSection.style.display = "block";
    loadFiles();
  }
})();
