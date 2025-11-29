// Initialize Supabase client
const supabaseUrl = "https://hlstgluwamsuuqlctdzk.supabase.co";
const supabaseKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhsc3RnbHV3YW1zdXVxbGN0ZHprIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQyNzMwMzQsImV4cCI6MjA3OTg0OTAzNH0.KUPx3pzrcd3H5aEx2B7mFosWNUVOEzXDD5gL-TmyawQ";

const supabase = supabase.createClient(supabaseUrl, supabaseKey);

// --------------------------- AUTH -----------------------------

async function login() {
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    alert(error.message);
    return;
  }

  checkUser();
}

async function logout() {
  await supabase.auth.signOut();
  document.getElementById("auth").style.display = "block";
  document.getElementById("dashboard").style.display = "none";
}

async function checkUser() {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    document.getElementById("auth").style.display = "block";
    document.getElementById("dashboard").style.display = "none";
    return;
  }

  document.getElementById("auth").style.display = "none";
  document.getElementById("dashboard").style.display = "block";

  const role = user.user_metadata.role || "student";
  document.getElementById("userRole").innerText = role;

  if (role === "teacher") {
    document.getElementById("uploadSection").style.display = "block";
  } else {
    document.getElementById("uploadSection").style.display = "none";
  }

  loadFiles();
}

// ------------------------- UPLOAD ------------------------------

async function upload() {
  const fileInput = document.getElementById("fileInput");
  const subject = document.getElementById("subjectSelect").value;

  if (!fileInput.files.length) {
    alert("Please choose a file.");
    return;
  }

  const file = fileInput.files[0];
  const fileName = `${Date.now()}_${file.name}`;
  const filePath = `${subject}/${fileName}`;

  // Upload with progress bar
  const progressBar = document.getElementById("progressText");
  progressBar.innerText = "0%";

  const uploadRes = await supabase.storage
    .from("files")
    .upload(filePath, file, {
      cacheControl: "3600",
      upsert: false,
      onUploadProgress: (e) => {
        const percent = Math.round((e.loaded / e.total) * 100);
        progressBar.innerText = percent + "%";
      },
    });

  if (uploadRes.error) {
    alert(uploadRes.error.message);
    return;
  }

  // Get public URL
  const { data: publicData } = supabase.storage
    .from("files")
    .getPublicUrl(filePath);

  const publicUrl = publicData.publicUrl;

  // Insert into DB (UUID is auto-generated)
  const { error: insertError } = await supabase.from("files").insert({
    name: file.name,
    subject: subject,
    url: publicUrl,
    path: filePath,
  });

  if (insertError) {
    alert(insertError.message);
    return;
  }

  alert("Upload successful!");
  progressBar.innerText = "0%";
  fileInput.value = "";

  loadFiles();
}

// ------------------------- DISPLAY FILES ------------------------

async function loadFiles() {
  const { data, error } = await supabase
    .from("files")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error(error);
    return;
  }

  const list = document.getElementById("fileList");
  list.innerHTML = "";

  data.forEach((file) => {
    const item = document.createElement("div");
    item.classList.add("file-item");
    item.innerHTML = `
            <p>${file.name}</p>
            <a href="${file.url}" target="_blank">Open</a>
            <button onclick="deleteFile('${file.id}', '${file.path}')">Delete</button>
        `;
    list.appendChild(item);
  });
}

// ---------------------------- DELETE ----------------------------

async function deleteFile(id, path) {
  if (!confirm("Delete this file?")) return;

  // Delete from storage
  await supabase.storage.from("files").remove([path]);

  // Delete from DB
  await supabase.from("files").delete().eq("id", id);

  loadFiles();
}

// ---------------------------- INIT ------------------------------

checkUser();
