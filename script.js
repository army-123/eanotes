/* ---------- Upload With Progress Bar ---------- */
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

  /* --- Create TEMP file item with progress bar --- */
  const tempRow = document.createElement("div");
  tempRow.className = "file-item uploading";

  tempRow.innerHTML = `
      <div style="flex:1">
          <p style="margin:0;font-weight:600;">${file.name}</p>
          <p style="margin:4px 0 8px;color:#999;">Uploading...</p>
          <div class="progress">
              <b id="barProgress" style="width:0%"></b>
          </div>
      </div>
  `;

  fileList.prepend(tempRow);

  /* ---------- Upload in chunks with progress ---------- */
  const chunkSize = 256 * 1024; // 256 KB
  let offset = 0;

  while (offset < file.size) {
    const chunk = file.slice(offset, offset + chunkSize);

    const { error: uploadErr } = await sb.storage
      .from("FILES")
      .upload(path, chunk, {
        upsert: true,
        contentType: file.type,
        metadata: { offset }
      });

    if (uploadErr) {
      alert("Upload failed: " + uploadErr.message);
      tempRow.remove();
      return;
    }

    offset += chunkSize;
    const percent = Math.floor((offset / file.size) * 100);
    tempRow.querySelector("#barProgress").style.width = percent + "%";
  }

  /* Retrieve public URL */
  const { data: urlData } = sb.storage.from("FILES").getPublicUrl(path);
  const publicUrl = urlData.publicUrl;

  /* Insert into DB */
  const { error: dbErr } = await sb.from("files").insert([
    { name: file.name, subject, url: publicUrl, path }
  ]);

  if (dbErr) {
    alert("Database error: " + dbErr.message);
    tempRow.remove();
    return;
  }

  /* Show success then refresh */
  tempRow.querySelector("p:nth-child(2)").textContent = "Upload complete!";
  setTimeout(() => {
    tempRow.remove();
    loadFiles();
  }, 700);
});
