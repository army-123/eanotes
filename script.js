/***************************************************
  FIREBASE INIT
***************************************************/
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

/***************************************************
  DOM ELEMENTS
***************************************************/
const usernameInput = document.getElementById("username");
const passwordInput = document.getElementById("password");
const btnLogin = document.getElementById("btnLogin");
const btnLogout = document.getElementById("btnLogout");

const loginArea = document.getElementById("loginArea");
const mainArea = document.getElementById("mainArea");
const uploadRow = document.getElementById("uploadRow");
const userRole = document.getElementById("userRole");

const fileUpload = document.getElementById("fileUpload");
const fileList = document.getElementById("fileList");
const folderSelect = document.getElementById("folderSelect");
const searchInput = document.getElementById("searchInput");
const btnRefresh = document.getElementById("btnRefresh");

const pdfOverlay = document.getElementById("pdfOverlay");
const pdfFrame = document.getElementById("pdfFrame");
const pdfName = document.getElementById("pdfName");
const closePdf = document.getElementById("closePdf");

/***************************************************
  LOGIN LOGIC
***************************************************/
let currentRole = null;
const TEACHER_PASS = "@teacher123";
const STUDENT_PASS = "@armyamanu";

btnLogin.addEventListener("click", async () => {
  console.log("LOGIN CLICKED");

  const pass = passwordInput.value.trim();
  const name = usernameInput.value.trim();

  if (pass === TEACHER_PASS) {
    currentRole = "teacher";
  } else if (pass === STUDENT_PASS) {
    if (!name) return alert("Students must enter a name.");
    currentRole = "student";
  } else {
    return alert("Incorrect password");
  }

  userRole.textContent = currentRole;
  loginArea.style.display = "none";
  mainArea.style.display = "grid";
  uploadRow.style.display = currentRole === "teacher" ? "flex" : "none";

  const user = await auth.signInAnonymously();
  await db.collection("users").doc(user.user.uid).set(
    { name, role: currentRole },
    { merge: true }
  );

  loadFiles();
});

/***************************************************
  LOGOUT
***************************************************/
btnLogout.addEventListener("click", () => {
  auth.signOut();
  loginArea.style.display = "block";
  mainArea.style.display = "none";
  usernameInput.value = "";
  passwordInput.value = "";
  userRole.textContent = "Not logged in";
});

/***************************************************
  LOAD FILES
***************************************************/
let filesCache = [];

async function loadFiles() {
  const subject = folderSelect.value;

  fileList.innerHTML = "<div class='muted'>Loading...</div>";

  const snap = await db
    .collection("files")
    .where("subject", "==", subject)
    .orderBy("time", "desc")
    .get();

  filesCache = [];
  snap.forEach(doc => filesCache.push({ ...doc.data(), id: doc.id }));

  renderFiles();
}

/***************************************************
  RENDER FILES
***************************************************/
function renderFiles() {
  const q = searchInput.value.toLowerCase();

  const filtered = filesCache.filter(f =>
    f.name.toLowerCase().includes(q)
  );

  if (filtered.length === 0) {
    fileList.innerHTML = "<div class='muted'>No files found.</div>";
    return;
  }

  fileList.innerHTML = filtered
    .map(
      f => `
        <div class="file-row">
          <div>
            <div style="font-weight:700">${f.name}</div>
            <div class="muted">${(f.size / 1024).toFixed(1)} KB</div>
          </div>

          <div style="display:flex;gap:6px">
            <button class="btn primary" onclick="previewPDF('${f.url}','${f.name}')">Preview</button>
            <a class="btn ghost" href="${f.url}" target="_blank">Open</a>
            ${
              currentRole === "teacher"
                ? `<button class="btn danger" onclick="deleteFile('${f.id}','${f.url}')">Delete</button>`
                : ""
            }
          </div>
        </div>`
    )
    .join("");
}

/***************************************************
  PDF PREVIEW
***************************************************/
function previewPDF(url, name) {
  pdfFrame.src = url;
  pdfName.textContent = name;
  pdfOverlay.style.display = "flex";
}

closePdf.addEventListener("click", () => {
  pdfOverlay.style.display = "none";
  pdfFrame.src = "";
});

/***************************************************
  UPLOAD FILE (Teacher)
***************************************************/
fileUpload.addEventListener("change", async e => {
  if (currentRole !== "teacher") return alert("Teachers only");

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
});

/***************************************************
  DELETE FILE
***************************************************/
async function deleteFile(id, url) {
  if (!confirm("Delete file?")) return;

  await db.collection("files").doc(id).delete();

  const path = decodeURIComponent(url.split("/o/")[1].split("?")[0]);
  await storage.ref().child(path).delete();

  loadFiles();
}

/***************************************************
  EVENTS
***************************************************/
searchInput.addEventListener("input", renderFiles);
folderSelect.addEventListener("change", loadFiles);
btnRefresh.addEventListener("click", loadFiles);
