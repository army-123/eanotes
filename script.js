/******************************
 * EA NOTES CLOUD - FULL SYSTEM
 * Student login = name + password "@armyamanu"
 * Teacher login = Firebase email + password
 ******************************/

// Firebase config
const firebaseConfig = {
  apiKey: "AIzaSyAnUvU6tCpnO9oD4wdXbLS1o7jWpQuNPzE",
  authDomain: "army-6b712.firebaseapp.com",
  projectId: "army-6b712",
  storageBucket: "army-6b712.appspot.com",
  messagingSenderId: "468802966776",
  appId: "1:468802966776:web:57cc6f23da92b6f3f7d70d",
  measurementId: "G-HLGJB2NRRP"
};

// Init Firebase v8
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();
const storage = firebase.storage();

/******************************
 * UI Elements
 ******************************/

const loginArea = document.getElementById("loginArea");
const mainArea = document.getElementById("mainArea");
const btnLogin = document.getElementById("btnLogin");
const btnLogout = document.getElementById("btnLogout");
const username = document.getElementById("username");
const password = document.getElementById("password");
const folderSelect = document.getElementById("folderSelect");
const fileUpload = document.getElementById("fileUpload");
const uploadBtn = document.getElementById("uploadBtn");
const fileList = document.getElementById("fileList");
const searchInput = document.getElementById("searchInput");
const loadingOverlay = document.getElementById("loadingOverlay");
const userRole = document.getElementById("userRole");
const btnRefresh = document.getElementById("btnRefresh");

const pdfOverlay = document.getElementById("pdfOverlay");
const pdfFrame = document.getElementById("pdfFrame");
const pdfName = document.getElementById("pdfName");
const closePdf = document.getElementById("closePdf");

const uploadContainer = document.getElementById("uploadProgressContainer");
const uploadBar = document.getElementById("uploadBar");
const uploadPercent = document.getElementById("uploadPercent");

/******************************
 * Loading overlay
 ******************************/

function showLoading() { loadingOverlay.style.display = "flex"; }
function hideLoading() { loadingOverlay.style.display = "none"; }

/******************************
 * Dark mode
 ******************************/

document.getElementById("themeToggle").onclick = () => {
  document.body.classList.toggle("dark");
};

/******************************
 * LOGIN SYSTEM
 ******************************/

btnLogin.onclick = async () => {
  const name = username.value.trim();
  const pass = password.value.trim();

  if (!name) return alert("Enter your name or teacher email");

  showLoading();

  // STUDENT LOGIN
  if (pass === "@armyamanu") {
    window.currentUser = { role: "student", name };
    loginArea.style.display = "none";
    mainArea.style.display = "block";
    uploadBtn.style.display = "none";
    userRole.textContent = "student";
    loadFiles(folderSelect.value);
    hideLoading();
    return;
  }

  // TEACHER LOGIN
  try {
    await auth.signInWithEmailAndPassword(name, pass);
  } catch (e) {
    alert("Login failed: " + e.message);
    hideLoading();
  }
};

/******************************
 * TEACHER AUTH STATE
 ******************************/

auth.onAuthStateChanged((user) => {
  if (user) {
    loginArea.style.display = "none";
    mainArea.style.display = "block";
    uploadBtn.style.display = "block";
    userRole.textContent = "teacher";
    window.currentUser = { role: "teacher", email: user.email };
    loadFiles(folderSelect.value);
  } else {
    if (!window.currentUser || window.currentUser.role !== "student") {
      mainArea.style.display = "none";
      loginArea.style.display = "block";
      userRole.textContent = "Not logged in";
    }
  }
});

/******************************
 * LOGOUT
 ******************************/

btnLogout.onclick = () => {
  window.currentUser = null;
  auth.signOut();
  loginArea.style.display = "block";
  mainArea.style.display = "none";
};

/******************************
 * TURBO UPLOAD ENGINE
 ******************************/

async function uploadFile(file, subject) {
  showLoading();
  uploadContainer.style.display = "block";

  const timestamp = Date.now();
  const path = `files/${subject}/${timestamp}_${file.name}`;
  const ref = storage.ref(path);

  const task = ref.put(file);

  task.on(
    "state_changed",
    snap => {
      let pct = Math.round((snap.bytesTransferred / snap.totalBytes) * 100);
      uploadBar.style.width = pct + "%";
      uploadPercent.textContent = pct + "%";
    },
    err => alert("Upload error: " + err.message),
    async () => {
      const url = await ref.getDownloadURL();

      await db.collection("files").add({
        name: file.name,
        size: file.size,
        url,
        subject,
        time: timestamp
      });

      alert("Upload complete!");
      uploadContainer.style.display = "none";
      uploadBar.style.width = "0%";
      loadFiles(subject);
      hideLoading();
    }
  );
}

fileUpload.onchange = e => {
  const file = e.target.files[0];
  if (file) uploadFile(file, folderSelect.value);
};

/******************************
 * LOAD FILES
 ******************************/

async function loadFiles(subject) {
  showLoading();
  fileList.innerHTML = "";

  const snap = await db
    .collection("files")
    .where("subject", "==", subject)
    .orderBy("time", "desc")
    .get();

  fileList.innerHTML = "";

  snap.forEach(doc => {
    const d = doc.data();

    const row = document.createElement("div");
    row.className = "file-row";

    row.innerHTML = `
      <span>${d.name}</span>
      <div style="display:flex;gap:10px;">
        <button class="btn ghost viewBtn">View</button>
        ${window.currentUser.role === "teacher"
          ? `<button class="btn danger deleteBtn">Delete</button>`
          : ""}
      </div>
    `;

    row.querySelector(".viewBtn").onclick = () => {
      pdfName.textContent = d.name;
      pdfFrame.src = d.url;
      pdfOverlay.style.display = "flex";
    };

    if (window.currentUser.role === "teacher") {
      row.querySelector(".deleteBtn").onclick = async () => {
        if (!confirm("Delete this file?")) return;
        await db.collection("files").doc(doc.id).delete();
        await storage.ref(`files/${subject}/${d.time}_${d.name}`).delete();
        loadFiles(subject);
      };
    }

    fileList.appendChild(row);
  });

  hideLoading();
}

folderSelect.onchange = () => loadFiles(folderSelect.value);
btnRefresh.onclick = () => loadFiles(folderSelect.value);

/******************************
 * CLOSE PDF VIEWER
 ******************************/

closePdf.onclick = () => {
  pdfOverlay.style.display = "none";
  pdfFrame.src = "";
};
