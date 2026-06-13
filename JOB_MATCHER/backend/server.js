// override:true garantiza que .env siempre gana sobre variables
// heredadas del proceso padre (ej: el launcher que tiene PORT=4999).
require('dotenv').config({ override: true });

const express    = require('express');
const cors       = require('cors');
const multer     = require('multer');
const path       = require('path');
const fs         = require('fs');
const fetch      = require('node-fetch');
const pdfParse   = require('pdf-parse');
const mammoth    = require('mammoth');
const officeParser = require('officeparser');
const compression  = require('compression');   // S1-7

const app  = express();
const PORT = process.env.PORT || 5002;

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const PRICE_INPUT  = 3.0 / 1_000_000;
const PRICE_OUTPUT = 15.0 / 1_000_000;

// ── LOGGER ────────────────────────────────────────────────────────────────
const LOG_DIR = path.join(__dirname, '..', 'logs');
try { fs.mkdirSync(LOG_DIR, { recursive: true }); } catch(e) {}

function logLine(level, module, msg) {
  var now  = new Date();
  var date = now.toISOString().slice(0, 10);
  var time = now.toISOString().slice(0, 19).replace('T', ' ');
  var line = '[' + time + '] ' + level.padEnd(5) + ' [' + module.padEnd(10) + '] ' + msg;
  console.log(line);
  // appendFile async para no bloquear el event loop (S1-4)
  var file = path.join(LOG_DIR, 'trace_' + date + '.log');
  fs.appendFile(file, line + '\n', 'utf8', function(e) {
    if (e) console.error('Log write error:', e.message);
  });
}

function logTokens(module, direction, inputTk, outputTk) {
  var cost = (inputTk * PRICE_INPUT + outputTk * PRICE_OUTPUT).toFixed(6);
  logLine('INFO ', module,
    direction + ' — input: ' + inputTk.toLocaleString() + ' tokens' +
    ' | output: ' + outputTk.toLocaleString() + ' tokens' +
    ' | costo: $' + cost
  );
}

// ── MIDDLEWARE ────────────────────────────────────────────────────────────
app.use(compression());  // Gzip/Brotli — reduce payload hasta 70% en JSON (S1-7)
// CORS: solo el propio frontend y el portal shell pueden llamar a esta API
const CORS_ORIGINS = (process.env.CORS_ORIGINS || 'http://localhost:5002,http://localhost:5174').split(',');
app.use(cors({ origin: CORS_ORIGINS }));
app.use(express.json({ limit: '50mb' }));
// express.static eliminado — el frontend ahora corre en Vite :5003 (FASE 3)

const upload = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: 25 * 1024 * 1024 }
});
const uploadDisk = multer({ dest: path.join(__dirname, 'uploads') });

// Log every request
app.use(function(req, res, next) {
  logLine('INFO ', 'HTTP     ', req.method + ' ' + req.path);
  next();
});

// ── TEMPLATES EN DISCO ────────────────────────────────────────────────────
const _tplDir   = path.join(__dirname, '..', 'templates');
const _tplIndex = path.join(_tplDir, 'templates.json');

function tplLoad() {
  try {
    fs.mkdirSync(_tplDir, { recursive: true });
    if (fs.existsSync(_tplIndex)) return JSON.parse(fs.readFileSync(_tplIndex, 'utf8'));
  } catch(e) { logLine('ERROR', 'Templates ', 'Error cargando: ' + e.message); }
  return {};
}
function tplSave(db) {
  try { fs.writeFileSync(_tplIndex, JSON.stringify(db, null, 2), 'utf8'); }
  catch(e) { logLine('ERROR', 'Templates ', 'Error guardando: ' + e.message); }
}

var _templates = tplLoad();
var _templateIdCounter = Object.keys(_templates).length > 0
  ? Math.max.apply(null, Object.keys(_templates).map(Number)) + 1 : 1;
logLine('INFO ', 'Templates ', 'Cargados: ' + Object.keys(_templates).length + ' template(s) desde disco');

// ── SYSTEM PROMPTS ────────────────────────────────────────────────────────
const SYSTEM_MATCHER = `Eres un Director de Recursos Humanos con 20 años de experiencia en seleccion de talento tech.

METODOLOGIA DE EVALUACION:
PASO 1: Analizar JOB DESCRIPTION + PROYECTO para identificar PRIORIDADES
PASO 2: Evaluar CANDIDATO en 8 DIMENSIONES
1. FIT TECNICO (0-100)
2. FIT DE EXPERIENCIA (0-100)
3. FIT DE LIDERAZGO (0-100)
4. FIT CULTURAL (0-100)
5. FIT DE IDIOMAS Y COMUNICACION (0-100)
6. FIT DE FORMACION Y CERTIFICACIONES (0-100)
7. FIT DE COMPENSACION Y EXPECTATIVAS (0-100)
8. RED FLAGS Y ALERTAS (0-100)
PASO 3: Identificar FORTALEZAS, BRECHAS y RED FLAGS
PASO 4: Analisis DETALLADOS

Responde SOLO con JSON valido sin markdown:
{
  "compatibilidad_general": 0,
  "nivel_match": "",
  "recomendacion": "",
  "scores_detallados": {
    "fit_tecnico": 0, "fit_experiencia": 0, "fit_liderazgo": 0,
    "fit_cultural": 0, "fit_idiomas_comunicacion": 0,
    "fit_formacion_certificaciones": 0, "fit_compensacion_expectativas": 0,
    "red_flags_alertas": 0
  },
  "fortalezas_criticas": [],
  "fortalezas_adicionales": [],
  "brechas_criticas": [],
  "brechas_menores": [],
  "red_flags": [],
  "puntos_validar_entrevista": [],
  "analisis_tecnico_detallado": "",
  "analisis_experiencia_liderazgo": "",
  "analisis_cultural_comunicacion": "",
  "justificacion_recomendacion": ""
}`;

const SYSTEM_JDGEN = `Eres un agente experto en Recursos Humanos Tecnicos para empresas IT. Operas en dos modos.

MODO A - ANALISIS DE PROPUESTA
Lee la propuesta completa y extrae todos los perfiles buscando: equipos, roles, squads, responsabilidades, lider, developer, qa, devops, ux, pm, po.

CLASIFICAR CADA PERFIL:
- Tipo: LIDER_TECNICO, TECNICO_EJECUCION, FUNCIONAL, QA, DEVOPS, UX_UI
- Proveedor: CFOTech, Cliente, No especificado
- Seniority minimo inferido

REGLA CRITICA:
- Lider Tecnico: arquitectura, decisiones, coordinacion. Seniority Senior.
- Lider de Integraciones: especialista APIs/BFF. Perfil DIFERENTE con 5+ integraciones.
- Full Stack: implementa lo que el lider decide.
- QA: calidad, testing manual y automation.

RESPONDER con JSON puro sin markdown:
{
  "modo": "analisis",
  "proyecto": "", "cliente": "", "duracion": "", "stack_principal": [],
  "perfiles_identificados": [{
    "rol": "", "tipo": "", "proveedor": "", "seniority": "",
    "justificacion": "", "jd_recomendado": true, "preguntas_refinamiento": []
  }],
  "total_jds": 0, "observaciones": ""
}

MODO B - GENERACION DE JD
TODO el contenido viene de la propuesta. Cero invencion.
Lider Tecnico NO implementa features. Full Stack NO define arquitectura.

ESTRUCTURA DE RESPONSABILIDADES:
- LIDER_TECNICO: arquitectura, integraciones_liderazgo, coordinacion_equipo, calidad_proceso
- TECNICO_EJECUCION: desarrollo_backend, desarrollo_frontend, integraciones_implementacion, calidad_codigo
- QA: testing_manual, testing_automatizado, gestion_defectos, colaboracion_equipo
- DEVOPS: infraestructura_cloud, ci_cd, contenedores, monitoreo
- UX_UI: diseno_ux, diseno_ui, investigacion, colaboracion_producto
- FUNCIONAL: gestion_backlog, historias_usuario, coordinacion_stakeholders, seguimiento

RESPONDER con JSON puro sin markdown:
{
  "modo": "generacion",
  "descripcion": { "cliente": "", "posicion": "", "seniority": "", "estado": "Nueva", "vacantes": "" },
  "detalle_proyecto": "",
  "responsabilidades": { "area1": "", "area2": "", "area3": "", "area4": "" },
  "conocimientos_obligatorios": { "area1": "", "area2": "", "area3": "", "area4": "", "area5": "", "area6": "", "area7": "", "area8": "" },
  "conocimientos_valorados": "", "experiencia_formacion": "", "habilidades_blandas": ""
}`;

// ── HELPERS ───────────────────────────────────────────────────────────────
function parseJSON(raw) {
  var c = raw.replace(/```json|```/g, '').trim();
  try { return JSON.parse(c); } catch(e) {
    var m = c.match(/\{[\s\S]*\}/);
    if (m) return JSON.parse(m[0]);
    throw new Error('No se pudo parsear la respuesta del agente.');
  }
}

function esc(s) {
  if (!s) return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

async function callAnthropic(module, messages, systemPrompt, maxTokens, retries) {
  maxTokens = maxTokens || 4000;
  retries   = retries   || 2;
  logLine('INFO ', module, 'Llamando Anthropic API — model: claude-sonnet-4-6');
  var lastErr = null;
  for (var attempt = 1; attempt <= retries; attempt++) {
    try {
      if (attempt > 1) {
        logLine('WARN ', module, 'Reintento ' + attempt + ' de ' + retries);
        await new Promise(function(r){ setTimeout(r, 1500 * attempt); });
      }
      var response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-6',
          max_tokens: maxTokens,
          system: systemPrompt,
          messages: messages
        })
      });
      logLine('INFO ', module, 'Respuesta recibida — status: ' + response.status);
      if (!response.ok && response.status !== 400) {
        lastErr = 'HTTP ' + response.status + ' — ' + response.statusText;
        logLine('ERROR', module, 'API HTTP error: ' + lastErr);
        if (response.status === 529 || response.status === 503 || response.status === 502) continue;
        throw new Error(lastErr);
      }
      var data = await response.json();
      if (data.error) {
        lastErr = data.error.message || JSON.stringify(data.error);
        logLine('ERROR', module, 'API error: ' + lastErr);
        if (data.error.type === 'overloaded_error') continue;
        throw new Error(lastErr);
      }
      if (data.usage) {
        logTokens(module, 'API call',
          data.usage.input_tokens  || 0,
          data.usage.output_tokens || 0
        );
      }
      return data;
    } catch(e) {
      lastErr = e.message;
      logLine('ERROR', module, 'Intento ' + attempt + ' fallido: ' + e.message);
      if (attempt === retries) throw new Error(lastErr);
    }
  }
  throw new Error(lastErr || 'Error desconocido en API');
}

function toBase64(buf) { return buf.toString('base64'); }

function getMime(fn) {
  var m = {
    '.pdf':  'application/pdf',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    '.txt':  'text/plain'
  };
  return m[path.extname(fn).toLowerCase()] || 'application/octet-stream';
}

// ── JD DOCX BUILDER ───────────────────────────────────────────────────────
function buildDocx(jd, cfg) {
  var b=cfg.blancos||[], d=jd.descripcion||{}, r=jd.responsabilidades||{}, ko=jd.conocimientos_obligatorios||{};
  function tRow(lbl,val){return '<w:tr><w:tc><w:tcPr><w:tcW w:w="3420" w:type="dxa"/></w:tcPr><w:p><w:pPr><w:spacing w:after="0"/></w:pPr><w:r><w:rPr><w:b/><w:sz w:val="24"/></w:rPr><w:t>'+lbl+'</w:t></w:r></w:p></w:tc><w:tc><w:tcPr><w:tcW w:w="5581" w:type="dxa"/></w:tcPr><w:p><w:pPr><w:spacing w:after="0"/></w:pPr><w:r><w:rPr><w:sz w:val="24"/></w:rPr><w:t>'+esc(val||'')+'</w:t></w:r></w:p></w:tc></w:tr>';}
  function sec(t,c){return '<w:p><w:pPr><w:spacing w:before="200" w:after="80"/></w:pPr><w:r><w:rPr><w:b/><w:color w:val="'+(c||'000000')+'"/><w:sz w:val="28"/><w:u w:val="single"/></w:rPr><w:t>'+t+'</w:t></w:r></w:p>';}
  function resp(t,v){return '<w:p><w:pPr><w:ind w:left="400"/><w:spacing w:after="60"/></w:pPr><w:r><w:rPr><w:b/><w:color w:val="0A1F44"/><w:sz w:val="24"/></w:rPr><w:t>'+t+'</w:t></w:r></w:p><w:p><w:pPr><w:ind w:left="400"/><w:spacing w:after="160"/></w:pPr><w:r><w:rPr><w:sz w:val="22"/></w:rPr><w:t xml:space="preserve">'+esc(v||'')+'</w:t></w:r></w:p>';}
  function thdr(){return '<w:tr><w:tc><w:tcPr><w:tcW w:w="3500" w:type="dxa"/><w:shd w:val="clear" w:fill="0A1F44"/><w:tcMar><w:top w:w="80" w:type="dxa"/><w:left w:w="160" w:type="dxa"/><w:bottom w:w="80" w:type="dxa"/><w:right w:w="120" w:type="dxa"/></w:tcMar></w:tcPr><w:p><w:r><w:rPr><w:b/><w:color w:val="FFFFFF"/><w:sz w:val="20"/></w:rPr><w:t>Area</w:t></w:r></w:p></w:tc><w:tc><w:tcPr><w:tcW w:w="5860" w:type="dxa"/><w:shd w:val="clear" w:fill="0A1F44"/><w:tcMar><w:top w:w="80" w:type="dxa"/><w:left w:w="160" w:type="dxa"/><w:bottom w:w="80" w:type="dxa"/><w:right w:w="120" w:type="dxa"/></w:tcMar></w:tcPr><w:p><w:r><w:rPr><w:b/><w:color w:val="FFFFFF"/><w:sz w:val="20"/></w:rPr><w:t>Tecnologia / Habilidad</w:t></w:r></w:p></w:tc></w:tr>';}
  function tRow2(a,v,alt){var f=alt?'E3F5EE':'FFFFFF';return '<w:tr><w:tc><w:tcPr><w:tcW w:w="3500" w:type="dxa"/><w:shd w:val="clear" w:fill="'+f+'"/><w:tcMar><w:top w:w="70" w:type="dxa"/><w:left w:w="160" w:type="dxa"/><w:bottom w:w="70" w:type="dxa"/><w:right w:w="120" w:type="dxa"/></w:tcMar></w:tcPr><w:p><w:r><w:rPr><w:b/><w:color w:val="0A1F44"/><w:sz w:val="20"/></w:rPr><w:t>'+a+'</w:t></w:r></w:p></w:tc><w:tc><w:tcPr><w:tcW w:w="5860" w:type="dxa"/><w:shd w:val="clear" w:fill="'+f+'"/><w:tcMar><w:top w:w="70" w:type="dxa"/><w:left w:w="160" w:type="dxa"/><w:bottom w:w="70" w:type="dxa"/><w:right w:w="120" w:type="dxa"/></w:tcMar></w:tcPr><w:p><w:r><w:rPr><w:sz w:val="20"/></w:rPr><w:t xml:space="preserve">'+esc(v||'')+'</w:t></w:r></w:p></w:tc></w:tr>';}
  var respRows=Object.keys(r).map(function(k){return resp(k.replace(/_/g,' '),r[k]);}).join('');
  var koRows=Object.keys(ko).map(function(k,i){return tRow2(k.replace(/_/g,' '),ko[k],i%2===0);}).join('');
  var fechaRow=b.includes('fecha_inicio')?'':tRow('Fecha inicio CFO:','');
  var vacRow=b.includes('vacantes')?'':tRow('Vacantes:',d.vacantes||cfg.vacantes||'A definir');
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">\n<w:body>\n<w:p><w:pPr><w:jc w:val="center"/><w:spacing w:after="240"/></w:pPr><w:r><w:rPr><w:b/><w:color w:val="0A1F44"/><w:sz w:val="36"/></w:rPr><w:t>Descripcion de la posicion</w:t></w:r></w:p>\n<w:tbl><w:tblPr><w:tblW w:w="9001" w:type="dxa"/></w:tblPr><w:tblGrid><w:gridCol w:w="3420"/><w:gridCol w:w="5581"/></w:tblGrid>'+tRow('Cliente:',d.cliente||cfg.cliente)+tRow('Posicion:',d.posicion||(cfg.rol+' - '+cfg.cliente))+tRow('Seniority:',d.seniority||cfg.seniority||'Senior')+tRow('Estado:',d.estado||'Nueva')+fechaRow+vacRow+'</w:tbl>\n<w:p><w:pPr><w:spacing w:after="0"/></w:pPr></w:p>\n'+sec('Detalle del Proyecto','0A1F44')+'<w:p><w:pPr><w:spacing w:after="200"/></w:pPr><w:r><w:rPr><w:sz w:val="22"/></w:rPr><w:t xml:space="preserve">'+esc(jd.detalle_proyecto)+'</w:t></w:r></w:p>\n'+sec('Responsabilidades Principales','0A1F44')+respRows+sec('Conocimientos Tecnicos Obligatorios','0A1F44')+'<w:tbl><w:tblPr><w:tblW w:w="9360" w:type="dxa"/><w:tblBorders><w:top w:val="single" w:sz="4" w:color="0A1F44"/><w:left w:val="single" w:sz="4" w:color="0A1F44"/><w:bottom w:val="single" w:sz="4" w:color="0A1F44"/><w:right w:val="single" w:sz="4" w:color="0A1F44"/><w:insideH w:val="single" w:sz="2" w:color="CCCCCC"/><w:insideV w:val="single" w:sz="2" w:color="CCCCCC"/></w:tblBorders></w:tblPr><w:tblGrid><w:gridCol w:w="3500"/><w:gridCol w:w="5860"/></w:tblGrid>'+thdr()+koRows+'</w:tbl>\n<w:p><w:pPr><w:spacing w:after="0"/></w:pPr></w:p>\n'+sec('Conocimientos Valorados','0A1F44')+'<w:p><w:pPr><w:spacing w:after="200"/></w:pPr><w:r><w:rPr><w:sz w:val="22"/></w:rPr><w:t xml:space="preserve">'+esc(jd.conocimientos_valorados)+'</w:t></w:r></w:p>\n'+sec('Experiencia y Formacion','0A1F44')+'<w:p><w:pPr><w:spacing w:after="200"/></w:pPr><w:r><w:rPr><w:sz w:val="22"/></w:rPr><w:t xml:space="preserve">'+esc(jd.experiencia_formacion)+'</w:t></w:r></w:p>\n'+sec('Habilidades Blandas','0A1F44')+'<w:p><w:pPr><w:spacing w:after="300"/></w:pPr><w:r><w:rPr><w:sz w:val="22"/></w:rPr><w:t xml:space="preserve">'+esc(jd.habilidades_blandas)+'</w:t></w:r></w:p>\n'+sec('Condiciones de contratacion','00875A')+'<w:p><w:pPr><w:spacing w:after="80"/></w:pPr><w:r><w:rPr><w:b/><w:u w:val="single"/><w:sz w:val="24"/></w:rPr><w:t>Tipo de contratacion:</w:t></w:r><w:r><w:rPr><w:sz w:val="24"/></w:rPr><w:t xml:space="preserve"> Free Lance ( Horario de 9 a 18 ) Lun a Vier</w:t></w:r></w:p>\n<w:p><w:pPr><w:spacing w:after="80"/></w:pPr><w:r><w:rPr><w:b/><w:u w:val="single"/><w:sz w:val="24"/></w:rPr><w:t>Banda salarial:</w:t></w:r><w:r><w:rPr><w:sz w:val="24"/></w:rPr><w:t xml:space="preserve"> </w:t></w:r></w:p>\n<w:p><w:pPr><w:spacing w:after="80"/></w:pPr><w:r><w:rPr><w:b/><w:u w:val="single"/><w:sz w:val="24"/></w:rPr><w:t>Beneficios:</w:t></w:r><w:r><w:rPr><w:sz w:val="24"/></w:rPr><w:t xml:space="preserve"> No Aplican</w:t></w:r></w:p>\n<w:p><w:pPr><w:spacing w:after="80"/></w:pPr><w:r><w:rPr><w:b/><w:u w:val="single"/><w:sz w:val="24"/></w:rPr><w:t>Modalidad:</w:t></w:r><w:r><w:rPr><w:sz w:val="24"/></w:rPr><w:t xml:space="preserve"> Principalmente Remoto, con posibilidad de visitar las oficinas de CFO y/o Cliente.</w:t></w:r></w:p>\n<w:p><w:pPr><w:spacing w:after="80"/></w:pPr><w:r><w:rPr><w:b/><w:sz w:val="24"/></w:rPr><w:t>Direccion: Chiclana 3345, CABA</w:t></w:r></w:p>\n<w:p><w:pPr><w:spacing w:after="80"/></w:pPr><w:r><w:rPr><w:b/><w:sz w:val="24"/></w:rPr><w:t xml:space="preserve">Horarios: </w:t></w:r><w:r><w:rPr><w:sz w:val="24"/></w:rPr><w:t>de 9 a 18</w:t></w:r></w:p>\n<w:p><w:pPr><w:spacing w:after="80"/></w:pPr><w:r><w:rPr><w:b/><w:u w:val="single"/><w:sz w:val="24"/></w:rPr><w:t>Proceso de seleccion</w:t></w:r><w:r><w:rPr><w:sz w:val="22"/></w:rPr><w:t xml:space="preserve"> (Instancias/Modalidad/Challenge): Entrevista Tecnica</w:t></w:r></w:p>\n<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/></w:sectPr>\n</w:body></w:document>';
}

function buildDocxBuffer(wordXml) {
  var ct='<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">\n<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>\n<Default Extension="xml" ContentType="application/xml"/>\n<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>\n</Types>';
  var rr='<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">\n<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>\n</Relationships>';
  var wr='<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>';
  return createZip({'[Content_Types].xml':Buffer.from(ct,'utf8'),'_rels/.rels':Buffer.from(rr,'utf8'),'word/_rels/document.xml.rels':Buffer.from(wr,'utf8'),'word/document.xml':Buffer.from(wordXml,'utf8')});
}

function createZip(files) {
  var parts=[],cd=[],offset=0;
  for(var n in files){
    var d=files[n],nb=Buffer.from(n,'utf8'),crc=crc32(d);
    var lh=Buffer.alloc(30+nb.length);
    lh.writeUInt32LE(0x04034b50,0);lh.writeUInt16LE(20,4);lh.writeUInt16LE(0,6);
    lh.writeUInt16LE(0,8);lh.writeUInt16LE(0,10);lh.writeUInt16LE(0,12);
    lh.writeUInt32LE(crc,14);lh.writeUInt32LE(d.length,18);lh.writeUInt32LE(d.length,22);
    lh.writeUInt16LE(nb.length,26);lh.writeUInt16LE(0,28);nb.copy(lh,30);
    var ce=Buffer.alloc(46+nb.length);
    ce.writeUInt32LE(0x02014b50,0);ce.writeUInt16LE(20,4);ce.writeUInt16LE(20,6);
    ce.writeUInt16LE(0,8);ce.writeUInt16LE(0,10);ce.writeUInt16LE(0,12);ce.writeUInt16LE(0,14);
    ce.writeUInt32LE(crc,16);ce.writeUInt32LE(d.length,20);ce.writeUInt32LE(d.length,24);
    ce.writeUInt16LE(nb.length,28);ce.writeUInt16LE(0,30);ce.writeUInt16LE(0,32);
    ce.writeUInt16LE(0,34);ce.writeUInt16LE(0,36);ce.writeUInt32LE(0,38);ce.writeUInt32LE(offset,42);
    nb.copy(ce,46);
    parts.push(lh,d);cd.push(ce);offset+=lh.length+d.length;
  }
  var cdb=Buffer.concat(cd),eo=Buffer.alloc(22);
  eo.writeUInt32LE(0x06054b50,0);eo.writeUInt16LE(0,4);eo.writeUInt16LE(0,6);
  eo.writeUInt16LE(cd.length,8);eo.writeUInt16LE(cd.length,10);
  eo.writeUInt32LE(cdb.length,12);eo.writeUInt32LE(offset,16);eo.writeUInt16LE(0,20);
  return Buffer.concat(parts.concat(cd).concat([eo]));
}

function crc32(buf) {
  var c=0xFFFFFFFF,t=new Uint32Array(256);
  for(var i=0;i<256;i++){var x=i;for(var j=0;j<8;j++)x=(x&1)?(0xEDB88320^(x>>>1)):(x>>>1);t[i]=x;}
  for(var i=0;i<buf.length;i++)c=(c>>>8)^t[(c^buf[i])&0xFF];
  return(c^0xFFFFFFFF)>>>0;
}

// ══════════════════════════════════════════════════
// JOB MATCHER ENDPOINTS
// ══════════════════════════════════════════════════

app.post('/upload', uploadDisk.single('file'), async (req, res) => {
  // filePath fuera del try para garantizar cleanup en finally (S1-3)
  var filePath = req.file ? req.file.path : null;
  try {
    if (!req.file) throw new Error('No se recibió ningún archivo');
    var ext = path.extname(req.file.originalname).toLowerCase();
    var text = '';
    logLine('INFO ', 'Matcher   ', 'Upload: ' + req.file.originalname + ' (' + ext + ')');
    if (ext === '.pdf') {
      var dataBuffer = fs.readFileSync(filePath);
      var data = await pdfParse(dataBuffer);
      text = data.text;
    } else if (ext === '.docx' || ext === '.doc') {
      var result = await mammoth.extractRawText({ path: filePath });
      text = result.value;
    } else if (ext === '.pptx' || ext === '.ppt') {
      text = await officeParser.parseOfficeAsync(filePath);
    } else if (ext === '.txt') {
      text = fs.readFileSync(filePath, 'utf-8');
    } else {
      throw new Error('Formato no soportado');
    }
    var skipWords = ['EDUCACION','EXPERIENCIA','CURRICULUM','CV','FORMACION','HABILIDADES','CONTACTO','DATOS','PERSONALES','PERFIL','OBJETIVO','RESUMEN','PROFESIONAL','LABORAL','ACADEMICA','IDIOMAS','REFERENCIAS','CERTIFICACIONES','PROYECTOS','INFORMACION','CONOCIMIENTOS','COMPETENCIAS','TECNOLOGIAS'];
    var lines = text.split('\n').filter(function(l){return l.trim();});
    var candidateName = lines.find(function(l){
      var trimmed=l.trim(), words=trimmed.split(/\s+/);
      if(words.length<2||words.length>4) return false;
      if(!words.every(function(w){return w.length>0&&w[0]===w[0].toUpperCase();})) return false;
      if(skipWords.some(function(sw){return trimmed.toUpperCase().includes(sw);})) return false;
      if(trimmed.length<5||trimmed.length>50) return false;
      return true;
    }) || 'Candidato';
    logLine('INFO ', 'Matcher   ', 'Texto extraido: ~' + Math.round(text.length/4) + ' tokens estimados');
    res.json({ success: true, text: text, summary: text.substring(0, 500), candidateName: candidateName.trim() });
  } catch (error) {
    logLine('ERROR', 'Matcher   ', 'Upload error: ' + error.message);
    res.status(500).json({ success: false, error: error.message });
  } finally {
    // Garantiza limpieza del temp file aun si hubo error antes del unlink (S1-3)
    if (filePath) { try { fs.unlinkSync(filePath); } catch(_) {} }
  }
});

app.post('/analyze', async (req, res) => {
  try {
    var { candidateName, candidateText, jobText, projectText } = req.body;
    logLine('INFO ', 'Matcher   ', 'Analizando candidato: ' + candidateName);
    var prompt = 'Eres un Director de RRHH evaluando a ' + candidateName + '.\n\n';
    if (projectText) prompt += 'PROYECTO:\n' + projectText + '\n\n';
    prompt += 'JOB DESCRIPTION:\n' + jobText + '\n\nCV DEL CANDIDATO:\n' + candidateText + '\n\nResponde SOLO con JSON segun el schema del sistema.';
    var data = await callAnthropic('Matcher   ', [{ role:'user', content: prompt }], SYSTEM_MATCHER, 8000);
    if (data.content && data.content[0] && data.content[0].text) {
      logLine('INFO ', 'Matcher   ', 'Analisis completado: ' + candidateName);
      res.json({ success: true, analysis: data.content[0].text });
    } else if (data.error) {
      logLine('ERROR', 'Matcher   ', 'API error: ' + data.error.message);
      res.status(400).json({ success: false, error: data.error.message });
    } else {
      res.status(500).json({ success: false, error: 'Respuesta inesperada' });
    }
  } catch (error) {
    logLine('ERROR', 'Matcher   ', 'Analyze error: ' + error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/summarize', async (req, res) => {
  try {
    var { text, type } = req.body;
    logLine('INFO ', 'Matcher   ', 'Resumiendo: ' + type);
    var prompt = '';
    if (type === 'project') {
      prompt = 'Analiza el siguiente documento de proyecto y genera un resumen estructurado.\n\n'
        + 'IMPORTANTE: Usa el formato exacto con secciones en negrita usando **texto**:\n\n'
        + '**Resumen - [Nombre del Proyecto]**\n\n'
        + '**Contexto:**\n[Descripcion breve]\n\n'
        + '**Objetivo:**\n[Objetivo principal]\n\n'
        + '**Funcionalidades principales:**\n- [Funcionalidad 1]\n- [Funcionalidad 2]\n\n'
        + '**Integraciones:**\n- **[Sistema 1]:** [Descripcion]\n- **[Sistema 2]:** [Descripcion]\n\n'
        + '**Arquitectura tecnica:**\n- Stack: [Tecnologias]\n- [Otros detalles]\n\n'
        + '**Equipo:**\n[Roles del equipo]\n\n'
        + '**Cronograma:**\n[Duracion y fases]\n\n'
        + '**Soporte post-implementacion:**\n[Detalles de soporte]\n\n'
        + '**Metodologia:**\n[Metodologia utilizada]\n\n'
        + 'DOCUMENTO A RESUMIR:\n' + text + '\n\n'
        + 'Genera el resumen siguiendo EXACTAMENTE el formato indicado. Usa ** para negritas.';
    } else {
      prompt = 'Analiza la siguiente descripcion de puesto y genera un resumen estructurado.\n\n'
        + 'IMPORTANTE: Usa el formato exacto con secciones en negrita usando **texto**:\n\n'
        + '**Resumen - [Titulo del Puesto]**\n\n'
        + '**Descripcion:**\n[Descripcion general del rol]\n\n'
        + '**Requisitos tecnicos:**\n- [Requisito 1]\n- [Requisito 2]\n\n'
        + '**Experiencia requerida:**\n- [Anos y tipo de experiencia]\n\n'
        + '**Responsabilidades:**\n- [Responsabilidad 1]\n- [Responsabilidad 2]\n\n'
        + '**Habilidades blandas:**\n- [Habilidad 1]\n- [Habilidad 2]\n\n'
        + '**Modalidad:**\n[Presencial/Remoto/Hibrido y ubicacion]\n\n'
        + 'DOCUMENTO A RESUMIR:\n' + text + '\n\n'
        + 'Genera el resumen siguiendo EXACTAMENTE el formato indicado. Usa ** para negritas.';
    }
    var data = await callAnthropic('Matcher   ', [{ role:'user', content: prompt }], 'Eres un asistente experto en RRHH. Genera resumenes estructurados y concisos.', 2000);
    if (data.content && data.content[0] && data.content[0].text) {
      logLine('INFO ', 'Matcher   ', 'Resumen completado: ' + type);
      res.json({ success: true, summary: data.content[0].text });
    } else {
      res.status(500).json({ success: false, error: 'Respuesta inesperada' });
    }
  } catch (error) {
    logLine('ERROR', 'Matcher   ', 'Summarize error: ' + error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/ask-question', async (req, res) => {
  try {
    var { question, analysisResult, projectContext, jobDescription } = req.body;
    logLine('INFO ', 'Matcher   ', 'ChatJob pregunta: ' + question.substring(0, 60));
    var ctx = '';
    if (projectContext) ctx += 'PROYECTO:\n' + projectContext + '\n\n';
    if (jobDescription) ctx += 'JOB DESCRIPTION:\n' + jobDescription + '\n\n';
    if (analysisResult) ctx += 'ANALISIS:\n' + JSON.stringify(analysisResult, null, 2) + '\n\n';
    var prompt = ctx + 'PREGUNTA: ' + question + '\n\nResponde directo en maximo 100 palabras.';
    var data = await callAnthropic('Matcher   ', [{ role:'user', content: prompt }], 'Eres ChatJob, asistente experto en RRHH. Respuestas directas y concisas.', 400);
    if (data.content && data.content[0] && data.content[0].text) {
      res.json({ success: true, answer: data.content[0].text });
    } else {
      res.status(500).json({ success: false, error: 'Respuesta inesperada' });
    }
  } catch (error) {
    logLine('ERROR', 'Matcher   ', 'Ask-question error: ' + error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ══════════════════════════════════════════════════
// JD GENERATOR ENDPOINTS
// ══════════════════════════════════════════════════

app.post('/api/analyze', upload.fields([{ name: 'propuesta', maxCount: 1 }]), async (req, res) => {
  try {
    var pf = req.files && req.files.propuesta && req.files.propuesta[0];
    if (!pf) return res.status(400).json({ success: false, error: 'Falta propuesta' });
    logLine('INFO ', 'JDGen     ', 'Analizando propuesta: ' + pf.originalname + ' (' + pf.size + ' bytes)');
    var data = await callAnthropic('JDGen     ', [{ role:'user', content: [
      { type:'document', source:{ type:'base64', media_type: getMime(pf.originalname), data: toBase64(pf.buffer) } },
      { type:'text', text: 'MODO A - ANALISIS\nLee esta propuesta e identifica todos los perfiles del equipo. Responde SOLO con JSON del MODO A.' }
    ]}], SYSTEM_JDGEN);
    if (data.content && data.content[0] && data.content[0].text) {
      var analysis = parseJSON(data.content[0].text);
      logLine('INFO ', 'JDGen     ', 'Analisis OK — Perfiles detectados: ' + (analysis.perfiles_identificados && analysis.perfiles_identificados.length));
      res.json({ success: true, analysis: analysis });
    } else if (data.error) {
      logLine('ERROR', 'JDGen     ', 'API error: ' + (data.error.message||''));
      res.status(400).json({ success: false, error: data.error.message || 'Error de API' });
    } else {
      res.status(500).json({ success: false, error: 'Respuesta inesperada' });
    }
  } catch (error) {
    logLine('ERROR', 'JDGen     ', 'Analyze error: ' + error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/generate', upload.fields([{ name: 'propuesta', maxCount: 1 }]), async (req, res) => {
  try {
    var pf = req.files && req.files.propuesta && req.files.propuesta[0];
    if (!pf) return res.status(400).json({ success: false, error: 'Falta propuesta' });
    var cliente=req.body.cliente||'CFOTech', rol=req.body.rol||'A definir';
    var tipo=req.body.tipo_perfil||'TECNICO_EJECUCION', sen=req.body.seniority||'Senior';
    logLine('INFO ', 'JDGen     ', 'Generando JD: ' + rol + ' (' + tipo + ') — ' + cliente);
    var msg = 'MODO B - GENERACION DE JD\nPerfil:\n- Rol: '+rol+'\n- Tipo: '+tipo+'\n- Cliente: '+cliente+'\n- Seniority: '+sen+'\n';
    if (req.body.contexto)   msg += '- Contexto: ' + req.body.contexto + '\n';
    if (req.body.respuestas_refinamiento) msg += '- Respuestas refinamiento: ' + req.body.respuestas_refinamiento + '\n';
    if (req.body.template_id && _templates[req.body.template_id]) msg += '- Template base: ' + _templates[req.body.template_id].nombre + '\n';
    msg += '\nUsa la propuesta adjunta como unica fuente. Responde SOLO con JSON del MODO B.';
    var data = await callAnthropic('JDGen     ', [{ role:'user', content: [
      { type:'document', source:{ type:'base64', media_type: getMime(pf.originalname), data: toBase64(pf.buffer) } },
      { type:'text', text: msg }
    ]}], SYSTEM_JDGEN);
    if (data.content && data.content[0] && data.content[0].text) {
      var jd  = parseJSON(data.content[0].text);
      var cfg = { cliente: cliente, rol: rol, seniority: sen, vacantes: req.body.vacantes||'A definir', blancos: [] };
      var buf = buildDocxBuffer(buildDocx(jd, cfg));
      var fname = 'JD_'+rol.replace(/[^a-zA-Z0-9]/g,'_')+'_'+cliente.replace(/[^a-zA-Z0-9]/g,'_')+'.docx';
      logLine('INFO ', 'JDGen     ', 'JD generado: ' + fname + ' (' + buf.length + ' bytes)');
      res.set({
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': 'attachment; filename="' + fname + '"',
        'Content-Length': buf.length,
        'X-JD-Summary': JSON.stringify({ posicion:(jd.descripcion&&jd.descripcion.posicion)||'', seniority:(jd.descripcion&&jd.descripcion.seniority)||'', cliente:(jd.descripcion&&jd.descripcion.cliente)||cliente })
      });
      res.send(buf);
    } else if (data.error) {
      logLine('ERROR', 'JDGen     ', 'API error: ' + (data.error.message||''));
      res.status(400).json({ success: false, error: data.error.message || 'Error de API' });
    } else {
      res.status(500).json({ success: false, error: 'Respuesta inesperada' });
    }
  } catch (error) {
    logLine('ERROR', 'JDGen     ', 'Generate error: ' + error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/templates', upload.fields([{ name: 'template', maxCount: 1 }]), (req, res) => {
  var tf = req.files && req.files.template && req.files.template[0];
  if (!tf) return res.status(400).json({ success: false, error: 'Falta archivo' });
  try {
    fs.mkdirSync(_tplDir, { recursive: true });
    var id=String(_templateIdCounter++), fname='template_'+id+'.docx';
    var fpath=path.join(_tplDir, fname);
    fs.writeFileSync(fpath, tf.buffer);
    _templates[id]={ id:id, nombre:req.body.nombre||tf.originalname, perfil:req.body.perfil||'General', file:fname };
    tplSave(_templates);
    logLine('INFO ', 'Templates ', 'Guardado: ' + fpath + ' — perfil: ' + _templates[id].perfil);
    res.json({ success: true, template:{ id:id, nombre:_templates[id].nombre, perfil:_templates[id].perfil } });
  } catch(e) {
    logLine('ERROR', 'Templates ', 'Error guardando: ' + e.message);
    res.status(500).json({ success: false, error: e.message });
  }
});

app.get('/api/templates', (_, res) => {
  var list=Object.values(_templates).filter(function(t){
    return t.file && fs.existsSync(path.join(_tplDir, t.file));
  }).map(function(t){ return { id:t.id, nombre:t.nombre, perfil:t.perfil }; });
  res.json({ templates: list });
});

app.delete('/api/templates/:id', (req, res) => {
  var t=_templates[req.params.id];
  if (!t) return res.status(404).json({ success: false, error: 'Template no encontrado' });
  try {
    if (t.file) { var fp=path.join(_tplDir,t.file); if(fs.existsSync(fp)) fs.unlinkSync(fp); }
    delete _templates[req.params.id];
    tplSave(_templates);
    logLine('INFO ', 'Templates ', 'Eliminado: id=' + req.params.id);
    res.json({ success: true });
  } catch(e) {
    logLine('ERROR', 'Templates ', 'Error eliminando: ' + e.message);
    res.status(500).json({ success: false, error: e.message });
  }
});

// ── HEALTH & SHUTDOWN ─────────────────────────────────────────────────────
app.get('/api/health', (_, res) => {
  res.json({ status: 'ok', version: '1.0.0', tool: 'CFOTech IT Tools' });
});

app.post('/api/shutdown', (req, res) => {
  logLine('INFO ', 'Sistema   ', 'Shutdown solicitado por el usuario');
  res.json({ ok: true });
  setTimeout(function() {
    logLine('INFO ', 'Sistema   ', 'Proceso terminado. Hasta luego.');
    process.exit(0);
  }, 300);
});

// ── START ─────────────────────────────────────────────────────────────────
var server = app.listen(PORT, function() {
  logLine('INFO ', 'Sistema   ', 'CFOTech IT Tools iniciado en http://localhost:' + PORT);
  logLine('INFO ', 'Sistema   ', 'Log dir: ' + LOG_DIR);
});




