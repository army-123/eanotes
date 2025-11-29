async function loadFiles(){
  fileList.innerHTML = '<div class="muted">Loading files…</div>';
  const subject = subjectSelect.value || 'Anatomy';

  try {
    const { data, error } = await sb
      .from('files')
      .select('*')
      .eq('subject', subject)
      .order('created_at', { ascending:false });

    if(error) throw error;

    fileList.innerHTML = '';

    if(!data || data.length === 0){
      fileList.innerHTML = '<div class="muted">No files for this subject yet.</div>';
      return;
    }

    data.forEach(item => {
      const div = document.createElement('div');
      div.className = 'file-row';
      div.innerHTML = `
        <div class="file-meta">
          <div class="file-title">${escapeHtml(item.name)}</div>
          <div class="file-sub">${escapeHtml(item.subject)} • ${new Date(item.created_at).toLocaleString()}</div>
        </div>
        <div class="file-actions">
          <button class="btn-view">View</button>
          ${(getUserRole() === 'teacher') ? '<button class="btn-delete">Delete</button>' : ''}
        </div>
      `;
      fileList.appendChild(div);

      div.querySelector('.btn-view').addEventListener('click', ()=> openPdf(item.url, item.name));

      if(getUserRole() === 'teacher'){
        div.querySelector('.btn-delete').addEventListener('click', async ()=>{
          if(!confirm('Delete this file?')) return;
          try{
            await sb.from('files').delete().eq('id', item.id);
            if(item.path) await sb.storage.from('files').remove([item.path]);
            div.remove();
          }catch(e){
            alert('Delete failed: ' + (e.message || e));
          }
        });
      }
    });

  } catch(err){
    console.error(err);
    fileList.innerHTML = '<div class="muted">Failed to load files</div>';
  }
}
