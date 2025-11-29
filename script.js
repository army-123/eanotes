const SUPABASE_URL = "https://hlstgluwamsuuqlctdzk.supabase.co";
const SUPABASE_ANON = "YOUR_ANON_KEY"; // keep your original

const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON);

const loginBtn = document.getElementById("loginBtn");
const logoutBtn = document.getElementById("logoutBtn");

const username = document.getElementById("username");
const password = document.getElementById("password");
const loginMsg = document.getElementById("loginMsg");

const uploadSection = document.getElementById("uploadSection");
const filesSection = document.getElementById("filesSection");

const themeToggle = document.getElementById("themeToggle");
const loadingOverlay = document.getElementById("loadingOverlay");

function showLoading(){ loadingOverlay.style.display="flex"; }
function hideLoading(){ loadingOverlay.style.display="none"; }
function msg(t,err){ loginMsg.textContent=t; loginMsg.style.color = err ? "#ff6b6b" : "var(--muted)"; }

function save(u){ localStorage.setItem("user",JSON.stringify(u)); }
function load(){ return JSON.parse(localStorage.getItem("user")||"null"); }

loginBtn.onclick = async () => {
  const user = username.value.trim();
  const pass = password.value;

  if(!user || !pass){ msg("Enter both fields",true); return; }

  loginBtn.disabled = true;
  loginBtn.textContent = "Logging in…";

  showLoading();

  // STUDENT
  if(pass === "@armyamanu"){
    save({role:"student",name:user});
    msg("Logged in as student");
    logoutBtn.style.display="block";
    uploadSection.style.display="none";
    filesSection.style.display="block";
    hideLoading();
    loginBtn.disabled=false;
    loginBtn.textContent="Login";
    return;
  }

  // TEACHER
  if(pass === "@teacher123"){
    save({role:"teacher",name:user});
    msg("Logged in as teacher");
    logoutBtn.style.display="block";
    uploadSection.style.display="block";
    filesSection.style.display="block";
    hideLoading();
    loginBtn.disabled=false;
    loginBtn.textContent="Login";
    return;
  }

  msg("Wrong password",true);
  hideLoading();
  loginBtn.disabled=false;
  loginBtn.textContent="Login";
};

logoutBtn.onclick = () => {
  localStorage.removeItem("user");
  uploadSection.style.display="none";
  filesSection.style.display="none";
  logoutBtn.style.display="none";
  username.value = "";
  password.value = "";
  msg("Logged out");
};
