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
        loginFeedback.textContent = "Enter both fields";
        return;
    }

    if (pw === "@armyamanu") currentUser = { role: "student", name };
    else if (pw === "@teacher123") currentUser = { role: "teacher", name };
    else {
        loginFeedback.textContent = "Incorrect password";
        return;
    }

    roleTag.textContent = currentUser.role;
    welcomeText.textContent = `Welcome, ${currentUser.name}`;

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

/* ---------- UPLOAD WITH PROGRESS ---------- */
uploadBtn.onclick = () => realFileInput.click();

realFileInput.onchange = async () => {
    const file = realFileInput.files[0];
    if (!file) return;

    if (currentUser.role !== "teacher") {
        alert("Students cannot upload");
        return;
    }

    const subject = subjectSelect.value;
    const newName = Date.now() + "_" + file.name.replace(/\s+/g, "_");
    const path = `${subject}/${newName}`;

    /* Progress UI */
    const box = document.createElement("div");
    box.className = "progress-box";
    box.innerHTML = `
        <div><b>${file.name}</b></div>
        <div class="progress-bar" id="bar"></div>
        <div class="progress-text" id="pct">0%</div>
    `;
    fileList.prepend(box);

    /* Chunk upload */
    const chunkSize = 200 * 1024;
    let uploaded = 0;

    while (uploaded < file.size) {
        const chunk = file.slice(uploaded, uploaded + chunkSize);

        const { error } = await sb.storage
            .from("files")   // FIXED BUCKET NAME
            .upload(path, chunk, {
                upsert: true,
                metadata: { offset: uploaded }
            });

        if (error) {
            alert(error.message);
            box.remove();
            return;
        }

        uploaded += chunkSize;

        const p = Math.min(100, Math.floor((uploaded / file.size) * 100));
        box.querySelector("#bar").style.width = p + "%";
        box.querySelector("#pct").textContent = p + "%";
    }

    /* Public URL */
    const { data: urlData } = sb.storage.from("files").getPublicUrl(path);

    /* Insert DB record */
    await sb.from("files").insert([
        { name: file.name, subject, url: urlData.publicUrl, path }
    ]);

    /* Replace progress with actual file */
    box.remove();
    displayFile({ name: file.name, url: urlData.publicUrl, path });
};

/* ---------- DISPLAY FILE ---------- */
function displayFile(item) {
    const row = document.createElement("div");
    row.className = "file-item";
    row.innerHTML = `
        <span>${item.name}</span>
        <div>
            <a href="${item.url}" target="_blank">Open</a>
            ${currentUser.role === "teacher"
                ? `<button class="deleteBtn" data-path="${item.path}">Delete</button>`
                : ""}
        </div>
    `;
    fileList.prepend(row);

    if (currentUser.role === "teacher") {
        row.querySelector(".deleteBtn").onclick = async () => {
            await sb.storage.from("files").remove([item.path]);
            await sb.from("files").delete().eq("path", item.path);
            row.remove();
        };
    }
}

/* ---------- LOAD FILES ---------- */
async function loadFiles() {
    fileList.innerHTML = "Loading...";

    const subject = subjectSelect.value;

    const { data } = await sb
        .from("files")
        .select("*")
        .eq("subject", subject);

    fileList.innerHTML = "";

    data.forEach(displayFile);
}
