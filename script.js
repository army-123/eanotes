/****************************************************
 * EA NOTES CLOUD — FINAL SUPABASE VERSION
 ****************************************************/

/* -----------------------------
   SUPABASE (UPLOAD + STORAGE)
----------------------------- */
const SUPABASE_URL = "https://hlstgluwamsuuqlctdzk.supabase.co";
const SUPABASE_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhsc3RnbHV3YW1zdXVxbGN0ZHprIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQyNzMwMzQsImV4cCI6MjA3OTg0OTAzNH0.KUPx3pzrcd3H5aEx2B7mFosWNUVOEzXDD5gL-TmyawQ";

const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON);

/* -----------------------------
   FIREBASE (AUTH + FIRESTORE)
----------------------------- */
const firebaseConfig = {
  apiKey: "AIzaSyAnUvU6tCpnO9oD4wdXbLS1o7jWpQuNPzE",
  authDomain: "army-6b712.firebaseapp.com",
  projectId: "army-6b712",
  storageBucket: "army-6b712.appspot.com",
  messagingSenderId: "468802966776",
  appId: "1:468802966776:web:57cc6f23da92b6f3f7d70d",
  measurementId: "G-HLGJB2NRRP"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

/****************************************************
 * UI ELEMENTS
 ****************************************************/
const loginArea = document.getElementById("loginArea");
const mainArea = document.getElementById("mainArea");
const username = document.getElementById("username");
const password = document.getElementById("password");
const userRole = document.getElementById("userRole");

const fileList = document.getElementById("fileList");
const fileUpload = document.getElementById("fileUpload");
const folderSelect = document.getElementById("folderSelect");

const loadingOverlay = document.getElementById("loadingOverlay");

const uploadContainer = document.getElementById("uploadProgressContainer");
const uploadBar = document.getElementById("uploadBar");
const uploadPercent = document.getElementById("uploadPercent");

const pdfOverlay = document.getElementById("pdfOverlay");
const pdfFrame = document.getElementById("pdfFrame");
const pdfName = document.getElementById("pdfName");

/****************************************************
 * HELPERS
 ****************************************************/
function showLoading() {
  loadingOverlay.style.display = "flex";
}
function hideLoading() {
  loadingOverlay.style.display = "none";
}

/****************************************************
 * LOGIN SYSTEM
 ****************************************************/
document.getElementById("btnLogin").onclick = async () => {
  const user = username.value.trim();
  const pass = password.value.trim();

  if (!user) return alert("Enter username or email");

  showLoading();

  // ---- Student login ----
  if (pass === "@armyamanu") {
    window.currentUser = { role: "student", name: user };

    loginArea.style.display = "none";
    mainArea.style.display = "block";
    document.getElementById("uploadBtn").style.display = "none";

    userRole.textContent = "student";
    loadFiles(folderSelect.value);

    hideLoading();
    return;
  }

  // ---- Teacher login (Firebase Auth) ----
  try {
    await auth.signInWithEmailAndPassword(user, pass);
  } catch (err) {
    alert("Login failed: " + err.message);
    hideLoading();
    return;
  }

  hideLoading();
};

/****************************************************
 * TEACHER AUTH LISTENER
 ****************************************************/
auth.onAuthStateChanged((user) => {
  if (user) {
    loginArea.style.display = "none";
    mainArea.style.display = "block";

    document.getElementById("uploadBtn").style.display = "block";

    userRole.textContent = "teacher";
    window.currentUser = { role: "teacher", email: user.email };

    loadFiles(folderSelect.value);
  }
});

/****************************************************
 * LOGOUT
 ****************************************************/
document.getElementById("btnLogout").onclick = () => {
  window.currentUser = null;
  auth.signOut();

  mainArea.style.display = "none";
  loginArea.style.display = "block";
};

/****************************************************
 * SUPABASE FILE UPLOAD ENGINE (FAST + PUBLIC)
 ****************************************************/
async function uploadToSupabase(file, subject) {
  uploadContainer.style.display = "block";

  const timestamp = Date.now();
  const path = `${subject}/${timestamp}_${file.name}`;

  // UPLOAD
  const { data, error } = await sb.storage
    .from("files")
    .upload(path, file, {
      cacheControl: "3600",
      upsert: false
    });

  if (error) {
    alert("Upload failed: " + error.message);
    uploadContainer.style.display = "none";
    return;
  }

  uploadBar.style.width = "100%";
  uploadPercent.textContent = "100%";

  // PUBLIC URL
  const { data: pub } = sb.storage
    .from("files")
    .getPublicUrl(path);

  // SAVE TO FIRESTORE
  await db.collection("files").add({
    name: file.name,
    url: pub.publicUrl,
    subject,
    time: timestamp
  });

  alert("Upload complete!");

  uploadContainer.style.display = "none";
  uploadBar.style.width = "0%";

  loadFiles(subject);
}

fileUpload.onchange = (e) => {
  const file = e.target.files[0];
  if (file) uploadToSupabase(file, folderSelect.value);
};

/****************************************************
 * LOAD FILES FROM FIRESTORE
 ****************************************************/
async function loadFiles(subject) {
  showLoading();
  fileList.innerHTML = "";

  const snap = await db.collection("files")
    .where("subject", "==", subject)
    .orderBy("time", "desc")
    .get();

  snap.forEach((doc) => {
    const d = doc.data();

    const row = document.createElement("div");
    row.className = "file-row";

    row.innerHTML = `
      <span>${d.name}</span>
      <div style="display:flex; gap:10px;">
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

        // Remove from Firestore
        await db.collection("files").doc(doc.id).delete();

        // Remove from Supabase bucket
        const removePath = `${subject}/${d.time}_${d.name}`;
        await sb.storage.from("files").remove([removePath]);

        loadFiles(subject);
      };
    }

    fileList.appendChild(row);
  });

  hideLoading();
}

folderSelect.onchange = () => loadFiles(folderSelect.value);

/****************************************************
 * CLOSE PDF VIEWER
 ****************************************************/
document.getElementById("closePdf").onclick = () => {
  pdfOverlay.style.display = "none";
  pdfFrame.src = "";
};

/****************************************************
 * DARK MODE
 ****************************************************/
document.getElementById("themeToggle").onclick = () => {
  document.body.classList.toggle("dark");
};
