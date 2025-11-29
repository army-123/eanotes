/* Supabase setup */
const supabaseUrl = "https://hlstgluwamsuuqlctdzk.supabase.co";
const supabaseKey =
"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhsc3RnbHV3YW1zdXVxbGN0ZHprIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQyNzMwMzQsImV4cCI6MjA3OTg0OTAzNH0.KUPx3pzrcd3H5aEx2B7mFosWNUVOEzXDD5gL-TmyawQ";

const sb = supabase.createClient(supabaseUrl, supabaseKey);

/* DOM */
const loginBox = document.getElementById("loginBox");
const dashboard = document.getElementById("dashboard");
const loginName = document.getElementById("loginName");
const loginPassword = document.getElementById("loginPassword");
const btnLogin = document.getElementById("btnLogin");
const loginFeedback = document.getElementById("loginFeedback");

const uploadBtn = document.getElementById("uploadBtn");
const realFileInput = document.getElementById("realFileInput");
const fileList = document.getElementById("fileList");
const subjectSelect = document.getElementById("subjectSelect");
const logoutBtn = document.getElementById("logoutBtn");

const roleTag = document.getElementById("roleTag");
const welcomeText = document.getElementById("welcomeText");

let currentUser = null;

/* ---------- LOGIN ---------- */
btnLogin.onclick = () => {
    const name = loginName.value.trim();
    const pw = loginPassword.value.trim();

    if (!name || !pw) {
        loginFeedback.textContent = "Enter all fields";
        return;
    }

    if (pw === "@armyamanu") currentUser = { role: "student", name };
    else if (pw === "@teacher123") currentUser = { role: "teacher", name };
    else {
        loginFeedback.textContent = "Wrong password";
        return;
    }

    roleTag.textContent = currentUser.role;
    welcomeText.textContent = "Welcome, " + currentUser.name;

    uploadBtn.style.display = currentUser.role === "teacher" ? "block" : "none";

    loginBox.classList.add("hidden");
    dashboard.classList.remove("hidden");

    loadFiles();
};

/* ---------- LOGOUT ---------- */
logoutBtn.onclick = () => {
    currentUser = null;
    dashboard.classList.add("hidden");
    loginBox.classList.remove("hidden");
};

/* ---------- UPLOAD PDF ---------- */
uploadBtn.onclick = () => realFileInput.click();

realFileInput.onchange = async () => {
    const file = realFileInput.files[0];
    if (!file) return;

    if (currentUser.role !== "teacher") {
        alert("Student cannot upload");
        return;
    }

    const subject = subjectSelect.value;
    const newName = Date.now() + "_" + file.name;
    const path = subject + "/" + newName;

    // Upload to Storage
    const { error: uploadError } = await sb.storage
        .from("FILES")
        .upload(path, file);

    if (uploadError) {
        alert("Upload error: " + uploadError.message);
        return;
    }

    // Get public URL
    const { data: urlData } = sb.storage.from("FILES").getPublicUrl(path);

    // Insert DB record
    await sb.from("files").insert([
        { name: file.name, subject, url: urlData.publicUrl, path }
    ]);

    alert("File uploaded!");

    loadFiles();
};

/* ---------- LOAD FILE LIST ---------- */
async function loadFiles() {
    fileList.innerHTML = "Loading...";

    const subject = subjectSelect.value;

    let query = sb.from("files").select("*");
    query = query.eq("subject", subject);

    const { data, error } = await query;

    if (error) {
        fileList.innerHTML = "Error loading files";
        return;
    }

    fileList.innerHTML = "";

    data.forEach(item => {
        const div = document.createElement("div");
        div.className = "file-item";

        div.innerHTML = `
            <span>${item.name}</span>
            <div>
                <a href="${item.url}" target="_blank">Open</a>
                ${
                    currentUser.role === "teacher" 
                    ? `<button class="deleteBtn" data-path="${item.path}">Delete</button>`
                    : ""
                }
            </div>
        `;

        fileList.appendChild(div);
    });

    /* DELETE EVENT */
    document.querySelectorAll(".deleteBtn").forEach(btn => {
        btn.onclick = async () => {
            const path = btn.getAttribute("data-path");

            await sb.storage.from("FILES").remove([path]);
            await sb.from("files").delete().eq("path", path);

            loadFiles();
        };
    });
}
