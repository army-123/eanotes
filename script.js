// Initialize Supabase client
const sb = supabase.createClient(
  "https://hlstgluwamsuwqlctdzk.supabase.co",
  "YOUR_PUBLIC_ANON_KEY_HERE"
);

// DOM Elements
const loginSection = document.getElementById("loginSection");
const dashboardSection = document.getElementById("dashboard");
const uploadBtn = document.getElementById("uploadBtn");
const logoutBtn = document.getElementById("logoutBtn");
const subjectSelect = document.getElementById("subjectSelect");
const fileList = document.getElementById("fileList");
const chooseFileBtn = document.getElementById("chooseFileBtn");
const fileInput = document.getElementById("fileInput");

// AUTH STATE CHECK
sb.auth.onAuthStateChange(async (_event, session) => {
  if (session) {
    showDashboard();
    loadFiles();
  } else {
    showLogin();
  }
});

function showLogin() {
  loginSection.classList.remove("hidden");
  dashboardSection.classList.add("hidden");
}

function showDashboard() {
  loginSection.classList.add("hidden");
  dashboardSection.classList.remove("hidden");
}

// LOGIN FUNCTION
async function loginUser() {
  const email = document.getElementById("loginEmail").value.trim();
  const password = document.getElementById("loginPassword").value.trim();

  const { error } = await sb.auth.signInWithPassword({ email, password });

  if (error) alert(error.message);
}

// LOGOUT
logoutBtn.addEventListener("click", async () => {
  await sb.auth.signOut();
  showLogin();
});

// CHOOSE FILE BUTTON
chooseFileBtn.addEventListener("click", () => fileInput.click());

// UPLOAD FILE HANDLER
uploadBtn.addEventListener("click", async () => {
  const file = fileInput.files[0];
  const subject = subjectSelect.value;

  if (!file) return alert("Please select a file");
  if (!subject) return alert("Select a subject");

  const fileName = `${Date.now()}_${file.name}`;
  const path = `${subject}/${fileName}`;

  // FIXED: Correct bucket name "FILES"
  const { error: upErr } = await sb.storage
    .from("FILES")
    .upload(path, file, { upsert: true });

  if (upErr) {
    alert("Upload failed: " + upErr.message);
    return;
  }

  // FIXED: Correct bucket name for public URL
  const { data: urlData } = sb.storage
    .from("FILES")
    .getPublicUrl(path);

  const publicUrl = urlData.publicUrl;

  // Insert record in DB
  const { error: dbErr } = await sb.from("files").insert([
    {
      name: file.name,
      subject: subject,
      url: publicUrl,
      path: path
    }
  ]);

  if (dbErr) {
    alert("Database error: " + dbErr.message);
    return;
  }

  alert("Upload successful!");
  fileInput.value = "";
  loadFiles();
});

// LOAD FILES FROM DB
async function loadFiles() {
  const subject = subjectSelect.value;

  let query = sb.from("files").select("*");

  if (subject !== "all") {
    query = query.eq("subject", subject);
  }

  const { data, error } = await query.order("created_at", { ascending: false });

  if (error) {
    console.error(error);
    return;
  }

  fileList.innerHTML = "";

  data.forEach(item => {
    const fileItem = document.createElement("div");
    fileItem.className = "file-item";

    fileItem.innerHTML = `
      <div class="file-info">
        <p class="file-name">${item.name}</p>
        <a class="file-link" href="${item.url}" target="_blank">Open</a>
      </div>
      <button class="delete-btn" data-path="${item.path}">Delete</button>
    `;

    fileList.appendChild(fileItem);
  });

  // Delete Event Listeners
  document.querySelectorAll(".delete-btn").forEach(btn => {
    btn.addEventListener("click", async () => {
      const path = btn.getAttribute("data-path");

      // FIXED: Correct bucket name "FILES"
      await sb.storage.from("FILES").remove([path]);

      await sb.from("files").delete().eq("path", path);

      loadFiles();
    });
  });
}

