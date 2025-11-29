/******************************
 *  EA NOTES CLOUD - FULL WORKING SCRIPT
 *  With fast upload + correct Firebase config
 ******************************/

// Firebase config (YOUR REAL CONFIG)
const firebaseConfig = {
  apiKey: "AIzaSyAnUvU6tCpnO9oD4wdXbLS1o7jWpQuNPzE",
  authDomain: "army-6b712.firebaseapp.com",
  projectId: "army-6b712",
  storageBucket: "army-6b712.appspot.com",
  messagingSenderId: "468802966776",
  appId: "1:468802966776:web:57cc6f23da92b6f3f7d70d",
  measurementId: "G-HLGJB2NRRP"
};

// Initialize Firebase (V8 format)
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

/******************************
 * Loading Overlay
 ******************************/

function showLoading() {
  loadingOverlay.style.display = "flex";
}
function hideLoading() {
  loadingOverlay.style.display = "none";
}

/******************************
 * Dark Mode
 ******************************/

const themeToggle = document.getElementById("themeToggle");
themeToggle.addEventListener("click", () => {
  document.body.classList.toggle("dark");
  themeToggle.textContent = document.body.classList.contains("dark") ? "☀️" : "🌙";
});

/******************************
 * LOGIN SYSTEM
 ******************************/

btnLogin.addEventListener("click", async () => {
  const user = username.value.trim();
  const pass = password.value.trim();

  if (!user) return alert("Please enter username or email");

  showLoading();

  try {
    let isTeacher = pass.length > 0;

    if (isTeacher) {
      // Teacher login (email + password)
      await auth.signInWithEmailAndPassword(user, pass);
    } else {
      // Student login (anonymous)
      await auth.signInAnonymously();
    }

  } catch (err) {
    alert("Login failed: " + err.message);
    hideLoading();
  }
});

/******************************
 * AUTH STATE CHANGE
 ******************************/

auth.onAuthStateChanged(async (user) => {
  if (user) {
    loginArea.style.display = "none";
    mainArea.style.display = "block";

    let role = user.isAnonymous ? "student" : "teacher";
    userRole.textContent = role;

    uploadBtn.style.display = role === "teacher" ? "block" : "none";

    loadFiles(folderSelect.value);

  } else {
    loginArea.style.display = "block";
    mainArea.style.display = "none";
    userRole.textContent = "Not logged in";
  }
  hideLoading();
});

/******************************
 * LOGOUT
 ******************************/

btnLogout.addEventListener("click", () => {
  auth.signOut();
});

/******************************
 * FAST FILE UPLOAD (Resumable)
 ******************************/

async function uploadFile(file, subject) {
  showLoading();

  try {
    const timestamp = Date.now();
    const path = `files/${subject}/${timestamp}_${file.name}`;
    const storageRef = storage.ref(path);

    // Fast upload
    const uploadTask = storageRef.put(file);

    // Wait for finish
    await new Promise((resolve, reject) => {
      uploadTask.on("state_changed", null, reject, () => resolve());
    });

    // Get URL
    const url = await storageRef.getDownloadURL();

    // Save DB entry
    await db.collection("files").add({
      name: file.name,
      size: file.size,
      url: url,
      subject: subject,
      time: timestamp,
    });

    alert("Upload complete!");
    loadFiles(subject);

  } catch (error) {
    alert("Upload failed: " + error.message);
    console.error(error);
  }

  hideLoading();
}

fileUpload.addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const subject = folderSelect.value;
  await uploadFile(file, subject);
});

/******************************
 * LOAD FILES
 ******************************/

async function loadFiles(subject) {
  showLoading();

  fileList.innerHTML = "Loading...";

  try {
    const snap = await db
      .collection("files")
      .where("subject", "==", subject)
      .orderBy("time", "desc")
      .get();

    fileList.innerHTML = "";

    snap.forEach((doc) => {
      const data = doc.data();
      const row = document.createElement("div");
      row.className = "file-row";

      row.innerHTML = `
        <span>${data.name}</span>
        <div style="display:flex; gap:10px;">
          <button class="btn ghost viewBtn">View</button>
          ${auth.currentUser && !auth.currentUser.isAnonymous ? `
            <button class="btn danger deleteBtn">Delete</button>` : ""}
        </div>
      `;

      // View button
      row.querySelector(".viewBtn").addEventListener("click", () => {
        pdfName.textContent = data.name;
        pdfFrame.src = data.url;
        pdfOverlay.style.display = "flex";
      });

      // Delete button (teacher only)
      if (row.querySelector(".deleteBtn")) {
        row.querySelector(".deleteBtn").addEventListener("click", async () => {
          if (!confirm("Delete file?")) return;

          await db.collection("files").doc(doc.id).delete();
          await storage.ref(`files/${subject}/${data.time}_${data.name}`).delete();

          loadFiles(subject);
        });
      }

      fileList.appendChild(row);
    });

  } catch (err) {
    alert("Could not load files: " + err.message);
  }

  hideLoading();
}

folderSelect.addEventListener("change", () => loadFiles(folderSelect.value));
btnRefresh.addEventListener("click", () => loadFiles(folderSelect.value));

/******************************
 * PDF Viewer Close
 ******************************/

closePdf.addEventListener("click", () => {
  pdfOverlay.style.display = "none";
  pdfFrame.src = "";
});
