/* =========================
   EA NOTES CLOUD - script.js
   FINAL WORKING VERSION
   ========================= */

/* ---------- Supabase config ---------- */
const SUPABASE_URL = "https://hlstgluwamsuuqlctdzk.supabase.co";
const SUPABASE_ANON =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhsc3RnbHV3YW1zdXVxbGN0ZHprIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQyNzMwMzQsImV4cCI6MjA3OTg0OTAzNH0.KUPx3pzrcd3H5aEx2B7mFosWNUVOEzXDD5gL-TmyawQ";

const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON);

/* ---------- DOM ---------- */
const loginBox = document.getElementById("loginBox");
const loginName = document.getElementById("loginName");
const loginPassword = document.getElementById("loginPassword");
const btnLogin = document.getElementById("btnLogin");
const loginFeedback = document.getElementById("loginFeedback");

const dashboard = document.getElementById("dashboard");
const roleTag = document.getElementById("roleTag");
const welcomeText = document.getElementById("welcomeText");
const uploadBtn = document.getElementById("uploadBtn");
const realFileInput = document.getElementById("realFileInput");
const fileList = document.getElementById("fileList");
const subjectSelect = document.getElementById("subjectSelect");
const logoutBtn = document.getElementById("logoutBtn");

/* ---------- Login Logic ---------- */
btnLogin.addEventListener("click", loginHandler);
loginPassword.addEventListener("keyup", (e) => {
  if (e.key === "Enter") loginHandler();
});

function loginHandler() {
  const name = loginName.value.trim();
  const pw = loginPassword.value.trim();

  if (!name || !pw) {
    loginFeedback.textContent = "Enter both username and password";
    loginFeedback.style.color = "red";
    return;
  }

  if (pw === "@armyamanu") return finishLogin("student", name);
  if (pw === "@teacher123") return finishLogin("teacher", name);

  loginFeedback.textContent = "Incorrect password";
  loginFeedback.style.color = "red";
}

function finishLogin(role, name) {
  roleTag.textContent = role;
  welcomeText.textContent = `Welcome, ${name}`;

  // Only teacher sees upload button
  uploadBtn.style.display = role === "teacher" ? "inline-flex" : "none";

  localStorage.setItem("eanotes_user", JSON.stringify({ role, name }));

  loginBox.style.display = "none";
  dashboard.style.display = "block";

  loadFiles();
}

/* Auto login if session saved */
(function () {
  const saved = localStorage.getItem("eanotes_user");
  if (saved) {
    const user = JSON.parse(saved);
    finishLogin(user.role, user.name);
  }
})();

/* ---------- Logout ---------- */
logoutBtn.addEventListener("click", () => {
  localStorage.removeItem("eanotes_user");
  dashboard.style.display = "none";
  loginBox.style.display = "block";
});

/* ---------- Upload File ---------- */
uploadBtn.addEventListener("click", () => realFileInput.click());

realFileInput.addEventListener("change", async () => {
  const file = realFileInput.files[0];
  if (!file) return;

  const user = JSON.parse(localStorage.getItem("eanotes_user"));
  if (user.role !== "teacher") {
    alert("Only teacher can upload");
    return;
  }

  const subject = subjectSelect.value;
  const fileName = `${Date.now()}_${file.name.replace(/\s+/g, "_")}`;
  const path = `${subject}/${fileName}`;

  // Upload to FILES bucket
  const { error: uploadErr } = await sb.storage
    .from("FILES")
    .upload(path, file, { upsert: true });

  if (uploadErr) {
    alert("Upload failed: " + uploadErr.message);
    return;
  }

  // Correct public URL
  const { data: urlData } = sb.storage.from("FILES").getPublicUrl(path);
  const publicUrl = urlData.publicUrl;

  // Save record in DB
  const { error: dbErr } = await sb.from("files").insert([
    { name: file.name, subject, url: publicUrl, path },
  ]);

  if (dbErr) {
    alert("Database insert failed: " + dbErr.message);
    return;
  }

  alert("Upload successful!");

  realFileInput.value = "";
  loadFiles();
});

/* ---------- Load Files ---------- */
async function loadFiles() {
  fileList.innerHTML = "<p>Loading...</p>";

  const subject = subjectSelect.value;

  let query = sb.from("files").select("*");

  if (subject !== "all") {
    query = query.eq("subject", subject);
  }

  // FIXED: removed order("created_at") — your table does NOT have created_at
  const { data, error } = await query;

  if (error) {
    fileList.innerHTML = "<p>Error loading files</p>";
    console.error(error);
    return;
  }

  fileList.innerHTML = "";

  data.forEach((item) => {
    const div = document.createElement("div");
    div.className = "file-item";

    div.innerHTML = `
        <p>${item.name} (${item.subject})</p>
        <a href="${item.url}" target="_blank">Open</a>
        <button class="deleteBtn" data-path="${item.path}">Delete</button>
    `;

    fileList.appendChild(div);
  });

  // Delete handler
  document.querySelectorAll(".deleteBtn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const path = btn.getAttribute("data-path");

      await sb.storage.from("FILES").remove([path]);
      await sb.from("files").delete().eq("path", path);

      loadFiles();
    });
  });
}
