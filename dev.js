/* Kabel Vision · dev.js — câmera, OCR, voz, relé BLE, face, QR (APIs do navegador) */
const $=s=>document.querySelector(s);
const esc=s=>String(s).replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]));
const f2=(v,n=2)=>v.toFixed(n).replace(".",",");
const sleep=ms=>new Promise(z=>setTimeout(z,ms));
let vs=null,facing="environment",lm=false,ow=null;
/* ---------- imagens ---------- */
function cvNew(w,h){const c=document.createElement("canvas");c.width=Math.max(1,w|0);c.height=Math.max(1,h|0);return c}
function load(f,max=1280){return new Promise(r=>{const i=new Image();i.onload=()=>{const k=Math.min(1,max/Math.max(i.width,i.height)),c=cvNew(i.width*k,i.height*k);c.getContext("2d").drawImage(i,0,0,c.width,c.height);r(c)};i.src=URL.createObjectURL(f)})}
function fromURL(u){return new Promise(r=>{const i=new Image();i.onload=()=>{const c=cvNew(i.width,i.height);c.getContext("2d").drawImage(i,0,0);r(c)};i.src=u})}
function imgOf(c){const d=c.getContext("2d",{willReadFrequently:true}).getImageData(0,0,c.width,c.height);return{w:c.width,h:c.height,data:d.data}}
function cvOf(I){const c=cvNew(I.w,I.h);c.getContext("2d").putImageData(new ImageData(I.data,I.w,I.h),0,0);return c}
function urlOf(I,m=120,q=.7){const c=cvOf(I),k=Math.min(1,m/Math.max(I.w,I.h)),t=cvNew(I.w*k,I.h*k);t.getContext("2d").drawImage(c,0,0,t.width,t.height);return t.toDataURL("image/jpeg",q)}
function thumb(c){const t=cvNew(64,48);t.getContext("2d").drawImage(c,0,0,64,48);return t.toDataURL("image/jpeg",.45)}
/* ---------- câmera (sempre traseira por padrão) ---------- */
async function camOn(id,w=1920,h=1440){camOff();const V_=$("#vd"),sz={width:{ideal:w},height:{ideal:h}},v=f=>({video:{facingMode:f,...sz},audio:false});
try{try{vs=await navigator.mediaDevices.getUserMedia(id?{video:{deviceId:{exact:id},...sz},audio:false}:v({exact:facing}))}catch(e){vs=await navigator.mediaDevices.getUserMedia(id?{video:{deviceId:{exact:id}},audio:false}:v({ideal:facing}))}V_.srcObject=vs;await V_.play();return true}
catch(e){$("#oi").textContent="Câmera indisponível: permita o acesso à câmera no navegador ou use a Galeria.";return false}}
function camOff(){if(vs){vs.getTracks().forEach(t=>t.stop());vs=null}}
function snap(max=1280){const v=$("#vd");if(!v.videoWidth)return null;const k=Math.min(1,max/Math.max(v.videoWidth,v.videoHeight)),c=cvNew(v.videoWidth*k,v.videoHeight*k);c.getContext("2d").drawImage(v,0,0,c.width,c.height);return c}
async function bestF(){let b=null,m=-1;for(let i=0;i<5;i++){const c=snap();if(c){const q=V.sharp(V.downMax(V.gray(imgOf(c)),200));if(q>m){m=q;b=c}}await sleep(90)}return b}
function ovOpen(msg,btn){$("#ov").hidden=false;$("#oi").textContent=msg||"";$("#bc").textContent=btn||"Capturar";$("#gf").onchange=null;$("#rfw").hidden=true;$("#bs").onclick=()=>{facing=facing=="environment"?"user":"environment";camOn()}}
function ovClose(){lm=false;camOff();$("#ov").hidden=true;$("#lv").getContext("2d").clearRect(0,0,9999,9999)}
function grab(){return new Promise(res=>{ovOpen("Enquadre e toque em Capturar (o app escolhe o quadro mais nítido).");camOn();
$("#bc").onclick=async()=>{const c=await bestF();ovClose();res(c)};$("#bx").onclick=()=>{ovClose();res(null)};$("#gf").onchange=async e=>{const f=e.target.files[0];e.target.value="";if(!f)return;const c=await load(f);ovClose();res(c)}})}
/* ---------- OCR (Tesseract.js) com rotação da ROI ---------- */
async function ocrW(){if(ow)return ow;if(!window.Tesseract)throw new Error("sem motor OCR");const m=$("#oi");if(m&&!$("#ov").hidden)m.textContent="Carregando motor OCR (primeira vez, requer internet)…";
ow=await Tesseract.createWorker("eng");await ow.setParameters({tessedit_pageseg_mode:"6",tessedit_char_whitelist:"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-./ "});return ow}
function rotC(c,deg){const r=deg*Math.PI/180,w=c.width,h=c.height,W=Math.abs(w*Math.cos(r))+Math.abs(h*Math.sin(r))+24,H=Math.abs(w*Math.sin(r))+Math.abs(h*Math.cos(r))+24,t=cvNew(Math.ceil(W),Math.ceil(H)),x=t.getContext("2d");
x.fillStyle="#fff";x.fillRect(0,0,t.width,t.height);x.translate(t.width/2,t.height/2);x.rotate(r);x.filter="grayscale(1) contrast(1.4)";x.drawImage(c,-w/2,-h/2);return t}
async function recog(I,deg){const b=cvNew(I.w,I.h),x=b.getContext("2d");x.fillStyle="#fff";x.fillRect(0,0,b.width,b.height);x.drawImage(cvOf(I),0,0);const W=await ocrW(),r=await W.recognize(rotC(b,deg));return{text:r.data.text,conf:r.data.confidence}}
/* ---------- voz ---------- */
function speak(t,force){if(!(S.cfg.f.voz||force)||!t)return;try{speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(t);u.lang="pt-BR";u.rate=1;const v=speechSynthesis.getVoices().find(x=>/pt[-_]BR/i.test(x.lang));if(v)u.voice=v;speechSynthesis.speak(u)}catch(e){}}
function beep(f,n=1){try{au=window.au||(window.au=new(window.AudioContext||window.webkitAudioContext)());au.resume();for(let i=0;i<n;i++){const o=au.createOscillator(),g=au.createGain();o.frequency.value=f;g.gain.value=.15;o.connect(g);g.connect(au.destination);o.start(au.currentTime+i*.2);o.stop(au.currentTime+i*.2+.12)}}catch(e){}}
/* ---------- relé Bluetooth (BLE) com ID único (nome KVR-xxxx) ---------- */
const NUS={s:"6e400001-b5a3-f393-e0a9-e50e24dcca9e",w:"6e400002-b5a3-f393-e0a9-e50e24dcca9e"};
const RL={dev:null,ch:null,id:"",ok:false,want:0,hb:null,err:""};
async function rlPair(){if(!navigator.bluetooth)throw new Error("Web Bluetooth indisponível: use o Chrome no Android ou no computador");return navigator.bluetooth.requestDevice({filters:[{namePrefix:"KVR-"}],optionalServices:[NUS.s]})}
async function rlConnect(d){const g=await d.gatt.connect(),s=await g.getPrimaryService(NUS.s);RL.ch=await s.getCharacteristic(NUS.w);RL.dev=d;RL.id=d.name;RL.ok=true;RL.err="";d.addEventListener("gattserverdisconnected",()=>{RL.ok=false})}
async function rlEnsure(id){if(RL.ok&&RL.id==id)return true;try{if(navigator.bluetooth&&navigator.bluetooth.getDevices){const l=await navigator.bluetooth.getDevices(),d=l.find(x=>x.name==id);if(d){await rlConnect(d);return true}}}catch(e){RL.err=String(e.message||e)}return false}
async function rlSend(v){if(!RL.ok||!RL.ch)return false;try{await RL.ch.writeValueWithoutResponse(new TextEncoder().encode(String(v)));return true}catch(e){RL.ok=false;RL.err=String(e.message||e);return false}}
function rlWant(v){RL.want=v;clearInterval(RL.hb);rlSend(v);if(v==1)RL.hb=setInterval(()=>rlSend(1),1000)}
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
