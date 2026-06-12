var API_URL = '';

// ── STATE ──────────────────────────────────────────────────────────────────
var _m = {
  projectText: null, projectSummary: null,
  jobText: null,     jobSummary: null,
  candidates: [],
  results: []
};

var _jd = {
  file: null,
  blob: null, name: null,
  analysis: null,
  perfiles: [],
  selectedIdx: null,
  chatHistory: [],
  templates: []
};

// ── INIT ───────────────────────────────────────────────────────────────────
window.addEventListener('load', function() {
  console.log('[CFOTech] Inicializando...');
  checkHealth();
  loadTemplates();
  setJDStep(1);
  // File input listeners
  document.getElementById('m-project-file').addEventListener('change', function(e){ if(e.target.files&&e.target.files[0]) uploadMatcherFile(e.target.files[0],'project'); });
  document.getElementById('m-job-file').addEventListener('change',     function(e){ if(e.target.files&&e.target.files[0]) uploadMatcherFile(e.target.files[0],'job'); });
  document.getElementById('m-cv-file').addEventListener('change',      function(e){ if(e.target.files&&e.target.files.length) uploadCVs(e.target.files); });
  document.getElementById('jd-file').addEventListener('change',        function(e){ if(e.target.files&&e.target.files[0]) setJDFile(e.target.files[0]); });
  document.getElementById('tplFile').addEventListener('change',        function(e){ if(e.target.files&&e.target.files[0]) setTplFile(e.target.files[0]); });
  // Drag & drop for JD upload zone
  var jdUz = document.getElementById('jd-uz');
  jdUz.addEventListener('dragover',  function(e){ e.preventDefault(); jdUz.classList.add('drag'); });
  jdUz.addEventListener('dragleave', function()  { jdUz.classList.remove('drag'); });
  jdUz.addEventListener('drop',      function(e){ e.preventDefault(); jdUz.classList.remove('drag'); if(e.dataTransfer.files&&e.dataTransfer.files[0]) setJDFile(e.dataTransfer.files[0]); });
  console.log('[CFOTech] Listo.');
  var _em=document.getElementById('errModal');
  if(_em) _em.addEventListener('click',function(e){ if(e.target===this) closeErrModal(); });
});

function checkHealth(){
  fetch(API_URL+'/api/health').then(function(r){return r.json();}).then(function(){
    document.getElementById('apiDot').style.background='#48bb78';
    document.getElementById('apiTxt').textContent='Sistema listo';
  }).catch(function(){
    document.getElementById('apiDot').style.background='#fc8181';
    document.getElementById('apiTxt').textContent='Servidor no disponible';
  });
}

// ── NAV ────────────────────────────────────────────────────────────────────
function showTab(tab){
  document.getElementById('screen-matcher').classList.remove('on');
  document.getElementById('screen-jdgen').classList.remove('on');
  document.getElementById('screen-'+tab).classList.add('on');
  var mb=document.getElementById('tab-matcher-btn');
  var jb=document.getElementById('tab-jdgen-btn');
  mb.className='tab-btn '+(tab==='matcher'?'on-matcher':'off');
  jb.className='tab-btn '+(tab==='jdgen'?'on-jdgen':'off');
  document.getElementById('hamBtn').className='ham-btn'+(tab==='jdgen'?' vis':'');
  if(tab==='matcher') closeDrawer();
  if(tab==='matcher') recalcMStep();
  if(tab==='jdgen')   recalcJDStep();
}

function recalcMStep(){
  var n=1;
  if(_m.jobText) n=2;
  if(_m.candidates.length>0) n=3;
  if(_m.results.length>0) n=5;
  setMStep(n);
}

function recalcJDStep(){
  var n=1;
  if(_jd.file) n=1;
  if(_jd.analysis) n=2;
  if(_jd.selectedIdx!==null) n=3;
  if(_jd.blob) n=5;
  setJDStep(n);
}

// ── SHUTDOWN ───────────────────────────────────────────────────────────────
function confirmExit(){ document.getElementById('exitModal').classList.add('open'); }
function closeExitModal(){ document.getElementById('exitModal').classList.remove('open'); }

async function doExit(){
  var btn=document.getElementById('exitConfirmBtn');
  btn.textContent='Cerrando...'; btn.disabled=true;
  document.getElementById('apiTxt').textContent='Cerrando servidor...';
  document.getElementById('apiDot').style.background='#fc8181';
  // Bajar el servidor Node.js
  try { await fetch(API_URL+'/api/shutdown',{method:'POST'}); } catch(e){}
  // Notificar al portal shell para volver al Dashboard y limpiar procesos
  // (postMessage funciona tanto en iframe como en ventana directa)
  if (window.parent !== window) {
    window.parent.postMessage(
      { type: 'portal:goHome', appId: 'job-matcher' },
      'http://localhost:5174'
    );
  } else {
    // Fuera del portal: cerrar la pestaña (standalone)
    setTimeout(function(){ window.close(); }, 800);
  }
}

// ── DRAWER ─────────────────────────────────────────────────────────────────
function toggleDrawer(){
  var d=document.getElementById('drawer'), o=document.getElementById('drawerOv');
  var open=d.classList.contains('open');
  d.classList.toggle('open',!open); o.classList.toggle('open',!open);
}
function closeDrawer(){
  document.getElementById('drawer').classList.remove('open');
  document.getElementById('drawerOv').classList.remove('open');
}

// ── TEMPLATES ─────────────────────────────────────────────────────────────
var _tplFile = null;
function setTplFile(file){
  _tplFile=file;
  var fn=document.getElementById('tplFnTxt');
  fn.textContent='\u2713 '+file.name; fn.style.display='block';
  document.getElementById('tplZone').classList.add('ok');
  if(!document.getElementById('tplNombre').value)
    document.getElementById('tplNombre').value=file.name.replace('.docx','');
}
function loadTemplates(){
  fetch(API_URL+'/api/templates').then(function(r){return r.json();}).then(function(d){
    _jd.templates=d.templates||[]; renderTplList();
  }).catch(function(){_jd.templates=[];});
}
function renderTplList(){
  var el=document.getElementById('tplList');
  if(!_jd.templates.length){ el.innerHTML='<div style="font-size:11px;color:var(--text2);text-align:center;padding:14px 0;">No hay templates guardados</div>'; return; }
  el.innerHTML=_jd.templates.map(function(t){
    return '<div style="background:var(--gray1);border-radius:8px;padding:10px 12px;margin-bottom:7px;display:flex;align-items:center;gap:9px;">'
      +'<div style="width:28px;height:28px;background:var(--navy);border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:12px;color:white;flex-shrink:0;">&#128196;</div>'
      +'<div style="flex:1;min-width:0;"><p style="font-size:11px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">'+t.nombre+'</p><p style="font-size:10px;color:var(--text2);">'+t.perfil+'</p></div>'
      +'<button onclick="delTpl(\''+t.id+'\')" style="background:#FDECEA;border:none;border-radius:5px;color:var(--red);font-size:11px;cursor:pointer;padding:3px 7px;">&#10005;</button></div>';
  }).join('');
}
function saveTpl(){
  if(!_tplFile){alert('Selecciona un archivo .docx');return;}
  var nombre=document.getElementById('tplNombre').value.trim()||_tplFile.name;
  var perfil=document.getElementById('tplPerfil').value;
  if(!perfil){alert('Selecciona el perfil del template');return;}
  var form=new FormData();
  form.append('template',_tplFile); form.append('nombre',nombre); form.append('perfil',perfil);
  fetch(API_URL+'/api/templates',{method:'POST',body:form}).then(function(r){return r.json();}).then(function(d){
    if(d.success){
      _tplFile=null;
      document.getElementById('tplFile').value='';
      document.getElementById('tplFnTxt').style.display='none';
      document.getElementById('tplZone').classList.remove('ok');
      document.getElementById('tplNombre').value='';
      document.getElementById('tplPerfil').value='';
      loadTemplates();
    }
  }).catch(function(e){console.error('saveTpl:',e);});
}
function delTpl(id){ fetch(API_URL+'/api/templates/'+id,{method:'DELETE'}).then(function(){loadTemplates();}); }
function getTplForPerfil(p){
  var ex=_jd.templates.filter(function(t){return t.perfil===p;})[0]; if(ex) return ex.id;
  var g=_jd.templates.filter(function(t){return t.perfil==='General';})[0]; return g?g.id:null;
}

// ── HELPERS ────────────────────────────────────────────────────────────────
function sleep(ms){return new Promise(function(r){setTimeout(r,ms);});}
function showLoading(msg,detail){ document.getElementById('loadingMsg').textContent=msg||'Procesando...'; var det=document.getElementById('loadingDetail'); if(det) det.textContent=detail||'Por favor espera'; document.getElementById('loading').classList.add('active'); }
function hideLoading(){ document.getElementById('loading').classList.remove('active'); }
function setPS(id,state){ var el=document.getElementById(id); if(!el)return; el.className='prog-step'+(state?' '+state:''); }
function showError(title, msg, module, detail){
  hideLoading();
  var t=document.getElementById('errModalTitle');
  var mo=document.getElementById('errModalModule');
  var ms=document.getElementById('errModalMsg');
  var det=document.getElementById('errModalDetail');
  var modal=document.getElementById('errModal');
  if(!modal){ alert((title||'Error')+'\n\n'+(msg||'Error inesperado.')); return; }
  if(t)  t.textContent  = title  || 'Error';
  if(mo) mo.textContent = module ? '[ '+module+' ]' : '';
  if(ms) ms.textContent = msg    || 'Ocurrio un error inesperado.';
  if(det){
    if(detail){ det.textContent=detail; det.style.display='block'; }
    else { det.style.display='none'; }
  }
  modal.classList.add('open');
}
function closeErrModal(){ document.getElementById('errModal').classList.remove('open'); }
function showMErr(msg){ showError('Error — Job Matcher', msg, 'Job Matcher'); }
function showJDErr(msg){ showError('Error — JD Generator', msg, 'JD Generator'); }

function markdownToHTML(text) {
  if(!text) return '';
  var html = text.replace(/\*\*(.*?)\*\*/g,'<strong>$1</strong>');
  html = html.replace(/\n/g,'<br>');
  return html;
}

// ── JOB MATCHER ────────────────────────────────────────────────────────────
function showUzSpinner(id, msg){
  var el=document.getElementById(id);
  if(!el) return;
  el.style.display='flex';
  el.style.flexDirection='column';
  el.style.alignItems='center';
  el.style.justifyContent='center';
  el.innerHTML='<div style="display:flex;align-items:center;gap:10px;padding:16px;">'
    +'<div style="width:22px;height:22px;border:3px solid #E8ECF2;border-top-color:#0A1F44;border-radius:50%;animation:spin .8s linear infinite;flex-shrink:0;"></div>'
    +'<span style="font-size:12px;color:var(--text2);">'+msg+'</span>'
    +'</div>';
}

async function uploadMatcherFile(file, type) {
  var isProject = type==='project';
  var uzId      = isProject ? 'm-project-uz'              : 'm-job-uz';
  var sumId     = isProject ? 'm-project-summary'         : 'm-job-summary';
  var taId      = isProject ? 'm-project-summary-content' : 'm-job-summary-content';
  var fnId      = isProject ? 'm-project-fn'              : 'm-job-fn';

  // Swap inmediatamente: ocultar uz, mostrar textarea con placeholder
  var uzEl  = document.getElementById(uzId);
  var sumEl = document.getElementById(sumId);
  var taEl  = document.getElementById(taId);
  var fnEl  = document.getElementById(fnId);

  // Mostrar spinner dentro del uz mientras procesa
  showUzSpinner(uzId, 'Leyendo '+file.name+'...');
  if(fnEl) { fnEl.textContent=file.name; }

  showLoading('Leyendo documento...','Extrayendo texto de '+file.name);
  var form=new FormData(); form.append('file',file);
  try {
    var res=await fetch(API_URL+'/upload',{method:'POST',body:form});
    var data=await res.json();
    if(data.success && data.text) {
      if(isProject) {
        _m.projectText=data.text;
        setMStep(2);
      } else {
        _m.jobText=data.text;
        setMStep(2);
      }
      // Mostrar placeholder mientras Claude genera el resumen
      if(uzEl)  { uzEl.style.display='none'; }
      if(sumEl) { sumEl.style.display='block'; }
      if(taEl)  { taEl.innerHTML='<div style="display:flex;align-items:center;gap:10px;">'+'<div style="width:18px;height:18px;border:2px solid #E8ECF2;border-top-color:#0A1F44;border-radius:50%;animation:spin .8s linear infinite;flex-shrink:0;"></div>'+'<span style="color:var(--text2);font-size:12px;">Generando resumen estructurado con Claude...</span>'+'</div>'; }
      hideLoading();
      // Generar resumen estructurado
      try {
        var sr=await fetch(API_URL+'/summarize',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text:data.text,type:type})});
        var sd=await sr.json();
        if(taEl) {
          if(sd.success && sd.summary){
            var html=sd.summary.replace(/\*\*(.*?)\*\*/g,'<strong>$1</strong>').replace(/\n/g,'<br>');
            taEl.innerHTML=html;
            if(isProject) _m.projectSummary=sd.summary;
            else          _m.jobSummary=sd.summary;
          } else {
            taEl.innerHTML=data.text.substring(0,4000).replace(/\n/g,'<br>');
          }
        }
      } catch(e2){
        if(taEl){ taEl.innerHTML=data.text.substring(0,4000).replace(/\n/g,'<br>'); }
      }
    } else {
      if(taEl){ taEl.innerHTML='<span style="color:var(--red);">Error al procesar el archivo. Intenta de nuevo.</span>'; }
      hideLoading();
    }
  } catch(e){
    console.error('uploadMatcherFile error:',e);
    if(taEl){ taEl.innerHTML='<span style="color:var(--red);">Error de conexion. Verifica que el servidor este corriendo.</span>'; }
    hideLoading();
  }
}

async function uploadCVs(files) {
  var candList=document.getElementById('m-cand-list');
  if(candList){ candList.innerHTML='<div style="display:flex;align-items:center;gap:10px;padding:16px 0;">'+'<div style="width:22px;height:22px;border:3px solid #E8ECF2;border-top-color:#0A1F44;border-radius:50%;animation:spin .8s linear infinite;flex-shrink:0;"></div>'+'<span style="font-size:12px;color:var(--text2);">Leyendo y extrayendo texto de los CVs...</span>'+'</div>'; }
  showLoading('Procesando CVs...','Extrayendo texto de los curriculos');
  for(var i=0;i<files.length;i++){
    var file=files[i];
    var form=new FormData(); form.append('file',file);
    try {
      var res=await fetch(API_URL+'/upload',{method:'POST',body:form});
      var data=await res.json();
      if(data.success && data.text){
        var rawName=file.name.replace(/\.[^/.]+$/,'');
        rawName=rawName.replace(/^(CV|cv|Curriculum|curriculum|Resume|resume)[_\-\s]*/i,'');
        rawName=rawName.replace(/[_\-\s]*(CV|cv|LiderTecnico|FullStack|QA|Dev|Developer|Senior|Junior|SSr|Sr|Jr)[_\-\s]*/gi,' ');
        rawName=rawName.replace(/[_\-]/g,' ').replace(/\s+/g,' ').trim();
        rawName=rawName.split(' ').map(function(w){ return w.charAt(0).toUpperCase()+w.slice(1).toLowerCase(); }).join(' ');
        _m.candidates.push({ fileName:file.name, name:rawName||file.name.replace(/\.[^/.]+$/,''), text:data.text });
      }
    } catch(e){ console.error('uploadCV error:',e); }
  }
  if(_m.candidates.length>0) setMStep(3);
  renderCandList();
  hideLoading();
}

function renderCandList(){
  var el=document.getElementById('m-cand-list');
  var count=document.getElementById('m-cand-count');
  if(!_m.candidates.length){
    count.textContent='Sin candidatos cargados';
    el.innerHTML='<div class="empty-state"><div class="empty-ico">&#128101;</div><div class="empty-t">Sin candidatos</div><div class="empty-s">Subi uno o mas CVs para evaluar</div></div>';
    return;
  }
  count.textContent=_m.candidates.length+' candidato'+ (_m.candidates.length!==1?'s':'')+' cargado'+(_m.candidates.length!==1?'s':'');
  el.innerHTML=_m.candidates.map(function(c,i){
    var initials=c.name.split(' ').slice(0,2).map(function(w){return w[0]||'';}).join('').toUpperCase();
    return '<div class="cand-item">'
      +'<div class="cand-av">'+initials+'</div>'
      +'<div style="flex:1;"><div style="font-size:12px;font-weight:600;">'+c.name+'</div><div style="font-size:10px;color:var(--text2);">'+c.fileName+'</div></div>'
      +'<button onclick="removeCV('+i+')" style="background:#FDECEA;border:none;border-radius:5px;color:var(--red);font-size:11px;cursor:pointer;padding:3px 7px;">&#10005;</button></div>';
  }).join('');
}
function removeCV(i){ _m.candidates.splice(i,1); renderCandList(); }

async function runMatcher(){
  if(!_m.jobText){ showMErr('Falta la descripcion del puesto.'); return; }
  if(!_m.candidates.length){ showMErr('Falta subir al menos un CV.'); return; }
  document.getElementById('m-btn-analyze').disabled=true;
  document.getElementById('m-results').innerHTML='';
  document.getElementById('m-prog').style.display='block';
  setMStep(4);
  setTimeout(function(){ window.scrollTo({top:document.body.scrollHeight,behavior:'smooth'}); },200);
  _m.results=[];
  setPS('mp1','run'); await sleep(400); setPS('mp1','done');
  setPS('mp2','run');
  for(var i=0;i<_m.candidates.length;i++){
    var cand=_m.candidates[i];
    try {
      var res=await fetch(API_URL+'/analyze',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({
        candidateName:cand.name, candidateText:cand.text,
        jobText:(document.getElementById('m-job-summary-content')&&document.getElementById('m-job-summary-content').innerText)||_m.jobText,
        projectText:(document.getElementById('m-project-summary-content')&&document.getElementById('m-project-summary-content').innerText)||_m.projectText
      })});
      var data=await res.json();
      if(data.success && data.analysis){
        try {
          var jsonText=data.analysis.replace(/```json\n?/g,'').replace(/```\n?/g,'').trim();
          var analysis=JSON.parse(jsonText);
          _m.results.push({ candidateName:cand.name, analysis:analysis });
          renderMatcherResult(cand.name, analysis, _m.results.length);
        } catch(parseErr){
          showError('Error al procesar respuesta',
            'Claude respondio pero el formato del analisis es invalido para '+cand.name+'.',
            'Job Matcher', parseErr.message);
        }
      } else if(!data.success){
        showError('Error en el analisis',
          data.error || 'No se pudo analizar a '+cand.name+'.',
          'Job Matcher');
      }
    } catch(e){
      console.error('matcher error for '+cand.name+':',e);
      showError('Error al analizar candidato',
        'No se pudo analizar a '+cand.name+'. Verifica la conexion y que el servidor este corriendo.',
        'Job Matcher', e.message);
    }
  }
  setPS('mp2','done'); setPS('mp3','run'); await sleep(300); setPS('mp3','done');
  document.getElementById('m-prog').style.display='none';
  document.getElementById('m-btn-analyze').disabled=false;
  hideLoading();
  if(_m.results.length>0){
    setMStep(5);
    document.getElementById('m-pdf-wrap').style.display='block';
  } else {
    showError('Sin resultados',
      'No se pudo generar ningun resultado. Verifica que el servidor este corriendo y que la API key sea valida.',
      'Job Matcher');
  }
}

function renderMatcherResult(name, analysis, idx){
  var div=document.createElement('div');
  div.className='card'; div.style.marginBottom='14px';
  var scores=analysis.scores_detallados||{};
  var scoreRows='<div style="margin-bottom:8px;"><p style="font-size:13px;font-weight:700;color:var(--text);margin-bottom:10px;">Scores Detallados (8 Dimensiones)</p>'
    + Object.entries(scores).map(function(e){
      var lbl=e[0].replace('fit_','').replace(/_/g,' '); lbl=lbl.charAt(0).toUpperCase()+lbl.slice(1);
      var val=e[1];
      return '<div style="margin-bottom:8px;">'
        +'<div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:4px;">'
        +'<span style="color:var(--text);font-weight:700;">'+lbl+'</span>'
        +'<span style="font-weight:700;color:var(--text);">'+val+'%</span>'
        +'</div>'
        +'<div style="width:100%;background:#E8ECF2;border-radius:9999px;height:8px;">'
        +'<div style="background:#4472C4;height:8px;border-radius:9999px;width:'+val+'%;"></div>'
        +'</div>'
        +'</div>';
    }).join('')
    +'</div>';
  var initials=name.split(' ').slice(0,2).map(function(w){return w[0]||'';}).join('').toUpperCase();
  var recColor=analysis.recomendacion&&analysis.recomendacion.toLowerCase().includes('contratar')?'badge-green':
               analysis.recomendacion&&analysis.recomendacion.toLowerCase().includes('descartar')?'badge-red':'badge-orange';
  function makeList(items,color){
    if(!items||!items.length) return '';
    return items.map(function(item){
      return '<li style="margin-bottom:5px;font-size:12px;line-height:1.5;">'+item+'</li>';
    }).join('');
  }
  var fort = (analysis.fortalezas_criticas||[]).concat(analysis.fortalezas_adicionales||[]);
  var brec = (analysis.brechas_criticas||[]).concat(analysis.brechas_menores||[]);
  var redf = analysis.red_flags||[];
  var fbSection='';
  if(fort.length||brec.length||redf.length){
    fbSection='<div style="margin-bottom:14px;padding:14px 0;border-top:1px solid var(--gray2);">';
    fbSection+='<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:12px;">';
    fbSection+='<div>';
    fbSection+='<p style="font-size:13px;font-weight:700;color:#00875A;margin-bottom:8px;">Fortalezas</p>';
    if(fort.length){
      fbSection+='<ul style="padding-left:16px;margin:0;">'+makeList(fort,'#00875A')+'</ul>';
    } else {
      fbSection+='<p style="font-size:12px;color:var(--text2);">Sin fortalezas identificadas</p>';
    }
    fbSection+='</div>';
    fbSection+='<div>';
    fbSection+='<p style="font-size:13px;font-weight:700;color:#C96A00;margin-bottom:8px;">Brechas</p>';
    if(brec.length){
      fbSection+='<ul style="padding-left:16px;margin:0;">'+makeList(brec,'#C96A00')+'</ul>';
    } else {
      fbSection+='<p style="font-size:12px;color:var(--text2);">Sin brechas identificadas</p>';
    }
    fbSection+='</div>';
    fbSection+='</div>';
    if(redf.length){
      fbSection+='<div>';
      fbSection+='<p style="font-size:13px;font-weight:700;color:#C0392B;margin-bottom:8px;">Red Flags</p>';
      fbSection+='<ul style="padding-left:16px;margin:0;">'+makeList(redf,'#C0392B')+'</ul>';
      fbSection+='</div>';
    }
    fbSection+='</div>';
  }
  // Preguntas Sugeridas en Entrevista
  var pregs = analysis.puntos_validar_entrevista || [];
  if(pregs.length > 10) pregs = pregs.slice(0, 10);
  var pregSection = '';
  if(pregs.length){
    pregSection = '<div style="margin-bottom:14px;padding:14px 0;border-top:1px solid var(--gray2);">';
    pregSection += '<p style="font-size:13px;font-weight:700;color:#0A1F44;margin-bottom:10px;">Preguntas Sugeridas en Entrevista</p>';
    pregSection += '<ol style="padding-left:18px;margin:0;">';
    pregs.forEach(function(q, i){
      pregSection += '<li style="font-size:12px;line-height:1.65;margin-bottom:7px;color:var(--text);">'+q+'</li>';
    });
    pregSection += '</ol>';
    pregSection += '</div>';
  }

  div.innerHTML='<div class="card-head">'
    +'<div style="display:flex;align-items:center;gap:10px;">'
    +'<div style="width:38px;height:38px;background:var(--blue);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;color:white;flex-shrink:0;">'+initials+'</div>'
    +'<div><div style="font-size:14px;font-weight:700;">'+name+'</div>'
    +'<span class="badge '+recColor+'" style="margin-top:3px;">'+analysis.recomendacion+'</span></div></div>'
    +'<div style="text-align:right;"><div style="font-size:32px;font-weight:700;color:var(--blue);line-height:1;">'+analysis.compatibilidad_general+'%</div><div style="font-size:10px;color:var(--text2);">compatibilidad</div></div></div>'
    +'<div class="card-body">'
    +'<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:14px;">'
    +'<div class="kpi-box"><div class="kpi-n" style="color:var(--blue);">'+analysis.compatibilidad_general+'</div><div class="kpi-l">Compatibilidad</div></div>'
    +'<div class="kpi-box"><div class="kpi-n" style="font-size:13px;">'+analysis.nivel_match+'</div><div class="kpi-l">Nivel</div></div>'
    +'<div class="kpi-box"><div class="kpi-n" style="font-size:11px;color:var(--text2);">'+(analysis.fortalezas_criticas&&analysis.fortalezas_criticas.length?analysis.fortalezas_criticas.length:0)+' fortalezas</div><div class="kpi-l">Criticas</div></div></div>'
    +'<div style="margin-bottom:14px;">'+scoreRows+'</div>'
    +fbSection
    +pregSection
    +'<div style="border:1px solid var(--border);border-radius:10px;overflow:hidden;">'
    +'<div style="background:var(--gray1);padding:11px 14px;border-bottom:1px solid var(--gray2);display:flex;align-items:center;gap:9px;">'
    +'<div style="width:28px;height:28px;background:var(--blue);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;color:white;flex-shrink:0;">CJ</div>'
    +'<div><div style="font-size:12px;font-weight:700;color:var(--blue);">ChatJob</div><div style="font-size:10px;color:var(--text2);">Pregunta sobre el candidato, el JD o el proyecto</div></div></div>'
    +'<div class="chat-msgs" id="cj-msgs-'+idx+'"></div>'
    +'<div class="chat-inp-row"><input type="text" class="chat-inp" id="cj-inp-'+idx+'" placeholder="Pregunta sobre el candidato..." onkeydown="if(event.key===\'Enter\')sendCJ('+idx+')">'
    +'<button class="btn-blue btn-sm" onclick="sendCJ('+idx+')">Enviar</button></div></div>'
    +'</div>';
  document.getElementById('m-results').appendChild(div);
}

function generatePDF(){
  if(!window.jspdf){ alert('jsPDF no disponible'); return; }
  var jsPDF=window.jspdf.jsPDF;
  var doc=new jsPDF();
  var yPos=20, pageH=doc.internal.pageSize.height, marginB=20, lh=5;
  function chk(sp){ if(yPos+sp>pageH-marginB){ doc.addPage(); yPos=20; } }
  function sec(label,r,g,b){
    chk(20); doc.setFont(undefined,'bold'); doc.setFontSize(12); doc.setTextColor(r,g,b);
    doc.text(label,20,yPos); yPos+=7;
    doc.setFont(undefined,'normal'); doc.setFontSize(10); doc.setTextColor(0,0,0);
  }
  function items(arr){
    arr.forEach(function(item){
      var ls=doc.splitTextToSize('- '+item,170);
      ls.forEach(function(l){ chk(8); doc.text(l,25,yPos); yPos+=lh; });
    }); yPos+=3;
  }
  function para(text){
    var ls=doc.splitTextToSize(text,170);
    ls.forEach(function(l){ chk(8); doc.text(l,20,yPos); yPos+=lh; }); yPos+=5;
  }

  // Portada
  doc.setFontSize(18); doc.setTextColor(68,114,196); doc.setFont(undefined,'bold');
  doc.text('CFOTech IT Tools',105,yPos,{align:'center'}); yPos+=9;
  doc.setFontSize(13); doc.setTextColor(60,60,60); doc.setFont(undefined,'normal');
  doc.text('Informe de Analisis de Candidatos',105,yPos,{align:'center'}); yPos+=7;
  doc.setFontSize(10); doc.setTextColor(120,120,120);
  doc.text('Fecha: '+new Date().toLocaleDateString('es-AR'),105,yPos,{align:'center'}); yPos+=14;

  _m.results.forEach(function(result,index){
    var name=result.candidateName;
    var a=result.analysis;
    if(index>0){ doc.addPage(); yPos=20; }

    // Nombre + recomendacion
    doc.setFontSize(15); doc.setTextColor(68,114,196); doc.setFont(undefined,'bold');
    chk(20); doc.text(name,20,yPos); yPos+=9;
    doc.setFontSize(11); doc.setTextColor(0,0,0); doc.setFont(undefined,'normal');
    doc.text('Compatibilidad: '+a.compatibilidad_general+'%',20,yPos);
    doc.text('Nivel: '+a.nivel_match,90,yPos); yPos+=6;
    doc.text('Recomendacion: '+a.recomendacion,20,yPos); yPos+=10;

    // Scores
    sec('Scores Detallados (8 Dimensiones):',68,114,196);
    Object.entries(a.scores_detallados||{}).forEach(function(e){
      var lbl=e[0].replace('fit_','').replace(/_/g,' ');
      lbl=lbl.charAt(0).toUpperCase()+lbl.slice(1);
      chk(8); doc.text(lbl+': '+e[1]+'%',25,yPos); yPos+=lh;
    }); yPos+=5;

    // Fortalezas unificadas
    var fort=(a.fortalezas_criticas||[]).concat(a.fortalezas_adicionales||[]);
    if(fort.length){ sec('Fortalezas:',0,135,90); items(fort); }

    // Brechas unificadas
    var brec=(a.brechas_criticas||[]).concat(a.brechas_menores||[]);
    if(brec.length){ sec('Brechas:',201,106,0); items(brec); }

    // Red Flags
    if(a.red_flags&&a.red_flags.length){ sec('Red Flags:',192,57,43); items(a.red_flags); }

    // Puntos a validar
    if(a.puntos_validar_entrevista&&a.puntos_validar_entrevista.length){
      sec('Puntos a Validar en Entrevista:',68,114,196); items(a.puntos_validar_entrevista);
    }

    // Analisis textuales
    if(a.analisis_tecnico_detallado){ sec('Analisis Tecnico:',68,114,196); para(a.analisis_tecnico_detallado); }
    if(a.analisis_experiencia_liderazgo){ sec('Analisis Experiencia y Liderazgo:',68,114,196); para(a.analisis_experiencia_liderazgo); }
    if(a.analisis_cultural_comunicacion){ sec('Analisis Cultural y Comunicacion:',68,114,196); para(a.analisis_cultural_comunicacion); }
    if(a.justificacion_recomendacion){ sec('Justificacion:',68,114,196); para(a.justificacion_recomendacion); }

    // ChatJob Q&A
    var cjMsgs=document.getElementById('cj-msgs-'+(index+1));
    if(cjMsgs){
      var qs=[],as_=[];
      var nodes=Array.prototype.slice.call(cjMsgs.querySelectorAll('.msg-u,.msg-a'));
      var lastQ=null;
      nodes.forEach(function(n){
        if(n.classList.contains('msg-u')){ lastQ=n.textContent.trim(); }
        else if(lastQ){ qs.push(lastQ); as_.push(n.textContent.trim()); lastQ=null; }
      });
      if(qs.length){
        sec('Preguntas y Respuestas:',68,114,196);
        qs.forEach(function(q,qi){
          chk(20);
          doc.setFont(undefined,'bold'); doc.setFontSize(10); doc.setTextColor(68,114,196);
          doc.text('P'+(qi+1)+':',20,yPos);
          doc.setFont(undefined,'normal'); doc.setTextColor(0,0,0);
          var ql=doc.splitTextToSize(q,163); ql.forEach(function(l){ chk(8); doc.text(l,28,yPos); yPos+=lh; }); yPos+=2;
          doc.setFont(undefined,'bold'); doc.setTextColor(68,114,196);
          doc.text('R:',20,yPos);
          doc.setFont(undefined,'normal'); doc.setTextColor(0,0,0);
          var al=doc.splitTextToSize(as_[qi]||'',163); al.forEach(function(l){ chk(8); doc.text(l,28,yPos); yPos+=lh; }); yPos+=5;
        });
      }
    }
  });

  var fecha=new Date().toISOString().split('T')[0];
  doc.save('Informe_Candidatos_'+fecha+'.pdf');
}

async function sendCJ(idx){
  var inp=document.getElementById('cj-inp-'+idx);
  var txt=inp.value.trim(); if(!txt) return;
  var msgs=document.getElementById('cj-msgs-'+idx);
  var u=document.createElement('div'); u.className='msg-u'; u.style.background='var(--blue)'; u.textContent=txt;
  msgs.appendChild(u); inp.value=''; msgs.scrollTop=msgs.scrollHeight;
  var result=_m.results[idx-1];
  var a=document.createElement('div'); a.className='msg-a'; a.textContent='...';
  msgs.appendChild(a); msgs.scrollTop=msgs.scrollHeight;
  try {
    var res=await fetch(API_URL+'/ask-question',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({
      question:txt,
      analysisResult:result&&result.analysis,
      projectContext:_m.projectSummary||_m.projectText,
      jobDescription:_m.jobSummary||_m.jobText
    })});
    var data=await res.json();
    var answerText=data.success?data.answer:('Error: '+(data.error||'Sin respuesta'));
    a.innerHTML=markdownToHTML(answerText);
    a.style.lineHeight='1.7';
  } catch(e){ a.textContent='Error de conexion.'; }
  msgs.scrollTop=msgs.scrollHeight;
}

// ── JD GENERATOR ───────────────────────────────────────────────────────────
var STEP_LABELS=['','Sube la propuesta para comenzar','Equipo detectado — selecciona un perfil','Refinamiento — responde las preguntas','Generando el Job Description...','JD listo para descargar'];
function setJDStep(n){
  for(var i=1;i<=5;i++){
    var state=i<n?'done':(i===n?'act':'pend');
    var dot=document.getElementById('jsd'+i);
    var lbl=document.getElementById('jsdl'+i);
    var ln =document.getElementById('jsl'+i);
    if(dot){ dot.className='sd '+state; dot.textContent=i<n?'\u2713':String(i); }
    if(lbl){ lbl.className='sd-lbl '+state; }
    if(ln) { ln.className='sl '+(i<n?'done':'pend'); }
  }
}

function setMStep(n){
  for(var i=1;i<=5;i++){
    var state=i<n?'done':(i===n?'act':'pend');
    var dot=document.getElementById('msd'+i);
    var lbl=document.getElementById('msdl'+i);
    var ln =document.getElementById('msl'+i);
    if(dot){ dot.className='sd '+state; dot.textContent=i<n?'\u2713':String(i); }
    if(lbl){ lbl.className='sd-lbl '+state; }
    if(ln) { ln.className='sl '+(i<n?'done':'pend'); }
  }
}

async function setJDFile(file){
  _jd.file=file;

  var uzEl  = document.getElementById('jd-uz');
  var sumEl = document.getElementById('jd-propuesta-summary');
  var taEl  = document.getElementById('jd-propuesta-summary-content');
  var fnEl  = document.getElementById('jd-propuesta-fn');

  // Mostrar spinner en el uz mientras procesa
  showUzSpinner('jd-uz', 'Leyendo '+file.name+'...');
  if(fnEl) fnEl.textContent = file.name;

  showLoading('Leyendo propuesta...','Extrayendo texto de '+file.name);
  var form = new FormData(); form.append('file', file);
  try {
    var res  = await fetch(API_URL+'/upload',{method:'POST',body:form});
    var data = await res.json();
    if(data.success && data.text){
      _jd.propuestaText = data.text;
      // Ocultar uz, mostrar area de resumen
      if(uzEl)  uzEl.style.display  = 'none';
      if(sumEl) sumEl.style.display = 'block';
      if(taEl)  taEl.innerHTML = '<div style="display:flex;align-items:center;gap:10px;">'
        +'<div style="width:18px;height:18px;border:2px solid #E8ECF2;border-top-color:#0A1F44;border-radius:50%;animation:spin .8s linear infinite;flex-shrink:0;"></div>'
        +'<span style="color:var(--text2);font-size:12px;">Generando resumen con Claude...</span>'
        +'</div>';
      hideLoading();
      // Generar resumen estructurado via /summarize
      try {
        var sr = await fetch(API_URL+'/summarize',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text:data.text,type:'propuesta'})});
        var sd = await sr.json();
        if(taEl){
          if(sd.success && sd.summary){
            var html = sd.summary.replace(/\*\*(.*?)\*\*/g,'<strong>$1</strong>').replace(/\n/g,'<br>');
            taEl.innerHTML = html;
            _jd.propuestaSummary = sd.summary;
          } else {
            taEl.innerHTML = data.text.substring(0,4000).replace(/\n/g,'<br>');
          }
        }
      } catch(e2){
        if(taEl) taEl.innerHTML = data.text.substring(0,4000).replace(/\n/g,'<br>');
      }
    } else {
      if(taEl) taEl.innerHTML = '<span style="color:var(--red);">Error al procesar el archivo. Intenta de nuevo.</span>';
      hideLoading();
    }
  } catch(e){
    console.error('setJDFile error:',e);
    if(taEl) taEl.innerHTML = '<span style="color:var(--red);">Error de conexion. Verifica que el servidor este corriendo.</span>';
    hideLoading();
  }
}

async function runJDAnalyze(){
  if(!_jd.file){ showJDErr('Falta adjuntar la propuesta tecnica.'); return; }
  document.getElementById('jd-btn-analyze').disabled=true;
  document.getElementById('jd-card-equipo').style.display='none';
  document.getElementById('jd-card-chat').style.display='none';
  document.getElementById('jd-btn-gen-wrap').style.display='none';
  document.getElementById('jd-result').style.display='none';
  document.getElementById('jd-prog-analyze').style.display='block';
  ['jpa1','jpa2','jpa3','jpa4'].forEach(function(id){setPS(id,null);});
  setJDStep(2);
  try {
    setPS('jpa1','run'); await sleep(300); setPS('jpa1','done');
    setPS('jpa2','run');
    var form=new FormData(); form.append('propuesta',_jd.file);
    var ctx=document.getElementById('jd-ctx').value.trim(); if(ctx) form.append('contexto',ctx);
    var res=await fetch(API_URL+'/api/analyze',{method:'POST',body:form});
    setPS('jpa2','done'); setPS('jpa3','run'); await sleep(200); setPS('jpa3','done');
    if(!res.ok){ var e=await res.json().catch(function(){return{};}); throw new Error(e.error||'Error del servidor ('+res.status+')'); }
    var data=await res.json();
    if(!data.success) throw new Error(data.error||'Error en el analisis');
    setPS('jpa4','run'); await sleep(200); setPS('jpa4','done');
    _jd.analysis=data.analysis; _jd.perfiles=data.analysis.perfiles_identificados||[];
    await sleep(300);
    document.getElementById('jd-prog-analyze').style.display='none';
    renderEquipo(data.analysis);
    setJDStep(2);
  } catch(err){
    document.getElementById('jd-prog-analyze').style.display='none';
    setJDStep(1); showError('Error al analizar propuesta', err.message||'No se pudo analizar la propuesta.', 'JD Generator');
  }
  document.getElementById('jd-btn-analyze').disabled=false;
}

function renderEquipo(a){
  var total=a.total_jds||0;
  document.getElementById('jd-equipo-title').textContent=(a.proyecto||'Proyecto')+' \u2014 '+total+' JD'+(total!==1?'s':'')+' a generar';
  document.getElementById('jd-equipo-sub').textContent='Cliente: '+(a.cliente||'\u2014')+' \u00b7 '+(a.duracion||'Duracion no especificada')+' \u00b7 Hac\u00e9 click en "Generar JD" en el perfil que quer\u00e9s armar';
  var grid=document.getElementById('jd-profile-grid'); grid.innerHTML='';
  _jd.perfiles.forEach(function(p,idx){
    var div=document.createElement('div');
    div.className='pcard '+(p.proveedor==='CFOTech'?'cfo':'cli');
    var pBadge=p.proveedor==='CFOTech'?'<span class="ptag ptag-g">CFOTech</span>':'<span class="ptag ptag-n">'+p.proveedor+'</span>';
    var sBadge='<span class="ptag ptag-b">'+p.seniority+'</span>';
    var warn=p.preguntas_refinamiento&&p.preguntas_refinamiento.length?'<div style="font-size:9px;color:var(--orange);margin-bottom:4px;">\u26a0 Hay preguntas de refinamiento</div>':'';
    var btn=p.jd_recomendado&&p.proveedor==='CFOTech'
      ?'<button class="jd-btn" id="btn-p-'+idx+'" onclick="selectJDProfile('+idx+')">Generar JD</button>'
      :'<div style="font-size:10px;color:var(--text2);margin-top:5px;">'+(p.proveedor!=='CFOTech'?'Perfil del cliente, no requiere JD':'')+'</div>';
    div.innerHTML='<div class="pcard-r">'+p.rol+'</div><div class="pcard-t">'+p.tipo+'</div><div>'+pBadge+' '+sBadge+'</div><div style="font-size:10px;color:var(--text2);margin:5px 0 4px;line-height:1.4;">'+p.justificacion+'</div>'+warn+btn;
    grid.appendChild(div);
  });
  if(a.observaciones){ var ob=document.getElementById('jd-obs'); ob.style.display='block'; ob.textContent='\u128712 '+a.observaciones; }
  document.getElementById('jd-card-equipo').style.display='block';
}

function selectJDProfile(idx){
  var p=_jd.perfiles[idx]; if(!p) return;
  _jd.selectedIdx=idx; _jd.chatHistory=[];
  document.getElementById('jd-iRol').value=p.rol||'';
  document.getElementById('jd-iCliente').value=(_jd.analysis&&_jd.analysis.cliente)||'CFOTech';
  document.getElementById('jd-iTipo').value=p.tipo||'';
  document.getElementById('jd-iSen').value=p.seniority||'';
  _jd.perfiles.forEach(function(pp,i){
    var b=document.getElementById('btn-p-'+i);
    if(b){b.style.background='var(--navy)';b.textContent='Generar JD';b.classList.remove('sel');}
  });
  var btnSel=document.getElementById('btn-p-'+idx);
  if(btnSel){btnSel.style.background='var(--green)';btnSel.textContent='\u2713 Seleccionado';btnSel.classList.add('sel');}
  document.getElementById('jd-chat-sub').textContent='Refinamiento para: '+p.rol;
  var msgs=document.getElementById('jd-chat-msgs'); msgs.innerHTML='';
  addJDMsg('agent','Voy a generar el JD para <strong>'+p.rol+'</strong> ('+p.tipo+', '+p.seniority+').');
  document.getElementById('jd-result').style.display='none';
  document.getElementById('jd-btn-gen-wrap').style.display='none';
  if(p.preguntas_refinamiento&&p.preguntas_refinamiento.length){
    addJDMsg('agent','Antes de continuar, necesito confirmar algunos puntos:');
    p.preguntas_refinamiento.forEach(function(q,i){ setTimeout(function(){addJDMsg('agent',(i+1)+'. '+q);},200*(i+1)); });
    setTimeout(function(){addJDMsg('agent','Respond\u00e9las o hac\u00e9 click en Generar si est\u00e1 todo claro.');document.getElementById('jd-btn-gen-wrap').style.display='block';},200*(p.preguntas_refinamiento.length+1));
  } else {
    addJDMsg('agent','No hay ambig\u00fcedades detectadas. Pod\u00e9s agregar contexto o hacer click en Generar JD directamente.');
    document.getElementById('jd-btn-gen-wrap').style.display='block';
  }
  document.getElementById('jd-card-chat').style.display='block';
  setJDStep(3);
  document.getElementById('jd-card-chat').scrollIntoView({behavior:'smooth',block:'nearest'});
}

function addJDMsg(who,html){
  var msgs=document.getElementById('jd-chat-msgs');
  var wrap=document.createElement('div');
  wrap.style.cssText='display:flex;align-items:flex-start;gap:8px;'+(who==='user'?'flex-direction:row-reverse;':'');
  var av=document.createElement('div');
  av.style.cssText='width:26px;height:26px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:700;color:white;flex-shrink:0;background:'+(who==='user'?'var(--green)':'var(--navy)');
  av.textContent=who==='user'?'Tu':'JD';
  var bub=document.createElement('div'); bub.className=who==='agent'?'msg-a':'msg-u'; bub.innerHTML=html;
  wrap.appendChild(av); wrap.appendChild(bub); msgs.appendChild(wrap); msgs.scrollTop=msgs.scrollHeight;
  _jd.chatHistory.push({who:who,text:html.replace(/<[^>]+>/g,'')});
}

function sendJDChat(){
  var inp=document.getElementById('jd-inp'), txt=inp.value.trim(); if(!txt) return;
  addJDMsg('user',txt); inp.value='';
  setTimeout(function(){addJDMsg('agent','Anotado. Cuando est\u00e9s listo, hac\u00e9 click en Generar JD.');document.getElementById('jd-btn-gen-wrap').style.display='block';},500);
}

async function runJDGenerate(){
  var rol=document.getElementById('jd-iRol').value||'A definir';
  var cliente=document.getElementById('jd-iCliente').value||'CFOTech';
  var tipo=document.getElementById('jd-iTipo').value||'TECNICO_EJECUCION';
  var seniority=document.getElementById('jd-iSen').value||'Senior';
  var contexto=document.getElementById('jd-ctx').value.trim();
  var respuestas=_jd.chatHistory.filter(function(m){return m.who==='user';}).map(function(m){return m.text;}).join('; ');
  var tplId=getTplForPerfil(rol)||getTplForPerfil(tipo)||null;
  document.getElementById('jd-btn-gen').disabled=true;
  document.getElementById('jd-card-chat').style.opacity='0.5';
  document.getElementById('jd-btn-gen-wrap').style.opacity='0.5';
  document.getElementById('jd-prog-gen').style.display='block';
  ['jpg1','jpg2','jpg3','jpg4','jpg5'].forEach(function(id){setPS(id,null);});
  setJDStep(4);
  try {
    setPS('jpg1','run'); await sleep(300); setPS('jpg1','done');
    var form=new FormData();
    form.append('propuesta',_jd.file); form.append('cliente',cliente); form.append('rol',rol);
    form.append('tipo_perfil',tipo); form.append('seniority',seniority); form.append('contexto',contexto);
    if(respuestas) form.append('respuestas_refinamiento',respuestas);
    if(tplId)      form.append('template_id',tplId);
    setPS('jpg2','run');
    var res=await fetch(API_URL+'/api/generate',{method:'POST',body:form});
    setPS('jpg2','done'); setPS('jpg3','run'); await sleep(300); setPS('jpg3','done');
    setPS('jpg4','run'); await sleep(300); setPS('jpg4','done');
    if(!res.ok){ var e=await res.json().catch(function(){return{};}); throw new Error(e.error||'Error del servidor ('+res.status+')'); }
    setPS('jpg5','run');
    var blob=await res.blob(); setPS('jpg5','done');
    var meta={}; try{meta=JSON.parse(res.headers.get('X-JD-Summary')||'{}');}catch(e2){}
    _jd.blob=blob;
    _jd.name='JD_'+rol.replace(/[^a-zA-Z0-9]/g,'_')+'_'+cliente.replace(/[^a-zA-Z0-9]/g,'_')+'.docx';
    await sleep(400);
    document.getElementById('jd-prog-gen').style.display='none';
    document.getElementById('jd-card-chat').style.opacity='1';
    document.getElementById('jd-btn-gen-wrap').style.opacity='1';
    document.getElementById('jd-btn-gen').disabled=false;
    setJDStep(5);
    document.getElementById('jd-result-sub').textContent=(meta.posicion||rol)+' \u00b7 '+(meta.cliente||cliente);
    var secs=[
      {l:'Posicion',v:(meta.posicion||rol)+' \u00b7 '+(meta.seniority||seniority)},
      {l:'Proyecto',v:'Extraido 100% de la propuesta analizada'},
      {l:'Responsabilidades',v:'4 areas adaptadas al tipo: '+tipo},
      {l:'Conocimientos',v:'Tabla con 8 areas del stack del proyecto'},
      {l:'Habilidades blandas',v:'Derivadas del contexto real del proyecto'}
    ];
    document.getElementById('jd-result-secs').innerHTML=secs.map(function(s){
      return '<div class="sum-row"><span class="sum-arrow">\u2192</span><span><strong>'+s.l+':</strong> <span style="color:var(--text2);">'+s.v+'</span></span></div>';
    }).join('');
    document.getElementById('jd-result').style.display='block';
    document.getElementById('jd-result').scrollIntoView({behavior:'smooth',block:'nearest'});
  } catch(err){
    document.getElementById('jd-prog-gen').style.display='none';
    document.getElementById('jd-card-chat').style.opacity='1';
    document.getElementById('jd-btn-gen-wrap').style.opacity='1';
    document.getElementById('jd-btn-gen').disabled=false;
    setJDStep(3); showError('Error al generar JD', err.message||'No se pudo generar el Job Description.', 'JD Generator');
  }
}

function downloadDocx(){
  if(!_jd.blob) return;
  var url=URL.createObjectURL(_jd.blob), a=document.createElement('a');
  a.href=url; a.download=_jd.name; a.click(); URL.revokeObjectURL(url);
}

function resetJD(){
  document.getElementById('jd-result').style.display='none';
  document.getElementById('jd-card-chat').style.display='none';
  document.getElementById('jd-card-equipo').style.display='none';
  document.getElementById('jd-btn-gen-wrap').style.display='none';
  document.getElementById('jd-prog-gen').style.display='none';
  // Restaurar zona de upload
  var uzEl  = document.getElementById('jd-uz');
  var sumEl = document.getElementById('jd-propuesta-summary');
  var taEl  = document.getElementById('jd-propuesta-summary-content');
  var fnEl  = document.getElementById('jd-propuesta-fn');
  if(uzEl)  { uzEl.className='uz'; uzEl.style.display=''; }
  if(sumEl) sumEl.style.display='none';
  if(taEl)  taEl.innerHTML='';
  if(fnEl)  fnEl.textContent='';
  document.getElementById('jd-uz-content').innerHTML='<p style="font-size:20px;margin-bottom:5px;">&#128202;</p><p style="font-size:12px;font-weight:600;color:var(--text);">PDF o PPTX de la propuesta</p><p style="font-size:10px;color:var(--text2);">PDF, PPTX, DOCX &middot; Max 25MB</p>';
  document.getElementById('jd-file').value='';
  document.getElementById('jd-ctx').value='';
  document.getElementById('jd-btn-analyze').disabled=false;
  document.getElementById('jd-btn-gen').disabled=false;
  _jd.file=null; _jd.blob=null; _jd.name=null; _jd.analysis=null; _jd.perfiles=[]; _jd.selectedIdx=null; _jd.chatHistory=[]; _jd.propuestaText=null; _jd.propuestaSummary=null;
  setJDStep(1); window.scrollTo({top:0,behavior:'smooth'});
}













