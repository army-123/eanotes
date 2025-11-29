/************************************************************
 FULLY WORKING CLEAN SCRIPT.JS
 ************************************************************/

console.log("script.js is running ✔");

// -------------------- FIREBASE INIT -----------------------
const firebaseConfig = {
  apiKey: "AIzaSyAnUvU6tCpnO9oD4wdXbLS1o7jWpQuNPzE",
  authDomain: "army-6b712.firebaseapp.com",
  projectId: "army-6b712",
  storageBucket: "army-6b712.appspot.com",
  messagingSenderId: "468802966776",
  appId: "1:468802966776:web:57cc6f23da92b6f3f7d70d"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();
const storage = firebase.storage();

// -------------------- DOM ELEMENTS ------------------------
const loginArea = document.getElementById("loginArea");
const mainArea = document.getElementById("mainArea");
const usernameInput = document.getElementById("username");
const passwordInput = document.getElementById("password");
const btnLogin = document.getElementById("btnLogin");
const btnLogout = document.getElementById("btnLogout");
const userRole = document.getElementById("userRole");

const uploadBtn = document.getElementById("uploadBtn");
const fileUpload = document.getElementById("fileUpload");

const folderSelect = document.getElementById("folderSelect");
const fileList = document.getElementById("fileList");
const searchInput = document.getElementById("searchInput");
const btnRefresh = document.getElementById("btnRefresh");

const pdfOverlay = document.getElementById("pdfOverlay");
const pdfFrame = document.getElementById("pdfFrame");
const pdfName = document.getElementById("pdfName");
const closePdf = document.getElementById("closePdf");

let currentRole = "guest";
let filesCache = [];

// -------------------- LOGIN LOGIC --------------------------
btnLogin.onclick = async () => {
  const userValue = usernameInput.value.trim();
  const passValue = passwordInput.value;

  if (!userValue) return alert("Enter student name or teacher email.");

  try {
    let user;

    if (userValue.includes("@")) {
      // TEACHER LOGIN
      user = await auth.signInWithEmailAndPassword(userValue, passValue);
      await db.collection("users").doc(user.user.uid).set({ role: "teacher" }, { merge: true });
      currentRole = "teacher";

    } else {
      // STUDENT LOGIN
      user = await auth.signInAnonymously();
      await db.collection("users").doc(user.user.uid).set({ name: userValue, role: "student" }, { merge: true });
      currentRole = "student";
    }

    userRole.textContent = currentRole;
    loginArea.style.display = "none";
    mainArea.style.display = "block";

    uploadBtn.style.display = currentRole === "teacher" ? "inline-block" : "none";
    loadFiles();

  } catch (err) {
    console.error(err);
    alert(err.message);
  }
};

// -------------------- LOGOUT -------------------------------
btnLogout.onclick = async () => {
  await auth.signOut();
  loginArea.style.display = "block";
  mainArea.style.display = "none";
  userRole.textContent = "Not logged in";
};

// -------------------- LOAD FILES ----------------------------
async function loadFiles() {
  const subject = folderSelect.value;
  fileList.innerHTML = "Loading...";

  const snap = await db.collection("files")
    .where("subject", "==", subject)
    .orderBy("time", "desc")
    .get();

  filesCache = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  renderFiles();
}

// -------------------- RENDER FILES --------------------------
function renderFiles() {
  const q = searchInput.value.toLowerCase();
  const filtered = filesCache.filter(f => f.name.toLowerCase().includes(q));

  if (filtered.length === 0) {
    fileList.innerHTML = "No files found.";
    return;
  }

  fileList.innerHTML = filtered.map(f => `
    <div class="file-row">
      <div>
        <b>${f.name}</b><br>
        <small>${(f.size / 1024).toFixed(1)} KB</small>
      </div>
      <div>
        <button class="btn primary" onclick="previewPDF('${f.url}','${f.name}')">Preview</button>
        ${currentRole === "teacher" ? `<button class="btn danger" onclick="deleteFile('${f.id}','${f.url}')">Delete</button>` : ""}
      </div>
    </div>
  `).join("");
}

// -------------------- PREVIEW PDF ---------------------------
window.previewPDF = (url, name) => {
  pdfFrame.src = url;
  pdfName.textContent = name;
  pdfOverlay.style.display = "flex";
};

closePdf.onclick = () => {
  pdfOverlay.style.display = "none";
  pdfFrame.src = "";
};

// -------------------- UPLOAD FILE ---------------------------
fileUpload.onchange = async (e) => {
  if (currentRole !== "teacher") return alert("Only teachers can upload!");

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

// -------------------- DELETE FILE ---------------------------
window.deleteFile = async (id, url) => {
  if (currentRole !== "teacher") return;

  await db.collection("files").doc(id).delete();
  const path = decodeURIComponent(url.split("/o/")[1].split("?")[0]);
  await storage.ref().child(path).delete();

  loadFiles();
};

// -------------------- EVENTS -------------------------------
btnRefresh.onclick = loadFiles;
folderSelect.onchange = loadFiles;
searchInput.oninput = renderFiles;

console.log("All listeners attached ✔");
