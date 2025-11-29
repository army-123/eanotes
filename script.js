// --------------------- SUPABASE SETUP -------------------------
const supabaseUrl = "https://hlstgluwamsuuqlctdzk.supabase.co";
const supabaseKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhsc3RnbHV3YW1zdXVxbGN0ZHprIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQyNzMwMzQsImV4cCI6MjA3OTg0OTAzNH0.KUPx3pzrcd3H5aEx2B7mFosWNUVOEzXDD5gL-TmyawQ";

const supabase = supabase.createClient(supabaseUrl, supabaseKey);

// --------------------------------------------------------------
//                           LOGIN
// --------------------------------------------------------------

async function login() {
  const name = document.getElementById("loginName").value.trim();
  const password = document.getElementById("loginPassword").value.trim();

  if (!name || !password) {
    document.getElementById("loginFeedback").innerText =
      "Please enter name and password.";
    return;
  }

  // ✔ Convert name to email format (your system doesn't use real emails)
  const email = `${name}@eanotes.com`;

  // ✔ Sign in using Supabase
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    document.getElementById("loginFeedback").innerText =
      "Incorrect name or password.";
    return;
  }

  checkUser();
}

document.getElementById("btnLogin").addEventListener("click", login);

// --------------------------------------------------------------
//                           LOGOUT
// --------------------------------------------------------------

async function logout() {
  await supabase.auth.signOut();

  document.getElementById("loginBox").style.display = "block";
  document.getElementById("dashboard").style.display = "none";
}

document.getElementById("logoutBtn").addEventListener("click", logout);

// --------------------------------------------------------------
//                  CHECK CURRENT USER SESSION
// --------------------------------------------------------------

async function checkUser() {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    document.getElementById("loginBox").style.display = "block";
    document.getElementById("dashboard").style.display = "none";
    return;
  }

  document.getElementById("loginBox").style.display = "none";
  document.getElementById("dashboard").style.display = "block";

  const name = user.email.split("@")[0];
  const role = user.user_metadata.role || "student";

  document.getElementById("roleTag").innerText = role;
  document.getElementById("welcomeText").innerText = `Welcome, ${name}`;

  // Teacher can upload, student cannot
  document.getElementById("uploadBtn").style.display =
    role === "teacher" ? "block" : "none";

  loadFiles();
}

// --------------------------------------------------------------
//                        UPLOAD FILE
// --------------------------------------------------------------

document
  .getElementById("uploadBtn")
  .addEventListener("click", () => document.getElementById("realFileInput").click());

document
  .getElementById("realFileInput")
  .addEventListener("change", upload);

async function upload() {
  const file = document.getElementById("realFileInput").files[0];
  const subject = document.getElementById("subjectSelect").value;

  if (!file) {
    alert("Please select a file.");
    return;
  }

  const fileName = `${Date.now()}_${file.name}`;
  const filePath = `${subject}/${fileName}`;

  // ------------------ Progress UI -------------------
  const progressBox = document.createElement("div");
  progressBox.className = "progress-box";
  progressBox.innerHTML = `
        <div><b>${file.name}</b></div>
        <div class="progress-bar" id="bar"></div>
        <div class="progress-text" id="pct">0%</div>
    `;
  document.getElementById("fileList").prepend(progressBox);

  // ------------------ Chunk Upload -------------------
  const chunk = 200 * 1024;
  let uploaded = 0;

  while (uploaded < file.size) {
    const chunkPart = file.slice(uploaded, uploaded + chunk);

    const { error } = await supabase.storage
      .from("files")
      .upload(filePath, chunkPart, {
        upsert: true,
        metadata: { offset: uploaded },
      });

    if (error) {
      alert(error.message);
      progressBox.remove();
      return;
    }

    uploaded += chunk;
    const percent = Math.min(100, Math.floor((uploaded / file.size) * 100));
    progressBox.querySelector("#bar").style.width = percent + "%";
    progressBox.querySelector("#pct").innerText = percent + "%";
  }

  // ------------------ Public URL ---------------------
  const { data: urlData } = supabase.storage
    .from("files")
    .getPublicUrl(filePath);

  const publicUrl = urlData.publicUrl;

  // ------------------ Insert DB -----------------------
  const { error: dbError } = await supabase.from("files").insert({
    name: file.name,
    subject,
    url: publicUrl,
    path: filePath,
  });

  if (dbError) {
    alert(dbError.message);
    return;
  }

  // Replace progress with real file item
  progressBox.remove();
  displayFile({
    name: file.name,
    subject,
    url: publicUrl,
    path: filePath,
  });

  document.getElementById("realFileInput").value = "";
}

// --------------------------------------------------------------
//                         LOAD FILES
// --------------------------------------------------------------

async function loadFiles() {
  const subject = document.getElementById("subjectSelect").value;

  const { data, error } = await supabase
    .from("files")
    .select("*")
    .eq("subject", subject);

  const list = document.getElementById("fileList");
  list.innerHTML = "";

  if (!data) return;

  data.forEach(displayFile);
}

// --------------------------------------------------------------
//                      DISPLAY SINGLE FILE
// --------------------------------------------------------------

function displayFile(file) {
  const row = document.createElement("div");
  row.className = "file-item";

  row.innerHTML = `
        <span>${file.name}</span>
        <div>
            <a href="${file.url}" target="_blank">Open</a>
            <button onclick="deleteFile('${file.path}')">Delete</button>
        </div>
    `;

  document.getElementById("fileList").appendChild(row);
}

// --------------------------------------------------------------
//                          DELETE FILE
// --------------------------------------------------------------

async function deleteFile(path) {
  if (!confirm("Delete this file?")) return;

  // delete from storage
  await supabase.storage.from("files").remove([path]);

  // delete from DB
  await supabase.from("files").delete().eq("path", path);

  loadFiles();
}

// --------------------------------------------------------------
checkUser();
