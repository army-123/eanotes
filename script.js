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

  const email = `${name}@eanotes.com`;

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

  document.getElementById("loginBox").classList.remove("hidden");
  document.getElementById("dashboard").classList.add("hidden");
}

document.getElementById("logoutBtn").addEventListener("click", logout);

// --------------------------------------------------------------
//                     CHECK USER SESSION
// --------------------------------------------------------------

async function checkUser() {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    document.getElementById("loginBox").classList.remove("hidden");
    document.getElementById("dashboard").classList.add("hidden");
    return;
  }

  document.getElementById("loginBox").classList.add("hidden");
  document.getElementById("dashboard").classList.remove("hidden");

  const name = user.email.split("@")[0];
  const role = user.user_metadata.role || "student";

  document.getElementById("welcomeText").innerText = `Welcome, ${name}`;
  document.getElementById("roleTag").innerText = role;

  document.getElementById("uploadBtn").style.display =
    role === "teacher" ? "block" : "none";

  loadFiles();
}

// --------------------------------------------------------------
//                     UPLOAD FILE (PDF)
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

  // Upload file normally (no chunking)
  const { error: uploadError } = await supabase.storage
    .from("files")
    .upload(filePath, file, { upsert: false });

  if (uploadError) {
    alert(uploadError.message);
    return;
  }

  // Get public URL
  const { data: urlData } = supabase.storage
    .from("files")
    .getPublicUrl(filePath);

  const publicUrl = urlData.publicUrl;

  // Save file info to database
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

  alert("Upload successful!");
  document.getElementById("realFileInput").value = "";

  loadFiles();
}

// --------------------------------------------------------------
//                        LOAD FILES
// --------------------------------------------------------------

async function loadFiles() {
  const subject = document.getElementById("subjectSelect").value;

  const { data, error } = await supabase
    .from("files")
    .select("*")
    .eq("subject", subject)
    .order("created_at", { ascending: false });

  if (error) return;

  const list = document.getElementById("fileList");
  list.innerHTML = "";

  data.forEach(displayFile);
}

// --------------------------------------------------------------
//                     DISPLAY FILE ITEM
// --------------------------------------------------------------

function displayFile(file) {
  const div = document.createElement("div");
  div.className = "file-item";

  div.innerHTML = `
    <span>${file.name}</span>
    <div>
        <a href="${file.url}" target="_blank">Open</a>
        <button onclick="deleteFile('${file.path}')">Delete</button>
    </div>
  `;

  document.getElementById("fileList").appendChild(div);
}

// --------------------------------------------------------------
//                         DELETE FILE
// --------------------------------------------------------------

async function deleteFile(path) {
  if (!confirm("Delete this file?")) return;

  await supabase.storage.from("files").remove([path]);
  await supabase.from("files").delete().eq("path", path);

  loadFiles();
}

// --------------------------------------------------------------
checkUser();
