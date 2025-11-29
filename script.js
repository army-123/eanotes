/***************************************************
 Diagnostic + resilient script.js
 - Provides verbose console logs + friendly alerts
 - Optional: create teacher account if sign-in fails (for testing)
 - Keeps student anonymous flow
 - Reads role doc and shows upload controls
 - Intended for debugging/finalization; remove test-create flow before production
***************************************************/

const requiredSdkNotes = [
  "firebase", "firebase.auth", "firebase.firestore", "firebase.storage"
];

function sdkCheck() {
  try {
    if (!window.firebase) throw "firebase not found";
    if (!firebase.auth) throw "firebase.auth not found";
    if (!firebase.firestore) throw "firebase.firestore not found";
    if (!firebase.storage) throw "firebase.storage not found";
    console.info("Firebase SDKs present.");
    return true;
  } catch (e) {
    console.error("Firebase SDK check failed:", e);
    alert("Firebase SDKs not loaded. Make sure index.html includes firebase-app.js, firebase-auth.js, firebase-firestore.js and firebase-storage.js.");
    return false;
  }
}

if (!sdkCheck()) {
  // Stop here — the rest of the file assumes Firebase is available.
  throw new Error("Missing Firebase SDKs. See console message.");
}

/* ========== init ========== */
const firebaseConfig = {
  apiKey:"AIzaSyAnUvU6tCpnO9oD4wdXbLS1o7jWpQuNPzE",
  authDomain:"army-6b712.firebaseapp.com",
  projectId:"army-6b712",
  storageBucket:"army-6b712.appspot.com",
  messagingSenderId:"468802966776",
  appId:"1:468802966776:web:57cc6f23da92b6f3f7d70d"
};

try {
  // Avoid double init error if already initialized
  if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
  else console.info("Firebase already initialized.");
} catch (e) {
  console.error("Error initializing Firebase:", e);
  alert("Firebase initialization error — see console.");
  throw e;
}

const auth = firebase.auth();
const db = firebase.firestore();
const storage = firebase.storage();

/* ========== DOM ========= */
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

/* ========== STATE ========== */
let currentUser = null;
let currentRole = "guest";
let filesCache = [];

/* ========== THEME (unchanged simple) ========== */
(function initTheme() {
  const k = "ea_theme";
  const saved = localStorage.getItem(k);
  if (saved === "dark") document.body.classList.add("dark");
  else if (saved === "light") document.body.classList.remove("dark");
  else if (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches) document.body.classList.add("dark");
  if (themeToggle) themeToggle.onclick = () => {
    const next = document.body.classList.contains("dark") ? "light" : "dark";
    document.body.classList.toggle("dark");
    localStorage.setItem(k, next);
  };
})();

/* ========== Helpers & role loader ========== */
async function setRoleFromFirestore(uid) {
  try {
    const doc = await db.collection("users").doc(uid).get();
    if (doc.exists) {
      const data = doc.data();
      currentRole = data.role || "student";
    } else {
      // If missing, create student doc for anonymous users
      if (auth.currentUser && auth.currentUser.isAnonymous) {
        currentRole = "student";
        const name = usernameInput.value?.trim() || "Anonymous";
        await db.collection("users").doc(uid).set({ name, role: "student" }, { merge: true });
      } else {
        currentRole = "guest";
      }
    }
    console.info("Assigned role:", currentRole);
    userRoleLabel.textContent = currentRole;
    uploadRow.style.display = currentRole === "teacher" ? "flex" : "none";
    return currentRole;
  } catch (err) {
    console.error("Error reading/setting role:", err);
    currentRole = "guest";
    userRoleLabel.textContent = "guest";
    uploadRow.style.display = "none";
    return currentRole;
  }
}

/* ========== AUTH FLOW with diagnostics ========== */
btnLogin.addEventListener("click", async () => {
  try {
    const input = (usernameInput.value || "").trim();
    const pass = passwordInput.value || "";

    if (!input) {
      alert("Enter a name (student) or an email (teacher).");
      return;
    }

    // Heuristic: email-like -> teacher login
    const looksLikeEmail = input.includes("@");

    if (looksLikeEmail) {
      console.log("[LOGIN] Attempt teacher sign-in for:", input);
      try {
        const cred = await auth.signInWithEmailAndPassword(input, pass);
        currentUser = cred.user;
        console.log("[LOGIN] Teacher signed in:", currentUser.uid);
        await setRoleFromFirestore(currentUser.uid);
        onSuccessfulLogin();
      } catch (err) {
        console.error("[LOGIN] Teacher sign-in error:", err);
        if (err.code === "auth/user-not-found") {
          // optional: offer to create teacher account for quick testing
          const create = confirm("Teacher account not found. Do you want to create a TEST teacher account with this email & password (only for testing)?");
          if (create) {
            if (!pass) { alert("Please provide a password to create the teacher account."); return; }
            try {
              const newCred = await auth.createUserWithEmailAndPassword(input, pass);
              currentUser = newCred.user;
              // Create Firestore user doc with teacher role
              await db.collection("users").doc(currentUser.uid).set({ name: input.split("@")[0], role: "teacher" }, { merge: true });
              alert("Test teacher account created. You can remove it in Firebase Console later.");
              console.log("[LOGIN] Created test teacher:", currentUser.uid);
              await setRoleFromFirestore(currentUser.uid);
              onSuccessfulLogin();
            } catch (createErr) {
              console.error("[LOGIN] Error creating teacher account:", createErr);
              alert("Could not create teacher account: " + (createErr.message || createErr.code));
            }
          } else {
            alert("Teacher not found. Ask an admin to create your account.");
          }
        } else {
          // other auth errors
          alert("Login failed: " + (err.message || err.code));
        }
      }
    } else {
      // student anonymous
      console.log("[LOGIN] Attempt student anonymous sign-in with name:", input);
      // If already signed-in anonymously reuse
      if (auth.currentUser && auth.currentUser.isAnonymous) {
        currentUser = auth.currentUser;
        await db.collection("users").doc(currentUser.uid).set({ name: input, role: "student" }, { merge: true });
        await setRoleFromFirestore(currentUser.uid);
        onSuccessfulLogin();
      } else {
        const cred = await auth.signInAnonymously();
        currentUser = cred.user;
        console.log("[LOGIN] Anonymous uid:", currentUser.uid);
        await db.collection("users").doc(currentUser.uid).set({ name: input, role: "student" }, { merge: true });
        await setRoleFromFirestore(currentUser.uid);
        onSuccessfulLogin();
      }
    }
  } catch (outerErr) {
    console.error("[LOGIN] Unexpected error:", outerErr);
    alert("Unexpected login error - see console.");
  }
});

function onSuccessfulLogin() {
  loginArea.style.display = "none";
  mainArea.style.display = "grid";
  userRoleLabel.textContent = currentRole;
  console.info("Login complete. Role:", currentRole);
  loadFiles().catch(e => console.error("Error loading files after login:", e));
}

/* ========== LOGOUT ========= */
btnLogout && btnLogout.addEventListener("click", async () => {
  try {
    await auth.signOut();
    currentUser = null;
    currentRole = "guest";
    loginArea.style.display = "block";
    mainArea.style.display = "none";
    usernameInput.value = "";
    passwordInput.value = "";
    userRoleLabel.textContent = "Not logged in";
    console.info("User signed out.");
  } catch (e) {
    console.error("Sign-out error:", e);
    alert("Sign-out failed. See console.");
  }
});

/* ========== FILES ========= */
async function loadFiles() {
  const subject = folderSelect.value || "General";
  fileList.innerHTML = "<div class='muted'>Loading...</div>";
  try {
    const snap = await db.collection("files").where("subject", "==", subject).orderBy("time", "desc").get();
    filesCache = [];
    snap.forEach(d => filesCache.push({ ...d.data(), id: d.id }));
    renderFiles();
  } catch (err) {
    console.error("loadFiles failed:", err);
    fileList.innerHTML = "<div class='muted'>Failed to load files. See console.</div>";
    throw err;
  }
}

function renderFiles() {
  try {
    const q = (searchInput.value || "").toLowerCase();
    const filtered = filesCache.filter(f => f.name.toLowerCase().includes(q));
    if (filtered.length === 0) {
      fileList.innerHTML = "<div class='muted'>No files found.</div>";
      return;
    }
    fileList.innerHTML = filtered.map(f => {
      const safeUrl = (f.url || "").replace(/'/g,"\\'");
      const safeName = (f.name || "").replace(/'/g,"\\'");
      return `
        <div class="file-row">
          <div>
            <div style="font-weight:700">${f.name}</div>
            <div class="muted">${((f.size||0)/1024).toFixed(1)} KB</div>
          </div>
          <div style="display:flex;gap:6px">
            <button class="btn primary" onclick="previewPDF('${safeUrl}','${safeName}')">Preview</button>
            <a class="btn ghost" href="${f.url}" target="_blank" rel="noreferrer noopener">Open</a>
            ${currentRole === "teacher" ? `<button class="btn danger" onclick="deleteFile('${f.id}','${safeUrl}')">Delete</button>` : ""}
          </div>
        </div>
      `;
    }).join("");
  } catch (e) {
    console.error("renderFiles error:", e);
    fileList.innerHTML = "<div class='muted'>Render error. See console.</div>";
  }
}

/* ========== PREVIEW ========= */
window.previewPDF = (url, name) => {
  pdfFrame.src = url;
  pdfName.textContent = name;
  pdfOverlay.style.display = "flex";
};
closePdf && closePdf.addEventListener("click", () => {
  pdfOverlay.style.display = "none";
  pdfFrame.src = "";
});

/* ========== UPLOAD ========= */
fileUpload && fileUpload.addEventListener("change", async (e) => {
  try {
    if (currentRole !== "teacher") { alert("Only teachers can upload."); return; }
    const file = e.target.files[0];
    if (!file) return;
    const subject = folderSelect.value || "General";
    const path = `files/${subject}/${Date.now()}_${file.name}`;
    const ref = storage.ref().child(path);
    const task = ref.put(file);
    task.on("state_changed", snap => {
      const pct = (snap.bytesTransferred / snap.totalBytes) * 100;
      console.log("Upload", pct.toFixed(0) + "%");
    }, err => {
      console.error("Upload failed:", err);
      alert("Upload failed. See console.");
    }, async () => {
      const url = await ref.getDownloadURL();
      await db.collection("files").add({ subject, name: file.name, size: file.size, url, time: Date.now() });
      alert("Upload complete");
      loadFiles();
    });
  } catch (err) {
    console.error("Upload error:", err);
    alert("Upload error. See console.");
  }
});

/* ========== DELETE ========= */
window.deleteFile = async (id, url) => {
  try {
    if (currentRole !== "teacher") { alert("Only teachers can delete."); return; }
    if (!confirm("Delete file?")) return;
    await db.collection("files").doc(id).delete();
    try {
      const path = decodeURIComponent(url.split("/o/")[1].split("?")[0]);
      await storage.ref().child(path).delete();
    } catch (e) {
      console.warn("Storage delete best-effort failed:", e);
    }
    loadFiles();
  } catch (err) {
    console.error("Delete failed:", err);
    alert("Delete failed. See console.");
  }
};

/* ========== EVENTS ========= */
searchInput && searchInput.addEventListener("input", renderFiles);
folderSelect && folderSelect.addEventListener("change", loadFiles);
btnRefresh && btnRefresh.addEventListener("click", loadFiles);

/* ========== AUTH STATE ========= */
auth.onAuthStateChanged(async (u) => {
  currentUser = u;
  console.log("onAuthStateChanged:", !!u, u ? u.uid : null);
  if (u) {
    await setRoleFromFirestore(u.uid);
    if (mainArea.style.display !== "none") {
      loadFiles().catch(e => console.error("loadFiles error in state change:", e));
    }
  } else {
    currentRole = "guest";
    userRoleLabel.textContent = "Not logged in";
    uploadRow.style.display = "none";
  }
});

console.info("Diagnostic script loaded. Check console for step-by-step logs.");
