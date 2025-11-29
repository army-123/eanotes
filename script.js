/***************************************************
  SECURE & CLEANED script.js
  - Teacher login: email + password
  - Student login: anonymous + name
  - Role is read from Firestore
  - Fully working upload/preview/delete
  - Dark mode with persistence
***************************************************/

/* ================== FIREBASE INIT ================== */
const firebaseConfig = {
  apiKey:"AIzaSyAnUvU6tCpnO9oD4wdXbLS1o7jWpQuNPzE",
  authDomain:"army-6b712.firebaseapp.com",
  projectId:"army-6b712",
  storageBucket:"army-6b712.appspot.com",
  messagingSenderId:"468802966776",
  appId:"1:468802966776:web:57cc6f23da92b6f3f7d70d"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();
const storage = firebase.storage();

/* ================== DOM ================== */
const usernameInput = document.getElementById("username");
const passwordInput = document.getElementById("password");
const btnLogin = document.getElementById("btnLogin");
const btnLogout = document.getElementById("btnLogout");

const loginArea = document.getElementById("loginArea");
const mainArea = document.getElementById("mainArea");
const uploadRow = document.getElementById("uploadRow");
const userRoleLabel = document.getElementById("userRole");

const fileUpload = document.getElementById("fileUpload");
const fileList = document.getElementById("fileList");
const searchInput = document.getElementById("searchInput");
const folderSelect = document.getElementById("folderSelect");
const btnRefresh = document.getElementById("btnRefresh");

const pdfOverlay = document.getElementById("pdfOverlay");
const pdfFrame = document.getElementById("pdfFrame");
const pdfName = document.getElementById("pdfName");
const closePdf = document.getElementById("closePdf");

const themeToggle = document.getElementById("themeToggle");

/* ================== STATE ================== */
let currentUser = null;
let currentRole = "guest";
let filesCache = [];

/* ================== DARK MODE ================== */
function applyTheme(t) {
  if (t === "dark") document.body.classList.add("dark");
  else document.body.classList.remove("dark");
  localStorage.setItem("ea_theme", t);
}

(function initTheme() {
  const saved = localStorage.getItem("ea_theme");
  if (saved) applyTheme(saved);
  else applyTheme(window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");

  themeToggle.onclick = () => {
    const next = document.body.classList.contains("dark") ? "light" : "dark";
    applyTheme(next);
  };
})();

/* ================== ROLE FETCH ================== */
async function loadRole(uid) {
  const snap = await db.collection("users").doc(uid).get();
  if (snap.exists) {
    const data = snap.data();
    currentRole = data.role || "student";
  } else {
    currentRole = "student";
    await db.collection("users").doc(uid).set({ role:"student" }, { merge:true });
  }

  userRoleLabel.textContent = currentRole;
  uploadRow.style.display = currentRole === "teacher" ? "flex" : "none";
}

/* ================== LOGIN LOGIC ================== */
btnLogin.onclick = async () => {
  const userValue = usernameInput.value.trim();
  const passValue = passwordInput.value;

  if (!userValue) return alert("Enter name (student) or email (teacher)");

  try {
    if (userValue.includes("@")) {
      // TEACHER LOGIN
      if (!passValue) return alert("Teachers must enter password");
      const cred = await auth.signInWithEmailAndPassword(userValue, passValue);
      currentUser = cred.user;
    } else {
      // STUDENT LOGIN
      const cred = await auth.signInAnonymously();
      currentUser = cred.user;
      await db.collection("users").doc(currentUser.uid).set({
        name: userValue,
        role: "student"
      }, { merge:true });
    }

    await loadRole(currentUser.uid);

    loginArea.style.display = "none";
    mainArea.style.display = "grid";

    loadFiles();

  } catch (err) {
    console.error(err);
    alert(err.message);
  }
};

/* ================== LOGOUT ================== */
btnLogout.onclick = async () => {
  await auth.signOut();
  currentRole = "guest";
  userRoleLabel.textContent = "Not logged in";
  loginArea.style.display = "block";
  mainArea.style.display = "none";
};

/* ================== FILE SYSTEM ================== */
async function loadFiles() {
  fileList.innerHTML = "<div class='muted'>Loading...</div>";

  const subject = folderSelect.value;
  const snap = await db.collection("files")
    .where("subject","==",subject)
    .orderBy("time","desc")
    .get();

  filesCache = [];
  snap.forEach(doc => filesCache.push({ ...doc.data(), id: doc.id }));

  renderFiles();
}

function renderFiles() {
  const q = searchInput.value.toLowerCase();
  const filtered = filesCache.filter(f => f.name.toLowerCase().includes(q));

  if (filtered.length === 0) {
    fileList.innerHTML = "<div class='muted'>No files found.</div>";
    return;
  }

  fileList.innerHTML = filtered.map(f => `
    <div class="file-row">
      <div>
        <div style="font-weight:700">${f.name}</div>
        <div class="muted">${(f.size/1024).toFixed(1)} KB</div>
      </div>

      <div style="display:flex; gap:6px;">
        <button class="btn primary" onclick="previewPDF('${f.url}','${f.name.replace(/'/g,'\\\'')}')">Preview</button>
        <a class="btn ghost" href="${f.url}" target="_blank">Open</a>
        ${currentRole === "teacher" ? `<button class="btn danger" onclick="deleteFile('${f.id}','${f.url}')">Delete</button>` : ""}
      </div>
    </div>
  `).join("");
}

/* ================== PREVIEW PDF ================== */
window.previewPDF = (url, name) => {
  pdfFrame.src = url;
  pdfName.textContent = name;
  pdfOverlay.style.display = "flex";
};

closePdf.onclick = () => {
  pdfOverlay.style.display = "none";
  pdfFrame.src = "";
};

/* ================== UPLOAD (TEACHER ONLY) ================== */
fileUpload.onchange = async e => {
  if (currentRole !== "teacher") return alert("Only teachers can upload.");

  const file = e.target.files[0];
  if (!file) return;

  const subject = folderSelect.value;
  const path = `files/${subject}/${Date.now()}_${file.name}`;
  const ref = storage.ref().child(path);

  await ref.put(file);
  const url = await ref.getDownloadURL();

  await db.collection("files").add({
    subject,
    name: file.name,
    size: file.size,
    url,
    time: Date.now()
  });

  loadFiles();
};

/* ================== DELETE FILE ================== */
window.deleteFile = async (id, url) => {
  if (currentRole !== "teacher") return alert("Only teachers can delete files.");
  if (!confirm("Delete file?")) return;

  await db.collection("files").doc(id).delete();

  const path = decodeURIComponent(url.split("/o/")[1].split("?")[0]);
  await storage.ref().child(path).delete();

  loadFiles();
};

/* ================== EVENTS ================== */
searchInput.oninput = renderFiles;
folderSelect.onchange = loadFiles;
btnRefresh.onclick = loadFiles;
