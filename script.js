const SUPABASE_URL = "https://hlstgluwamsuuqlctdzk.supabase.co";
const SUPABASE_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhsc3RnbHV3YW1zdXVxbGN0ZHprIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQyNzMwMzQsImV4cCI6MjA3OTg0OTAzNH0.KUPx3pzrcd3H5aEx2B7mFosWNUVOEzXDD5gL-TmyawQ";

const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON);

const usernameEl = document.getElementById("username");
const passwordEl = document.getElementById("password");
const loginBtn = document.getElementById("loginBtn");
const quickBtn = document.getElementById("quickBtn");
const logoutBtn = document.getElementById("logoutBtn");
const loginMsg = document.getElementById("loginMsg");

const uploadSection = document.getElementById("uploadSection");
const filesSection = document.getElementById("filesSection");

const subjectSelect = document.getElementById("subjectSelect");
const fileInput = document.getElementById("fileInput");
const uploadBtn = document.getElementById("uploadBtn");
const uploadInfo = document.getElementById("uploadInfo");
const uploadPercent = document.getElementById("uploadPercent");

const fileList = document.getElementById("fileList");

const pdfOverlay = document.getElementById("pdfOverlay");
const pdfFrame = document.getElementById("pdfFrame");
const pdfTitle = document.getElementById("pdfTitle");
const closePdf = document.getElementById("closePdf");

const themeToggle = document.getElementById("themeToggle");
const loadingOverlay = document.getElementById("loadingOverlay");

function showLoading(){ loadingOverlay.style.display="flex"; }
function hideLoading(){ loadingOverlay.style.display="none"; }
function setMsg(t,e=false){ loginMsg.textContent=t; loginMsg.style.color=e?"#ff7b7b":"var(--muted)"; }

function saveUser(u){ localStorage.setItem("eanotes_user",JSON.stringify(u)); }
function getUser(){ return JSON.parse(localStorage.getItem("eanotes_user")||"null"); }

/* THEME */
themeToggle.onclick=()=>{
  document.body.classList.toggle("light");
  themeToggle.textContent=document.body.classList.contains("light")?"☀️":"🌙";
};

/* QUICK BUTTON */
quickBtn.onclick=()=>{
  usernameEl.value=usernameEl.value||"Student";
  passwordEl.value="@armyamanu";
  setMsg("Quick student ready");
};

/* LOGIN HANDLER */
async function loginHandler(){
  setMsg(""); showLoading();

  const user = usernameEl.value.trim();
  const pass = passwordEl.value;

  if(!user || !pass){ setMsg("Fill both fields", true); hideLoading(); return; }

  // STUDENT
  if(pass === "@armyamanu"){
    saveUser({role:"student", name:user});
    setMsg("Logged in as Student");
    logoutBtn.style.display="inline-block";
    uploadSection.style.display="none";
    filesSection.style.display="block";
    hideLoading();
    loadFiles();
    return;
  }

  // TEACHER
  if(pass === "@teacher123"){
    saveUser({role:"teacher"});
    setMsg("Logged in as Teacher");
    logoutBtn.style.display="inline-block";
    uploadSection.style.display="block";
    filesSection.style.display="block";
    hideLoading();
    loadFiles();
    return;
  }

  setMsg("Incorrect password", true);
  hideLoading();
}

/* LOGIN CLICK */
loginBtn.onclick = loginHandler;

/* ENTER KEY */
passwordEl.addEventListener("keyup",e=>{ if(e.key==="Enter") loginHandler(); });

/* LOGOUT */
logoutBtn.onclick=()=>{
  localStorage.removeItem("eanotes_user");
  usernameEl.value="";
  passwordEl.value="";
  uploadSection.style.display="none";
  filesSection.style.display="none";
  logoutBtn.style.display="none";
  setMsg("Logged out");
};

/* UPLOAD */
uploadBtn.onclick=async()=>{
  const file=fileInput.files[0];
  if(!file) return alert("Choose a PDF");

  const user=getUser();
  if(!user || user.role!=="teacher") return alert("Teacher only");

  uploadInfo.style.display="block";
  uploadPercent.textContent="0%";
  showLoading();

  const subject = subjectSelect.value;
  const safe = encodeURIComponent(file.name.replace(/\s+/g,"_"));
  const path = `${subject}/${Date.now()}_${safe}`;

  try{
    const {error} = await sb.storage.from("files").upload(path,file,{upsert:true});
    if(error) throw error;

    uploadPercent.textContent="100%";

    const {data:urlData}=sb.storage.from("files").getPublicUrl(path);
    const url=urlData.publicUrl;

    await sb.from("files").insert([{name:file.name,subject,url,path,created_at:new Date().toISOString()}]);

    fileInput.value="";
    hideLoading();
    uploadInfo.style.display="none";
    loadFiles();
  }catch(e){
    alert("Upload failed");
    hideLoading();
    uploadInfo.style.display="none";
  }
};

/* LOAD FILES */
async function loadFiles(){
  fileList.innerHTML = "Loading...";
  showLoading();

  const subject = subjectSelect.value;

  try{
    const {data,error} = await sb.from("files").select("*").eq("subject",subject).order("created_at",{ascending:false});
    if(error) throw error;

    if(!data.length){ fileList.innerHTML="<div class='muted'>No files</div>"; hideLoading(); return; }

    fileList.innerHTML="";
    const user=getUser();

    data.forEach(item=>{
      const div=document.createElement("div");
      div.className="fileRow";

      div.innerHTML=`
        <div>
          <div style="font-weight:700">${item.name}</div>
          <div class="muted" style="font-size:12px">${item.subject}</div>
        </div>
        <div style="display:flex;gap:8px;">
          <button class="btn-ghost">View</button>
          ${user && user.role==="teacher" ? `<button class="btn-danger">Delete</button>` : ""}
        </div>
      `;

      div.querySelector(".btn-ghost").onclick=()=>{
        pdfTitle.textContent=item.name;
        pdfFrame.src=item.url;
        pdfOverlay.style.display="flex";
      };

      if(user && user.role==="teacher"){
        div.querySelector(".btn-danger").onclick=async()=>{
          if(!confirm("Delete?")) return;

          await sb.from("files").delete().eq("id",item.id);
          await sb.storage.from("files").remove([item.path]);

          loadFiles();
        };
      }

      fileList.appendChild(div);
    });

  }catch(e){
    fileList.innerHTML="Error loading files";
  }finally{
    hideLoading();
  }
}

closePdf.onclick=()=>{ pdfOverlay.style.display="none"; pdfFrame.src=""; };

/* AUTO-LOGIN */
(function(){
  const user=getUser();
  if(!user) return;

  logoutBtn.style.display="inline-block";
  filesSection.style.display="block";

  if(user.role==="teacher") uploadSection.style.display="block";

  loadFiles();
})();
