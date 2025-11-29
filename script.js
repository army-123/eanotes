/*********************************************************
  EA NOTES - CLEAN 2025 VERSION
  ✔ Full Login
  ✔ Roles
  ✔ Upload
  ✔ Delete
  ✔ PDF Preview
  ✔ Dark Mode
  ✔ Loading Animation
**********************************************************/

console.log("script.js loaded ✔");

// ---------------- FIREBASE INIT -----------------
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

// --------------- DOM -----------------
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

const themeToggle = document.getElementById("themeToggle");

// ---- NEW: LOADING SCREEN ----
const loadingOverlay = document.getElementById("loadingOverlay");
function showLoading() { loadingOverlay.style.display = "flex"; }
function hideLoading() { loadingOverlay.style.display = "none"; }

// State
let currentRole = "guest";
let filesCache = [];

// ---------------- DARK MODE ----------------
themeToggle.onclick = () => {
  document.body.classList.toggle("dark");
};

// ---------------- LOGIN ----------------
btnLogin.onclick = async () => {
  const val = usernameInput.value.trim();
  const pass = passwordInput.value;

  if (!val) return alert("Enter a name (student) or email (teacher)");

  showLoading();

  try {
    let cred;

    if (val.includes("@")) {
      // teacher login
      cred = await auth.signInWithEmailAndPassword(val, pass);
      await db.collection("users").doc(cred.user.uid).set({ role: "teacher" }, { merge: true });
      currentRole = "teacher";
    } else {
      // student login
      cred = await auth.signInAnonymously();
      await db.collection("users").doc(cred.user.uid).set(
        { name: val, role: "student" },
        { merge: true }
      );
      currentRole = "student";
    }

    userRole.textContent = currentRole;
    uploadBtn.style.display = currentRole === "teacher" ? "inline-block" : "none";

    loginArea.style.display = "none";
    mainArea.style.display = "block";

    await loadFiles();
  } catch (err) {
    console.error(err);
    alert(err.message);
  }

  hideLoading();
};

// ---------------- LOGOUT ----------------
btnLogout.onclick = async () => {
  showLoading();
  await auth.signOut();
  currentRole = "guest";
  userRole.textContent = "Not logged in";
  mainArea.style.display = "none";
  loginArea.style.display = "block";
  hideLoading();
};

// --------------- LOAD FILES ----------------
async function loadFiles() {
  showLoading();

  const subject = folderSelect.value;
  fileList.innerHTML = "Loading...";

  const snap = await db
    .col
