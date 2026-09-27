import { upload } from "https://cdn.jsdelivr.net/npm/@vercel/blob@2.6.1/+esm";

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
      '<button type="button" class="vault-action" title="Download" data-vault-download="'+encodeURIComponent(doc.pathname)+'"><i class="bi bi-download"></i></button>'+
      '<button type="button" class="vault-action danger" title="Delete" data-vault-delete="'+encodeURIComponent(doc.pathname)+'"><i class="bi bi-trash3"></i></button></div></article>'
  ).join("");
}
function safeFilename(name) { return String(name||"document").replace(/[\\/]/g,"-").replace(/[\r\n"]/g,"_").slice(0,220)||"document"; }
async function uploadOne(file) {
  const status=document.getElementById("vaultUploadStatus"), safe=safeFilename(file.name), pathname="vault/files/"+Date.now()+"-"+crypto.randomUUID()+"-"+safe;
  status.textContent="Uploading "+file.name+" — 0%";
  try {
    const blob=await upload(pathname,file,{access:"private",handleUploadUrl:"/api/vault/upload",multipart:file.size>4*1024*1024,onUploadProgress:event=>{status.textContent="Uploading "+file.name+" — "+Math.round(event.percentage||0)+"%";}});
    await request("POST",{action:"register",pathname:blob.pathname,originalName:file.name,size:file.size,contentType:file.type||blob.contentType||"application/octet-stream",uploadedAt:new Date().toISOString(),lastModified:file.lastModified||null});
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
async function deleteDocument(doc) {
  if(!confirm('Delete "'+doc.name+'" permanently from your private vault?')) return;
  await request("POST",{action:"delete",pathname:doc.pathname}); await loadVault(); toast("Document deleted from your private vault.");
}
function setupVault() {
  const zone=document.getElementById("vaultDropzone"), input=document.getElementById("vaultFileInput"); if(!zone||!input) return;
  let dragDepth=0;
  const isFileDrag=e => Array.from(e.dataTransfer?.types || []).includes("Files");

  zone.addEventListener("keydown",e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();input.click();}});
  input.addEventListener("change",e=>uploadFiles(e.target.files));

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
    const pin=e.target.closest("[data-vault-pin]"), download=e.target.closest("[data-vault-download]"), del=e.target.closest("[data-vault-delete]");
    try {
      if(pin){const doc=vault.docs.find(x=>x.pathname===decodeURIComponent(pin.dataset.vaultPin));if(doc)await togglePin(doc);}
      else if(download){const doc=vault.docs.find(x=>x.pathname===decodeURIComponent(download.dataset.vaultDownload));if(doc)downloadDocument(doc);}
      else if(del){const doc=vault.docs.find(x=>x.pathname===decodeURIComponent(del.dataset.vaultDelete));if(doc)await deleteDocument(doc);}
    } catch(error){toast(error.message||"Vault action failed.",true);}
  });
  document.querySelectorAll(".nav-btn").forEach(button=>button.addEventListener("click",()=>{if(button.dataset.section==="documents")setTimeout(loadVault,0);}));
  loadVault();
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",setupVault);else setupVault();