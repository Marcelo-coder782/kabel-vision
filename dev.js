/* Kabel Vision · dev.js — câmera, OCR, voz, relé BLE, face, QR (APIs do navegador) */
const $=s=>document.querySelector(s);
const esc=s=>String(s).replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]));
const f2=(v,n=2)=>v.toFixed(n).replace(".",",");
const sleep=ms=>new Promise(z=>setTimeout(z,ms));
let vs=null,facing="environment",lm=false;
/* ---------- imagens ---------- */
function cvNew(w,h){const c=document.createElement("canvas");c.width=Math.max(1,w|0);c.height=Math.max(1,h|0);return c}
function load(f,max=1920){return new Promise(r=>{const i=new Image();i.onload=()=>{const k=Math.min(1,max/Math.max(i.width,i.height)),c=cvNew(i.width*k,i.height*k);c.getContext("2d").drawImage(i,0,0,c.width,c.height);r(c)};i.src=URL.createObjectURL(f)})}
function fromURL(u){return new Promise(r=>{const i=new Image();i.onload=()=>{const c=cvNew(i.width,i.height);c.getContext("2d").drawImage(i,0,0);r(c)};i.src=u})}
function thumb(c){const t=cvNew(64,48);t.getContext("2d").drawImage(c,0,0,64,48);return t.toDataURL("image/jpeg",.45)}
/* ---------- câmera (sempre traseira por padrão) ---------- */
async function camOn(id,w=1920,h=1440){camOff();const V_=$("#vd"),sz={width:{ideal:w},height:{ideal:h}},v=f=>({video:{facingMode:f,...sz},audio:false});
try{try{vs=await navigator.mediaDevices.getUserMedia(id?{video:{deviceId:{exact:id},...sz},audio:false}:v({exact:facing}))}catch(e){vs=await navigator.mediaDevices.getUserMedia(id?{video:{deviceId:{exact:id}},audio:false}:v({ideal:facing}))}V_.srcObject=vs;await V_.play();return true}
catch(e){$("#oi").textContent="Câmera indisponível: permita o acesso à câmera no navegador ou use a Galeria.";return false}}
function camOff(){if(vs){vs.getTracks().forEach(t=>t.stop());vs=null}}
function snap(max=1920){const v=$("#vd");if(!v.videoWidth)return null;const k=Math.min(1,max/Math.max(v.videoWidth,v.videoHeight)),c=cvNew(v.videoWidth*k,v.videoHeight*k);c.getContext("2d").drawImage(v,0,0,c.width,c.height);return c}
async function bestF(){let b=null,m=-1;for(let i=0;i<5;i++){const c=snap();if(c){const q=sharpOf(c);if(q>m){m=q;b=c}}await sleep(90)}return b}
function sharpOf(c){const k=200/Math.max(c.width,c.height),t=cvNew(c.width*k,c.height*k),x=t.getContext("2d");x.drawImage(c,0,0,t.width,t.height);const d=x.getImageData(0,0,t.width,t.height).data,W=t.width,H=t.height,g=new Float32Array(W*H);for(let i=0;i<W*H;i++)g[i]=.3*d[i*4]+.59*d[i*4+1]+.11*d[i*4+2];let s=0,q=0,n=0;for(let y=1;y<H-1;y++)for(let X=1;X<W-1;X++){const i=y*W+X,v=4*g[i]-g[i-1]-g[i+1]-g[i-W]-g[i+W];s+=v;q+=v*v;n++}return n?q/n-(s/n)*(s/n):0}
function ovOpen(msg,btn,title){$("#ov").hidden=false;$("#oi").textContent=msg||"";$("#bc").textContent=btn||"Capturar";$("#gf").onchange=null;$("#rfw").hidden=true;$("#ttl").textContent=title||"";$("#bv").textContent=S.cfg.f.voz?"🔊":"🔇";$("#bs").onclick=()=>{facing=facing=="environment"?"user":"environment";camOn()}}
function toggleVoz(){S.cfg.f.voz=S.cfg.f.voz?0:1;if(!S.cfg.f.voz)try{speechSynthesis.cancel()}catch(e){}const b=$("#bv");if(b)b.textContent=S.cfg.f.voz?"🔊":"🔇";sv();if(V_=="insp"&&$("#ov").hidden)R()}
function ovClose(){lm=false;camOff();$("#ov").hidden=true;$("#lv").getContext("2d").clearRect(0,0,9999,9999)}
function grab(){return new Promise(res=>{ovOpen("Enquadre e toque em Capturar (o app escolhe o quadro mais nítido).");camOn();
$("#bc").onclick=async()=>{const c=await bestF();ovClose();res(c)};$("#bx").onclick=()=>{ovClose();res(null)};$("#gf").onchange=async e=>{const f=e.target.files[0];e.target.value="";if(!f)return;const c=await load(f);ovClose();res(c)}})}
/* ---------- voz ---------- */
function speak(t,force){if(!(S.cfg.f.voz||force)||!t)return;try{speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(t);u.lang="pt-BR";u.rate=1;const v=speechSynthesis.getVoices().find(x=>/pt[-_]BR/i.test(x.lang));if(v)u.voice=v;speechSynthesis.speak(u)}catch(e){}}
function beep(f,n=1){try{au=window.au||(window.au=new(window.AudioContext||window.webkitAudioContext)());au.resume();for(let i=0;i<n;i++){const o=au.createOscillator(),g=au.createGain();o.frequency.value=f;g.gain.value=.15;o.connect(g);g.connect(au.destination);o.start(au.currentTime+i*.2);o.stop(au.currentTime+i*.2+.12)}}catch(e){}}
/* ---------- carregamento de scripts, face (face-api), QR ---------- */
function loadS(u){return new Promise((res,rej)=>{if(document.querySelector('script[src="'+u+'"]')){res();return}const s=document.createElement("script");s.src=u;s.onload=res;s.onerror=()=>rej(new Error("falha ao carregar "+u));document.head.appendChild(s)})}
const FA="https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.13/",JSQ="https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js";
async function faceInit(){await loadS(FA+"dist/face-api.js");if(!faceapi.nets.tinyFaceDetector.isLoaded){await faceapi.nets.tinyFaceDetector.loadFromUri(FA+"model");await faceapi.nets.faceLandmark68Net.loadFromUri(FA+"model");await faceapi.nets.faceRecognitionNet.loadFromUri(FA+"model")}}
async function faceDesc(){const r=await faceapi.detectSingleFace($("#vd"),new faceapi.TinyFaceDetectorOptions({inputSize:320})).withFaceLandmarks().withFaceDescriptor();return r?Array.from(r.descriptor):null}
const fdist=(a,b)=>Math.hypot(...a.map((x,i)=>x-b[i]));
async function faceRun(msg,fn){const old=facing;facing="user";ovOpen(msg,"Cancelar");let stop=false;$("#bc").onclick=$("#bx").onclick=()=>{stop=true};
try{$("#oi").textContent="Carregando reconhecimento facial (primeira vez, requer internet)…";await faceInit();$("#oi").textContent=msg;await camOn();let out=null;const t0=Date.now();
while(!stop&&Date.now()-t0<25000&&out===null){const d=await faceDesc();if(d)out=await fn(d);await sleep(350)}ovClose();facing=old;return out}catch(e){ovClose();facing=old;throw e}}
async function faceEnroll(){const L=[];return faceRun("Olhe para a câmera: cadastrando o rosto (3 capturas)…",async d=>{L.push(d);await sleep(500);return L.length>=3?L:null})}
async function faceVerify(op){return faceRun("Olhe para a câmera para confirmar a identidade…",async d=>{return op.face.some(f=>fdist(f,d)<.5)?true:null})}
async function scanQR(msg){return new Promise(async res=>{ovOpen(msg||"Aponte para o QR code do WMS","Cancelar");camOn();let on=true;const det="BarcodeDetector"in window?new BarcodeDetector({formats:["qr_code"]}):null;if(!det)try{await loadS(JSQ)}catch(e){}
const done=v=>{on=false;ovClose();res(v)};$("#bc").onclick=$("#bx").onclick=()=>done(null);
while(on){const v=$("#vd");if(v.videoWidth){try{if(det){const r=await det.detect(v);if(r.length)return done(r[0].rawValue)}else if(window.jsQR){const c=snap(640),d=imgOf(c),q=jsQR(d.data,d.w,d.h);if(q)return done(q.data)}}catch(e){}}await sleep(250)}})}
/* ---------- teste de câmera ---------- */
async function camTest(){ovOpen("Abrindo câmera…","Fechar");$("#bc").onclick=$("#bx").onclick=()=>ovClose();await camT()}
const ctM=t=>{const e=$("#tm2");if(e)e.textContent=t};
async function camT(id,w=4032,h=3024){camOff();const V_=$("#vd"),sz={width:{ideal:w},height:{ideal:h}};
try{vs=await navigator.mediaDevices.getUserMedia({video:id?{deviceId:{exact:id},...sz}:{facingMode:{ideal:"environment"},...sz},audio:false});V_.srcObject=vs;await V_.play()}catch(e){$("#oi").textContent="Câmera indisponível: "+(e.message||e);return}
const t=vs.getVideoTracks()[0],cp=t.getCapabilities?t.getCapabilities():{},st=t.getSettings(),dv=(await navigator.mediaDevices.enumerateDevices()).filter(d=>d.kind=="videoinput");
const yn=k=>cp[k]!==undefined?"✅":"❌",ex=cp.exposureTime!==undefined||cp.exposureCompensation!==undefined?"✅":"❌",
rg=(k,l,u)=>cp[k]&&cp[k].max!==undefined?`<div class="row"><span style="min-width:8em">${l}</span><input type="range" min="${cp[k].min}" max="${cp[k].max}" step="${cp[k].step||.01}" value="${st[k]!==undefined?st[k]:cp[k].min}" oninput="ctSet('${k}',+this.value)"><span class="mu" id="v_${k}">${f2(st[k]!==undefined?st[k]:cp[k].min,2)}${u||""}</span></div>`:`<div class="mu">${l}: ❌ não exposto</div>`,
md=(k,l)=>Array.isArray(cp[k])?`<div>${l}: ${cp[k].map(m=>`<button class="g" onclick="ctMode('${k}','${m}')">${m}</button>`).join("")}</div>`:`<div class="mu">${l}: ❌ não exposto</div>`;
$("#oi").innerHTML=`<div><b>${esc(t.label||"câmera")}</b> · ${st.width}×${st.height}${st.frameRate?" · "+Math.round(st.frameRate)+" fps":""}</div>
<div class="mu">Zoom ${yn("zoom")} · Foco manual ${yn("focusDistance")} · Exposição ${ex} · Balanço de branco ${yn("colorTemperature")} · Pan/Tilt ${yn("pan")}${cp.torch?" · Lanterna ✅":""}</div>
${rg("zoom","Zoom","×")}${rg("focusDistance","Foco (m)")}${rg("exposureCompensation","Exposição EV")}${rg("colorTemperature","Temp. cor (K)")}
${md("focusMode","Modo de foco")}${md("exposureMode","Modo de exposição")}${md("whiteBalanceMode","Modo de branco")}
<div style="margin-top:6px">Resolução: <button class="g" onclick="camT('${st.deviceId||""}',4032,3024)">4032×3024</button><button class="g" onclick="camT('${st.deviceId||""}',1920,1080)">1920×1080</button></div>
<div style="margin-top:6px">Câmeras (lentes): ${dv.map((d,i)=>`<button class="g" onclick="camT('${d.deviceId}')">${esc(d.label||"câmera "+(i+1))}</button>`).join("")}</div><div id="tm2" class="mu" style="margin-top:6px"></div>`}
async function ctSet(k,v){const t=vs&&vs.getVideoTracks()[0];if(!t)return;try{await t.applyConstraints({advanced:[k=="focusDistance"?{focusMode:"manual",focusDistance:v}:{[k]:v}]});const e=$("#v_"+k);if(e)e.textContent=f2(v,2)}catch(e){ctM(k+": valor não aceito por esta câmera")}}
async function ctMode(k,m){const t=vs&&vs.getVideoTracks()[0];if(!t)return;try{await t.applyConstraints({advanced:[{[k]:m}]});ctM(k+" = "+m)}catch(e){ctM(k+": modo não aceito")}}
