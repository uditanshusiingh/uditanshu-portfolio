

const vault = { docs: [], loading: false };

function esc(value = "") {
  return String(value).replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;" }[c]));
}
function toast(message, error = false) {
  let el = document.getElementById("adminToast");
  if (!el) { el=document.createElement("div"); el.id="adminToast"; el.className="admin-toast"; document.body.appendChild(el); }
  el.textContent=message; el.classList.toggle("error",error); el.classList.add("show");
  clearTimeout(window.__vaultToastTimer); window.__vaultToastTimer=setTimeout(()=>el.classList.remove("show"),3500);
}
function formatBytes(bytes) {
  if (!Number.isFinite(Number(bytes)) || Number(bytes)<1) return "0 B";
  const units=["B","KB","MB","GB","TB"], i=Math.min(Math.floor(Math.log(bytes)/Math.log(1024)),units.length-1);
  return (Number(bytes)/Math.pow(1024,i)).toFixed(i ? 2 : 0)+" "+units[i];
}
function formatDate(value) {
  const date=new Date(value); if(Number.isNaN(date.getTime())) return "Unknown date";
  return date.toLocaleString(undefined,{day:"2-digit",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"});
}
function fileIcon(name="") {
  const ext=String(name).split(".").pop().toLowerCase();
  const icons={pdf:"bi-file-earmark-pdf",doc:"bi-file-earmark-word",docx:"bi-file-earmark-word",xls:"bi-file-earmark-excel",xlsx:"bi-file-earmark-excel",ppt:"bi-file-earmark-ppt",pptx:"bi-file-earmark-ppt",csv:"bi-filetype-csv",txt:"bi-file-earmark-text",zip:"bi-file-earmark-zip",rar:"bi-file-earmark-zip",jpg:"bi-file-earmark-image",jpeg:"bi-file-earmark-image",png:"bi-file-earmark-image",webp:"bi-file-earmark-image"};
  return icons[ext] || "bi-file-earmark";
}
async function request(method,payload={}) {
  const response=await fetch("/api/vault",{method,credentials:"same-origin",cache:"no-store",headers:method==="GET"?{}:{"Content-Type":"application/json"},body:method==="GET"?undefined:JSON.stringify(payload)});
  const result=await response.json().catch(()=>({})); if(!response.ok) throw new Error(result.message||"Vault request failed."); return result;
}
async function loadVault({showLoading=true}={}) {
  const list=document.getElementById("vaultList"); if(!list) return false;
  if(showLoading) list.innerHTML='<div class="vault-loading"><i class="bi bi-arrow-repeat"></i> Loading your private vault...</div>';
  try {
    const result=await request("GET");
    vault.docs=Array.isArray(result.documents)?result.documents:[];
    renderVault();
    const updated=document.getElementById("vaultUpdated");
    if(updated) updated.textContent="Last refreshed "+formatDate(result.refreshedAt || new Date().toISOString());
    return true;
  } catch(error) {
    if(showLoading) list.innerHTML='<div class="vault-error"><i class="bi bi-shield-x"></i><b>Vault unavailable</b><span>'+esc(error.message)+'</span></div>';
    return false;
  }
}
function renderVault() {
  const list=document.getElementById("vaultList"), count=document.getElementById("vaultCount"); if(!list) return;
  const pinned=vault.docs.filter(x=>x.pinned).length;
  if(count) count.textContent=vault.docs.length+" Document"+(vault.docs.length===1?"":"s")+(pinned?" · "+pinned+" pinned":"");
  if(!vault.docs.length) { list.innerHTML='<div class="vault-empty"><i class="bi bi-safe2"></i><h3>Your vault is empty</h3><p>Drop your first document above. It will stay separate from your public portfolio.</p></div>'; return; }
  list.innerHTML=vault.docs.map(doc =>
    '<article class="vault-file '+(doc.pinned?"is-pinned":"")+'">'+
      '<div class="vault-file-icon"><i class="bi '+fileIcon(doc.name)+'"></i></div>'+
      '<div class="vault-file-main"><div class="vault-file-title"><strong title="'+esc(doc.name)+'">'+esc(doc.name)+'</strong>'+(doc.pinned?'<span class="vault-pinned"><i class="bi bi-pin-fill"></i> Pinned</span>':"")+'</div>'+
      '<div class="vault-file-meta"><span><i class="bi bi-hdd"></i> '+formatBytes(doc.size)+'</span><span><i class="bi bi-file-earmark"></i> '+esc(doc.contentType||"Unknown type")+'</span><span><i class="bi bi-calendar3"></i> Uploaded '+formatDate(doc.uploadedAt)+'</span>'+(doc.lastModified?'<span><i class="bi bi-clock-history"></i> File modified '+formatDate(doc.lastModified)+'</span>':"")+'</div></div>'+
      '<div class="vault-file-actions"><button type="button" class="vault-action '+(doc.pinned?"active":"")+'" title="'+(doc.pinned?"Unpin":"Pin")+'" data-vault-pin="'+encodeURIComponent(doc.pathname)+'"><i class="bi '+(doc.pinned?"bi-pin-fill":"bi-pin")+'"></i></button>'+
      '<button type="button" class="vault-action" title="View" data-vault-view="'+encodeURIComponent(doc.pathname)+'"><i class="bi bi-eye"></i></button>'+
      '<button type="button" class="vault-action" title="Download" data-vault-download="'+encodeURIComponent(doc.pathname)+'"><i class="bi bi-download"></i></button>'+
      '<button type="button" class="vault-action danger" title="Delete" data-vault-delete="'+encodeURIComponent(doc.pathname)+'"><i class="bi bi-trash3"></i></button></div></article>'
  ).join("");
}
function safeFilename(name) { return String(name||"document").replace(/[\\/]/g,"-").replace(/[\r\n"]/g,"_").slice(0,220)||"document"; }
async function uploadOne(file) {
  const status=document.getElementById("vaultUploadStatus"), safe=safeFilename(file.name), pathname="vault/files/"+Date.now()+"-"+crypto.randomUUID()+"-"+safe;
  status.textContent="Uploading "+file.name+" — 0%";
  try {
    let authResult;
    if(file.size <= 4 * 1024 * 1024) {
      const form=new FormData();
      form.append("pathname",pathname);
      form.append("file",file,file.name);
      const uploadResponse=await fetch("/api/vault/upload",{method:"POST",credentials:"same-origin",body:form});
      authResult=await uploadResponse.json().catch(()=>({}));
      if(!uploadResponse.ok) throw new Error(authResult.message||"Could not upload the document.");
    } else {
      const authResponse=await fetch("/api/vault/upload",{method:"POST",credentials:"same-origin",headers:{"Content-Type":"application/json"},body:JSON.stringify({pathname,size:file.size,contentType:file.type||"application/octet-stream"})});
      authResult=await authResponse.json().catch(()=>({}));
      if(!authResponse.ok) throw new Error(authResult.message||"Could not authorize secure upload.");
      status.textContent="Uploading "+file.name+" — 0%";
      const uploadResponse=await fetch(authResult.presignedUrl,{method:"PUT",headers:{"Content-Type":file.type||"application/octet-stream"},body:file});
      if(!uploadResponse.ok) {
        const detail=await uploadResponse.text().catch(()=>"");
        throw new Error(detail||"Vercel Blob rejected the upload ("+uploadResponse.status+").");
      }
    }
    status.textContent=file.name+" uploaded — saving metadata...";
    await request("POST",{action:"register",pathname:authResult.pathname||pathname,originalName:file.name,size:file.size,contentType:authResult.contentType||file.type||"application/octet-stream",uploadedAt:new Date().toISOString(),lastModified:file.lastModified||null});
    status.textContent=file.name+" uploaded successfully.";
  } catch(error) { try { await request("POST",{action:"delete",pathname}); } catch {} throw error; }
}
async function uploadFiles(files) {
  const selected=Array.from(files||[]).filter(Boolean);
  if(!selected.length||vault.loading) return;
  vault.loading=true;
  const zone=document.getElementById("vaultDropzone");
  const status=document.getElementById("vaultUploadStatus");
  zone?.classList.add("uploading");
  let success=0, failed=0, lastError="";
  try {
    for(const file of selected){
      try{
        await uploadOne(file);
        success++;
      }catch(error){
        failed++;
        lastError=error?.message||"Upload failed.";
        status.textContent=file.name+" — "+lastError;
        toast(file.name+": "+lastError,true);
      }
    }
    if(success) {
      await loadVault({showLoading:false});
      toast(success+" document"+(success===1?"":"s")+" uploaded to your private vault.");
    }
    if(failed && !success) status.textContent="Upload failed — "+lastError;
    else if(failed) status.textContent=success+" uploaded, "+failed+" failed.";
  } finally {
    vault.loading=false;
    zone?.classList.remove("uploading");
    const input=document.getElementById("vaultFileInput");
    if(input) input.value="";
    if(!failed) {
      setTimeout(()=>{
        if(status) status.textContent="Files stay private and are never rendered on the public website.";
      },2500);
    }
  }
}
async function togglePin(doc) { await request("POST",{action:"pin",pathname:doc.pathname,pinned:!doc.pinned,originalName:doc.name}); await loadVault(); toast(doc.pinned?"Document unpinned.":"Document pinned."); }
function downloadDocument(doc) {
  const link=document.createElement("a"); link.href="/api/vault/file?pathname="+encodeURIComponent(doc.pathname)+"&name="+encodeURIComponent(doc.name); link.download=doc.name; document.body.appendChild(link); link.click(); link.remove();
}
function viewDocument(doc) {
  document.getElementById("vaultViewer")?.remove();
  const overlay=document.createElement("div");
  overlay.id="vaultViewer";
  overlay.className="vault-viewer-backdrop";
  const src="/api/vault/file?pathname="+encodeURIComponent(doc.pathname)+"&name="+encodeURIComponent(doc.name)+"&view=1";
  overlay.innerHTML=
    '<div class="vault-viewer" role="dialog" aria-modal="true" aria-label="Preview '+esc(doc.name)+'">'+
      '<div class="vault-viewer-head"><div><i class="bi '+fileIcon(doc.name)+'"></i><strong title="'+esc(doc.name)+'">'+esc(doc.name)+'</strong></div>'+
      '<div class="vault-viewer-head-actions"><button type="button" class="vault-action" data-vault-view-download title="Download"><i class="bi bi-download"></i></button><button type="button" class="vault-viewer-close" data-vault-view-close title="Close"><i class="bi bi-x-lg"></i></button></div></div>'+
      '<div class="vault-viewer-body"><iframe src="'+src+'" title="Preview '+esc(doc.name)+'"></iframe></div>'+
    '</div>';
  document.body.appendChild(overlay);
  overlay.querySelector("[data-vault-view-download]")?.addEventListener("click",()=>downloadDocument(doc));
  const close=()=>{overlay.classList.add("closing");setTimeout(()=>overlay.remove(),150);};
  overlay.querySelector("[data-vault-view-close]")?.addEventListener("click",close);
  overlay.addEventListener("click",e=>{if(e.target===overlay)close();});
  const onKey=e=>{if(e.key==="Escape"){document.removeEventListener("keydown",onKey);close();}};
  document.addEventListener("keydown",onKey);
}
function showDeleteDialog(doc) {
  return new Promise(resolve => {
    document.getElementById("vaultDeleteDialog")?.remove();
    const overlay=document.createElement("div");
    overlay.id="vaultDeleteDialog";
    overlay.className="vault-dialog-backdrop";
    overlay.innerHTML=
      '<div class="vault-delete-dialog" role="dialog" aria-modal="true" aria-labelledby="vaultDeleteTitle">'+
        '<div class="vault-delete-icon"><i class="bi bi-trash3"></i></div>'+
        '<div class="vault-delete-content">'+
          '<span class="vault-dialog-eyebrow">DELETE DOCUMENT</span>'+
          '<h3 id="vaultDeleteTitle">Delete this document?</h3>'+
          '<p>Are you sure you want to permanently delete <strong>'+esc(doc.name)+'</strong> from your private vault?</p>'+
        '</div>'+
        '<div class="vault-delete-actions">'+
          '<button type="button" class="btn-outline" data-vault-dialog-cancel>Cancel</button>'+
          '<button type="button" class="btn-danger" data-vault-dialog-confirm><i class="bi bi-trash3"></i> Delete permanently</button>'+
        '</div>'+
      '</div>';
    document.body.appendChild(overlay);
    const close=value=>{overlay.classList.add("closing");setTimeout(()=>overlay.remove(),160);resolve(value);};
    overlay.querySelector("[data-vault-dialog-cancel]")?.addEventListener("click",()=>close(false));
    overlay.querySelector("[data-vault-dialog-confirm]")?.addEventListener("click",()=>close(true));
    overlay.addEventListener("click",e=>{if(e.target===overlay)close(false);});
    const onKey=e=>{if(e.key==="Escape"){document.removeEventListener("keydown",onKey);close(false);}};
    document.addEventListener("keydown",onKey);
    setTimeout(()=>overlay.querySelector("[data-vault-dialog-cancel]")?.focus(),0);
  });
}
async function deleteDocument(doc) {
  if(!(await showDeleteDialog(doc))) return;
  await request("POST",{action:"delete",pathname:doc.pathname}); await loadVault(); toast("Document deleted from your private vault.");
}
async function setupVault() {
  const zone=document.getElementById("vaultDropzone"), input=document.getElementById("vaultFileInput"); if(!zone||!input) return;
  const status=document.getElementById("vaultUploadStatus");
  let dragDepth=0;
  const isFileDrag=e => Array.from(e.dataTransfer?.types || []).includes("Files");

  const setStatus = message => { const status=document.getElementById("vaultUploadStatus"); if(status) status.textContent=message; };
  zone.addEventListener("click",e=>{ if(e.target===input) return; input.click(); });
  zone.addEventListener("keydown",e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();input.click();}});
  input.addEventListener("change",e=>{
    const files=e.target.files;
    if(files?.length) setStatus(files.length===1 ? "Selected: "+files[0].name+" — starting upload..." : files.length+" files selected — starting upload...");
    uploadFiles(files);
  });

  // Handle Windows/macOS file drops reliably, including when child elements are under the pointer.
  zone.addEventListener("dragenter",e=>{
    if(!isFileDrag(e)) return;
    e.preventDefault(); e.stopPropagation();
    dragDepth++;
    zone.classList.add("dragover");
  }, true);

  zone.addEventListener("dragover",e=>{
    if(!isFileDrag(e)) return;
    e.preventDefault(); e.stopPropagation();
    if(e.dataTransfer) e.dataTransfer.dropEffect="copy";
    zone.classList.add("dragover");
  }, true);

  zone.addEventListener("dragleave",e=>{
    if(!isFileDrag(e)) return;
    e.preventDefault(); e.stopPropagation();
    dragDepth=Math.max(0,dragDepth-1);
    if(!dragDepth) zone.classList.remove("dragover");
  }, true);

  zone.addEventListener("drop",e=>{
    if(!isFileDrag(e)) return;
    e.preventDefault(); e.stopPropagation();
    dragDepth=0;
    zone.classList.remove("dragover");
    const files=e.dataTransfer?.files;
    if(files?.length) uploadFiles(files);
  }, true);

  // Prevent the browser from navigating away if a file is released just outside the dropzone.
  window.addEventListener("dragover",e=>{
    if(isFileDrag(e)) e.preventDefault();
  });
  window.addEventListener("drop",e=>{
    if(!isFileDrag(e)) return;
    e.preventDefault();
    if(e.target!==zone && !zone.contains(e.target)) {
      zone.classList.remove("dragover");
      dragDepth=0;
    }
  });

  const refreshButton=document.getElementById("vaultRefresh");
  refreshButton?.addEventListener("click",async()=>{
    if(refreshButton.classList.contains("is-refreshing") || vault.loading) return;
    refreshButton.classList.add("is-refreshing");
    refreshButton.setAttribute("aria-busy","true");
    try { await loadVault({showLoading:false}); }
    finally {
      setTimeout(()=>{
        refreshButton.classList.remove("is-refreshing");
        refreshButton.removeAttribute("aria-busy");
      },900);
    }
  });
  document.addEventListener("click",async e=>{
    const pin=e.target.closest("[data-vault-pin]"), view=e.target.closest("[data-vault-view]"), download=e.target.closest("[data-vault-download]"), del=e.target.closest("[data-vault-delete]");
    try {
      if(pin){const doc=vault.docs.find(x=>x.pathname===decodeURIComponent(pin.dataset.vaultPin));if(doc)await togglePin(doc);}
      else if(view){const doc=vault.docs.find(x=>x.pathname===decodeURIComponent(view.dataset.vaultView));if(doc)viewDocument(doc);}
      else if(download){const doc=vault.docs.find(x=>x.pathname===decodeURIComponent(download.dataset.vaultDownload));if(doc)downloadDocument(doc);}
      else if(del){const doc=vault.docs.find(x=>x.pathname===decodeURIComponent(del.dataset.vaultDelete));if(doc)await deleteDocument(doc);}
    } catch(error){toast(error.message||"Vault action failed.",true);}
  });
  document.querySelectorAll(".nav-btn").forEach(button=>button.addEventListener("click",()=>{if(button.dataset.section==="documents")setTimeout(loadVault,0);}));
  setStatus("Vault ready — click here or drag files into this area.");
  await loadVault();
}
try {
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",setupVault);else setupVault();
} catch(error) {
  const status=document.getElementById("vaultUploadStatus");
  if(status) status.textContent="Vault UI error: "+(error?.message||"Could not initialize upload.");
}