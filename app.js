/* Kabel Vision v3 · app.js */
const DEF={v:3,recipes:[],log:[],ops:[],cfg:{f:{login:0,face:0,qr:0,sinal:0,voz:1,takt:1,val:1},pin:"",relays:[],hold:10,takt:60,alq:.30}};
let S=loadS_(),V_="insp",E=null,sel="",last=null,refC=null,refI=null,bt=null,ADM=false,SES={op:null,qr:null},RC={};
function loadS_(){let o=null;try{o=JSON.parse(localStorage.getItem("kv")||"null")}catch(e){}if(!o)return JSON.parse(JSON.stringify(DEF));
o.ops=o.ops||[];o.cfg=Object.assign({},DEF.cfg,o.cfg||{});o.cfg.f=Object.assign({},DEF.cfg.f,(o.cfg||{}).f||{});o.cfg.relays=o.cfg.relays||[];
o.log=(o.log||[]).map(l=>Object.assign({},l,{f:l.f=="inc"?"na":l.f}));(o.recipes=o.recipes||[]).forEach(r=>{r.takt=r.takt||0;r.sinal=r.sinal||0;r.relay=r.relay||"";r.lock=r.lock||0;r.ver=r.ver||1;r.rois.forEach(q=>{q.tp=q.tp||"vis";q.tx=q.tx||"";q.rot=q.rot||0;q.ot=q.ot||[];q.nt=q.nt||[]})});return o}
const say=t=>{$("#msg").textContent=t};
function sv(){try{localStorage.setItem("kv",JSON.stringify(S));return 1}catch(e){S.log.forEach(l=>l.th="");try{localStorage.setItem("kv",JSON.stringify(S))}catch(e2){say("Memória do navegador cheia: apague registros ou modelos.")}}}
const cur=()=>S.recipes.find(x=>x.id==E),curR=()=>S.recipes.find(x=>x.id==sel);
const go=v=>{V_=v;E=null;say("");R()};
const SC={ok:"#1f9d55",no:"#d93025",na:"#8a8f98"},pc=x=>x===null||x===undefined?"—":(x*100).toFixed(1).replace(".",",")+"%",pd=n=>String(n+1).padStart(2,"0");
const CAUSA={cor:"Desvio cromático",abs:"Ausência / perda de detalhe",nok:"Similar a NC treinada",dm:"Divergência morfológica",ink:"Faixa de incerteza",ocr_div:"Texto divergente",ocr_inc:"OCR inconclusivo",ocr_ileg:"Texto ilegível",ocr_na:"OCR indisponível",nl:"Peça não localizada",bl:"Imagem desfocada",fc:"ROI fora do campo"};
/* ---------- mensagens técnicas, ação e voz ---------- */
function mk(R,ctx){const m=R.m||{},n=R.n,p=x=>Math.round(100*x)+"%";let t="Conforme à referência",a="",v="";
switch(R.cause){
case"nl":t=`Referência não localizada na imagem: confiança do alinhamento (NCC) = ${f2(ctx.T.q)}, abaixo do mínimo ${f2(S.cfg.alq)}`;a="Enquadrar a peça e a jiga como na referência, com boa iluminação";v="Peça não localizada. Enquadre a peça como na referência.";break;
case"bl":t=`Imagem desfocada: nitidez relativa = ${f2(ctx.bl)} (mínimo 0,40 da referência). Avaliação suspensa`;a="Estabilizar o aparelho, focar e evitar movimento";v="Imagem desfocada. Estabilize o aparelho e foque.";break;
case"fc":t=`ROI fora do campo de visão (cobertura ${p(m.cov||0)})`;a="Reenquadrar para incluir toda a região";v=`${n}: região fora do campo. Reenquadre.`;break;
case"cor":t=`Desvio cromático: ΔE*ab = ${f2(m.dab,1)} (limite 12,0) · referência ${m.cn[0]} · encontrado ${m.cn[1]} · índice de cor ${p(R.chk.cor)}`;a="Substituir pelo componente com a cor especificada";v=`${n}: cor diferente. Esperado ${m.cn[0]}, encontrado ${m.cn[1]}. Substituir pelo componente da cor especificada.`;break;
case"abs":t=`Perda de detalhe estrutural: σL = ${f2(m.sdB,1)} contra ${f2(m.sdA,1)} na referência · índice visual ${p(R.chk.vis)}. Possível ausência do componente`;a="Montar o componente faltante";v=`${n}: componente possivelmente ausente. Montar o componente faltante.`;break;
case"nok":t=`Similaridade com a classe NOK treinada: d_NOK = ${f2(m.no,3)} < d_OK = ${f2(m.ok,3)} · índice visual ${p(R.chk.vis)}`;a="Corrigir a montagem conforme a referência";v=`${n}: parecido com defeito já ensinado. Corrigir a montagem conforme a referência.`;break;
case"dm":t=`Divergência morfológica: d_OK = ${f2(m.ok,3)} acima do limiar τ = ${f2(ctx.r.th)} · índice visual ${p(R.chk.vis)}`;a="Conferir tipo, posição e sentido do componente";v=`${n}: aparência diferente da referência. Conferir tipo, posição e sentido.`;break;
case"ink":t=`Faixa de incerteza: índice visual ${p(R.chk.vis)} (conforme ≥ 70%, não conforme < 57%). Decisão não conclusiva`;a="Refazer a captura com boa iluminação; se persistir, acionar o supervisor";v=`${n}: avaliação incerta. Refaça a captura com boa iluminação.`;break;
case"ocr_div":t=`Divergência de texto (OCR): esperado “${R.o.tx}”, lido “${m.txt.lido}” · distância de Levenshtein = ${m.txt.d} · confiança ${m.txt.conf}% · orientação ${m.txt.a}°`;a="Conferir se a etiqueta ou identificação corresponde ao especificado";v=`${n}: texto diferente. Esperado ${R.o.tx}, lido ${m.txt.lido}.`;break;
case"ocr_inc":t=`Leitura OCR inconclusiva: esperado “${R.o.tx}”, lido “${m.txt.lido}” · distância = ${m.txt.d} · confiança ${m.txt.conf}%`;a="Aproximar, estabilizar e repetir a leitura; persistindo, conferir visualmente";v=`${n}: leitura do texto inconclusiva. Aproxime a câmera e repita.`;break;
case"ocr_ileg":t=`Texto ilegível: confiança OCR = ${m.txt.conf}% (mínimo 55%) · lido “${m.txt.lido||"—"}” · possível rotação, desfoque, reflexo ou pouca luz`;a="Melhorar iluminação e foco, evitar reflexo e enquadrar a etiqueta";v=`${n}: texto ilegível. Melhore a iluminação, evite reflexo e enquadre a etiqueta.`;break;
case"ocr_na":t="Motor OCR indisponível (requer internet na primeira carga)";a="Conectar à internet uma vez para carregar o motor OCR; conferir visualmente";v=`${n}: leitura de texto indisponível.`;break;
case"ocr_skip":t="Leitura do texto adiada: há NC visual na peça";a="Corrigir as NC visuais e reinspecionar";v="";break}
return{t,a,v}}
/* ---------- referência, análise ---------- */
async function prep(r){const k=r.id+":"+r.ver+":"+r.ref.length;if(RC[k])return RC[k];const rc=await fromURL(r.ref),I=imgOf(rc),g=V.gray(I);return RC[k]={rc,I,G:[V.hp(V.downMax(g,64),3),V.hp(V.downMax(g,160),4)],sh:V.sharp(V.downMax(g,200)),tpl:{},sta:{}}}
function refPatch(I,o){const rw=I.w*o.w,rh=I.h*o.h,k=Math.min(1,160/Math.max(rw,rh));return V.warp(I,null,o,0,Math.max(8,Math.round(rw*k)),Math.max(8,Math.round(rh*k)))}
async function roiEval(P,I,T,o,i,r,gl,op){const mf=.12,rw=P.I.w*o.w,rh=P.I.h*o.h,oc=o.tp=="ocr",k=oc?Math.min(3,Math.max(1,140/rh)):Math.min(1,160/Math.max(rw,rh)),
pw=Math.max(16,Math.round(rw*k*(1+2*mf))),ph=Math.max(12,Math.round(rh*k*(1+2*mf))),tw=Math.max(8,Math.round(pw/(1+2*mf))),th=Math.max(8,Math.round(ph/(1+2*mf))),key=i+":"+tw+"x"+th;
const R={i,n:o.n,o,tp:o.tp,s:"na",idx:null,cause:"",chk:{},m:{},quad:null,ali:null,box:{tw,th}};
if(gl){R.cause=gl;return R}
const rp=P.tpl[key]||(P.tpl[key]={g:V.gray(V.warp(P.I,null,o,0,tw,th)),A:V.stats(V.warp(P.I,null,o,0,tw,th))}),A=rp.A,q=V.warp(I,T,o,mf,pw,ph);
if(q.cov<.6){R.cause="fc";R.m.cov=q.cov;return R}
const rf=V.refine(q,rp.g),ali=V.crop(q,rf.mx+rf.dx,rf.my+rf.dy,tw,th);R.ali=ali;
const du=rf.dx/q.w*o.w*(1+2*mf),dv=rf.dy/q.h*o.h*(1+2*mf);R.quad=[[0,0],[1,0],[1,1],[0,1]].map(c=>V.mapN(T,o.x+du+c[0]*o.w,o.y+dv+c[1]*o.h));
const B=V.stats(ali);R.m.ncc=rf.q;R.m.cov=q.cov;
if(oc&&o.tx){if(op.noOcr){R.cause="ocr_skip";return R}
try{const more=op.live?[]:[0,90,180,270,(o.rot+15)%360,(o.rot+345)%360],rr=await V.ocrSearch(a=>recog(ali,a),o.tx,o.rot||0,more);R.m.txt={lido:rr.t.g,conf:Math.round(rr.conf),a:rr.a,d:rr.t.d};R.s=rr.t.s;R.cause=rr.t.s=="ok"?"":rr.t.c;R.chk.txt=rr.t.idx;R.idx=rr.t.idx}catch(e){R.cause="ocr_na"}return R}
const vr=V.vis(V.feat(ali),o,r.th),dc=V.dab(A.rgb,B.rgb),cn=[V.cname(...A.rgb),V.cname(...B.rgb)],colBad=cn[0]!=cn[1]&&(dc.dab>12||dc.dL>25);
Object.assign(R.m,{ok:vr.ok,no:vr.no,dab:dc.dab,dL:dc.dL,cn,sdA:A.sd,sdB:B.sd});R.chk.vis=vr.idx;R.chk.cor=V.colIdx(dc.dab);
const lostD=A.sd>8&&B.sd<A.sd*.55;let s=vr.s,c="";if(lostD&&(colBad||s=="no")){s="no";c="abs"}else if(colBad){s="no";c="cor"}else if(s=="no"){c=vr.no<vr.ok?"nok":"dm"}else if(s=="na")c="ink";
R.s=s;R.cause=c;R.idx=Math.min(R.chk.vis,R.chk.cor);return R}
async function analyze(c,r,op={}){const P=await prep(r),I=imgOf(c),g=V.gray(I),Tp=[V.hp(V.downMax(g,64),3),V.hp(V.downMax(g,160),4)],bl=V.sharp(V.downMax(g,200))/(P.sh||1),alq=S.cfg.alq;
let T=V.align(P.G,Tp,op.prior);if(T.q<alq&&!op.prior&&!op.live)T=V.align(P.G,Tp,null,true);
const gl=T.q<alq?"nl":bl<.4?"bl":"",res=[];
for(let i=0;i<r.rois.length;i++)if(r.rois[i].tp!="ocr")res[i]=await roiEval(P,I,T,r.rois[i],i,r,gl,op);
const nc=res.some(x=>x&&x.s=="no");
for(let i=0;i<r.rois.length;i++)if(r.rois[i].tp=="ocr")res[i]=await roiEval(P,I,T,r.rois[i],i,r,gl,Object.assign({},op,{noOcr:op.noOcr||(op.live&&nc)}));
const ctx={T,bl,r};res.forEach(x=>{x.msg=mk(x,ctx)});
const ev=res.filter(x=>x.idx!==null),f0=res.some(x=>x.s=="no")?"no":res.some(x=>x.s=="na")?"na":"ok";
return{c,r,P,T,res,gl,bl,f:gl?"na":f0,q:gl||!ev.length?null:Math.round(100*Math.min(...ev.map(x=>x.idx))),ctx}}
function fill(A){A.res.forEach(d=>{if(d.s!="ok"&&d.ali&&!d.fo){d.fo=urlOf(d.ali);d.ex=urlOf(V.warp(A.P.I,null,A.r.rois[d.i],0,d.ali.w,d.ali.h))}})}
/* ---------- sinal ao relé, voz, registro ---------- */
const sigOn=r=>S.cfg.f.sinal&&r&&r.sinal&&r.relay;
async function relayReady(r){if(!sigOn(r))return"desligado";if(await rlEnsure(r.relay))return"ok";try{const d=await navigator.bluetooth.requestDevice({filters:[{name:r.relay}],optionalServices:[NUS.s]});await rlConnect(d);return"ok"}catch(e){return"relé "+r.relay+" não conectado"}}
async function sigApply(r,v){if(!sigOn(r)){return"sinal desligado"}if(!RL.ok||RL.id!=r.relay){if(v==1)return"relé não conectado: sinal 0 mantido";return"0"}rlWant(v);return String(v)}
function voiceA(A){if(A.f=="ok")return"Conforme.";if(A.gl)return A.res[0].msg.v;const bad=A.res.filter(x=>x.s!="ok").slice(0,4);return(A.f=="no"?"Não conforme. ":"Não avaliável. ")+bad.map((x,i)=>"Item "+(x.i+1)+". "+x.msg.v).join(" ")}
function logOf(A,x){const nc=A.res.filter(d=>d.s!="ok").map(d=>({n:d.n,c:d.cause,t:d.msg.t}));return{id:Date.now().toString(36)+Math.random().toString(36).slice(2,5),t:Date.now(),n:A.r.name,ver:A.r.ver,op:SES.op?{mat:SES.op.mat,nome:SES.op.nome}:null,qr:SES.qr?SES.qr.raw:"",f:A.f,q:A.q,ct:x.ct||null,nc,th:thumb(A.c),auto:x.auto?1:0,sig:x.sig||"",bl:+A.bl.toFixed(2),tq:+A.T.q.toFixed(2),takt:A.r.takt||S.cfg.takt}}
function commit(A,x){fill(A);last=A;S.log.unshift(logOf(A,x||{}));S.log=S.log.slice(0,250);sv()}
function gate(){const f=S.cfg.f;if(f.login&&!SES.op){say("Identifique-se (matrícula) antes de inspecionar.");return 0}if(f.qr&&!SES.qr){say("Leia o QR do WMS da peça antes de inspecionar.");return 0}return 1}
/* ---------- captura única ---------- */
async function go1(){const r=curR();if(!r||!r.rois.length){say("Selecione um modelo com ROIs definidas.");return}if(!gate())return;const t0=Date.now();await relayReady(r);await sigApply(r,0);const c=await grab();if(!c)return;say("Analisando…");
const A=await analyze(c,r),sg=await sigApply(r,A.f=="ok"?1:0);commit(A,{ct:Date.now()-t0,sig:sg});say("");R();scrollTo(0,0);try{if(A.f!="ok")navigator.vibrate([250,120,250])}catch(e){}
speak(voiceA(A));if(A.f=="ok"&&sigOn(r))setTimeout(()=>sigApply(r,0),S.cfg.hold*1000)}
/* ---------- inspeção contínua ---------- */
function drawLive(A){const v=$("#vd"),cv=$("#lv"),W=cv.width=v.clientWidth,H=cv.height=v.clientHeight,x=cv.getContext("2d"),on=Math.floor(Date.now()/450)%2;x.font="bold 14px sans-serif";
A.res.forEach(d=>{if(!d.quad)return;const cc=SC[d.s];x.lineWidth=3;x.strokeStyle=x.fillStyle=cc;x.setLineDash(d.s=="na"?[8,6]:[]);if(d.s=="no"&&on){x.save();x.globalAlpha=.3;quadPath(x,d.quad,W,H);x.fill();x.restore();x.lineWidth=6}quadPath(x,d.quad,W,H);x.stroke();x.setLineDash([]);x.fillText((d.s=="no"?"NC-":"")+pd(d.i),d.quad[0][0]*W+3,Math.max(14,d.quad[0][1]*H-4))})}
function quadPath(x,q,W,H){x.beginPath();q.forEach((p,i)=>i?x.lineTo(p[0]*W,p[1]*H):x.moveTo(p[0]*W,p[1]*H));x.closePath()}
function drawRef(P,r,A){const cv=$("#rfc"),rc=P.rc;cv.width=rc.width;cv.height=rc.height;const x=cv.getContext("2d"),on=Math.floor(Date.now()/450)%2;x.drawImage(rc,0,0);x.font=`bold ${Math.max(14,rc.width/28)}px sans-serif`;
r.rois.forEach((o,i)=>{const s=A&&A.res[i]?A.res[i].s:"ok",cc=A?SC[s]:"#f5c01a";x.lineWidth=Math.max(3,rc.width/150)*(s=="no"&&on?2:1);x.strokeStyle=x.fillStyle=cc;x.strokeRect(o.x*rc.width,o.y*rc.height,o.w*rc.width,o.h*rc.height);x.fillText(pd(i),o.x*rc.width+3,Math.max(14,o.y*rc.height-4))})}
async function liveInsp(){const r=curR();if(!r||!r.rois.length){say("Selecione um modelo com ROIs definidas.");return}if(!gate())return;await relayReady(r);const P=await prep(r),tkt=r.takt||S.cfg.takt;
let A=null,prior=null,ko=0,kb=0,lock=false,lg="",t0=null,wl=null,sp={k:"",t:0};const ses={ok:0,nc:0};
const tk=()=>S.cfg.f.takt&&t0!==null?`Ciclo: ${f2((Date.now()-t0)/1000,1)} s / takt ${tkt} s${(Date.now()-t0)/1000>tkt?" ⚠️":""}`:"";
const ban=(cl,t,d)=>{$("#oi").innerHTML=`<div class="bn ${cl}">${t}</div><div class="bd">${d}</div><div class="mu" id="tkk" style="margin-top:6px">${tk()}</div><div class="mu">Sessão: ${ses.ok} conformes · ${ses.nc} NC registradas${sigOn(r)?" · relé "+(RL.ok?"🟢":"⚪")+" "+esc(r.relay):""}</div>`};
ovOpen("Iniciando câmera…","Congelar e registrar");lm=true;camOn();$("#rfw").hidden=false;drawRef(P,r,null);try{wl=await navigator.wakeLock.request("screen")}catch(e){}
await sigApply(r,0);$("#bx").onclick=()=>ovClose();$("#bc").onclick=()=>{if(A)commit(A,{ct:t0?Date.now()-t0:null});ovClose()};
const L=setInterval(()=>{if(lm){if(A)drawLive(A);drawRef(P,r,A);const e=$("#tkk");if(e)e.textContent=tk()}},450);
while(lm){const c=snap(1280);if(c){try{A=await analyze(c,r,{live:1,prior});prior=A.T.q>=S.cfg.alq?A.T:null;const bad=A.res.filter(x=>x.s=="no"),na=A.res.filter(x=>x.s=="na");
if(!lock&&t0===null&&!A.gl)t0=Date.now();
if(A.gl){ko=0;kb++;if(kb>=3){lock=false;t0=null}if(RL.want)sigApply(r,0);ban("na",A.gl=="nl"?"PEÇA NÃO LOCALIZADA":"IMAGEM DESFOCADA",esc(A.res[0].msg.t)+"<br>→ "+A.res[0].msg.a);speakOnce("g"+A.gl,A.res[0].msg.v)}
else if(A.f=="ok"){kb=0;ko++;lg="";if(ko>=3){ban("ok","CONFORME · SINAL LIBERADO","Qualidade "+A.q+"% (limite 70%) em "+ko+" quadros consecutivos."+(lock?" Registrado automaticamente.":""));if(!lock){lock=true;ses.ok++;const ct=t0?Date.now()-t0:null,sg=await sigApply(r,1);commit(A,{auto:1,ct,sig:sg});t0=null;beep(880);speak("Conforme.");try{navigator.vibrate(120)}catch(e){}}}else ban("wa","ANALISANDO…","Confirmando conformidade ("+ko+"/3)")}
else{ko=0;kb++;if(RL.want)sigApply(r,0);if(kb>=3)lock=false;const sg=bad.map(d=>d.i+d.cause).join(),cl=A.f=="no"?"no":"na";
ban(cl,(A.f=="no"?"NÃO CONFORME":"NÃO AVALIÁVEL")+" · SINAL BLOQUEADO",A.res.filter(x=>x.s!="ok").slice(0,4).map(d=>"<b>"+(d.s=="no"?"NC":"NA")+"-"+pd(d.i)+" "+esc(d.n)+"</b>: "+esc(d.msg.t)+"<br>→ "+d.msg.a).join("<br>"));
speakOnce(A.f+sg,voiceA(A));if(A.f=="no"&&kb>=4&&sg!=lg){lg=sg;ses.nc++;commit(A,{auto:1,ct:t0?Date.now()-t0:null,sig:"0"});beep(260,2);try{navigator.vibrate([200,100,200])}catch(e){}}}
}catch(e){ban("na","ERRO NA ANÁLISE",esc(e.message||e))}}await sleep(100)}
clearInterval(L);try{wl&&wl.release()}catch(e){}await sigApply(r,0);$("#rfw").hidden=true;R();
function speakOnce(k,t){if(k!=sp.k||(Date.now()-sp.t>12000&&A&&A.f!="ok")){sp={k,t:Date.now()};speak(t)}}}
/* ---------- login, QR ---------- */
const sha=async s=>Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode("kv"+s)))).map(x=>x.toString(16).padStart(2,"0")).join("");
async function doLogin(){const m=($("#mat").value||"").trim(),op=S.ops.find(o=>o.mat==m);if(!op){say("Matrícula não cadastrada (cadastro em Config, como administrador).");return}
if(S.cfg.f.face){if(!op.face||!op.face.length){say("Operador sem rosto cadastrado.");return}try{const ok=await faceVerify(op);if(!ok){say("Rosto não confirmado.");return}}catch(e){say("Reconhecimento facial indisponível: "+(e.message||e));return}}
SES.op=op;say("Operador identificado: "+op.nome);R()}
function logout(){SES.op=null;R()}
function parseQR(t){let o={raw:t};try{const j=JSON.parse(t);if(j&&typeof j=="object")o=Object.assign({},j,o)}catch(e){}const n=V.nz(t),m=S.recipes.find(r=>n.includes(V.nz(r.name)));if(m){o.rid=m.id;sel=m.id}return o}
async function doQR(){const t=await scanQR();if(t){SES.qr=parseQR(t);say(SES.qr.rid?"QR lido: modelo selecionado automaticamente.":"QR lido, mas nenhum modelo corresponde: selecione manualmente.");R()}}
/* ---------- telas ---------- */
const chip=(l,on)=>`<span class="chip ${on?"on":"off"}">${l}</span>`;
function vI(){if(!sel&&S.recipes[0])sel=S.recipes[0].id;const f=S.cfg.f,r=curR(),o=S.recipes.map(x=>`<option value="${x.id}"${x.id==sel?" selected":""}>${esc(x.name)} (${x.rois.length} ROIs)</option>`).join("");
return `<div class="c"><b>Setup do posto</b><div>${chip("Login",f.login)}${chip("Facial",f.face)}${chip("QR WMS",f.qr)}${chip("Sinal",f.sinal)}${chip("Voz",f.voz)}${chip("Takt",f.takt)}</div>
<div class="row"><span style="flex:1">Operador: <b>${SES.op?esc(SES.op.nome)+" ("+esc(SES.op.mat)+")":"não identificado"}</b></span>${SES.op?'<button class="g" onclick="logout()">Sair</button>':""}</div>
${SES.op?"":`<div class="row"><input id="mat" placeholder="Matrícula" inputmode="numeric"><button class="g" onclick="doLogin()">Entrar</button></div>`}
<div class="row"><span style="flex:1">Peça (QR WMS): <b>${SES.qr?esc(SES.qr.raw.slice(0,40)):"não lido"}</b></span><button class="g" onclick="doQR()">Ler QR</button></div></div>
<div class="c"><label>Modelo de inspeção (código do chicote)</label><select onchange="sel=this.value;R()">${o||'<option value="">Nenhum modelo criado</option>'}</select>
<div class="mu">${r?`v${r.ver}${r.lock?" · congelada":""} · takt ${r.takt||S.cfg.takt} s${sigOn(r)?" · relé "+esc(r.relay)+(RL.ok&&RL.id==r.relay?" 🟢":" ⚪"):""}`:""}</div>${r&&r.ref?`<img src="${r.ref}" style="max-width:100%;max-height:150px;border-radius:8px;display:block;margin:8px auto 0" alt="Referência correta"><div class="mu" style="text-align:center">Referência correta de montagem (golden sample)</div>`:""}
<button class="b" onclick="liveInsp()">▶ Inspeção contínua (aprovação automática)</button><button class="g" style="width:100%;margin-top:8px" onclick="go1()">📷 Capturar foto única</button></div>${last?resH():""}`}
function resH(){const L=last,lab={ok:"CONFORME",no:"NÃO CONFORME (NC)",na:"NÃO AVALIÁVEL"}[L.f],bad=L.res.filter(x=>x.s!="ok"&&L.res[0]&&!L.gl),cl={ok:"ok",no:"no",na:"na"}[L.f];
const glB=L.gl?`<div class="it na"><div class="nm">${CAUSA[L.gl]}</div><div>${esc(L.res[0].msg.t)}</div><div class="ac">→ ${L.res[0].msg.a}</div></div>`:"";
const cmp=x=>x.fo?`<div class="cmp"><figure><img src="${x.ex}" alt="">Referência (correta)</figure><figure><img src="${x.fo}" alt="">Encontrado</figure></div>`:"";
const chkT=x=>[x.chk.vis!==undefined?"visual "+Math.round(x.chk.vis*100)+"%":"",x.chk.cor!==undefined?"cor "+Math.round(x.chk.cor*100)+"%":"",x.chk.txt!==undefined?"texto "+Math.round(x.chk.txt*100)+"%":""].filter(Boolean).join(" · ")||"—";
const dgH=bad.length||L.gl?`<div class="c"><b>Diagnóstico técnico</b>${glB}${bad.map(x=>`<div class="it ${x.s=="no"?"nc":"na"}"><div class="nm">${x.s=="no"?"NC":"NA"}-${pd(x.i)} · ${esc(x.n)} <span class="mu">(${CAUSA[x.cause]||""})</span></div><div>${esc(x.msg.t)}</div><div class="mu">Índices: ${chkT(x)}</div><div class="ac">→ Ação: ${x.msg.a}</div>${cmp(x)}</div>`).join("")}</div>`:`<div class="c"><b>Diagnóstico técnico: nenhuma NC</b><div class="mu">Todas as ROIs conformes com a referência.</div></div>`;
const truth=S.log[0]&&S.log[0].truth?` Registrado: ${S.log[0].truth=="ok"?"OK":"NOK"}`:"";
return `<div class="c"><div class="rs ${cl}">${lab}</div><div class="pq"><b>${L.q!==null?L.q+"%":"—"}</b> índice de conformidade <span class="mu">(pior verificação · limite 70% · texto: exato)</span></div>
<div class="mu">Alinhamento: ${Math.round(Math.max(0,L.T.q)*100)}% · nitidez relativa ${f2(L.bl)} · sinal ao relé: ${S.log[0]?esc(S.log[0].sig||"—"):"—"} · ciclo ${S.log[0]&&S.log[0].ct?f2(S.log[0].ct/1000,1)+" s":"—"}</div>
<button class="g" style="width:100%;margin-top:8px" onclick="speak(voiceA(last),1)">🔊 Repetir diagnóstico por voz</button></div>${dgH}
<div class="c"><div class="two"><div><canvas id="cr"></canvas><div class="mu">Referência (correta)</div></div><div><canvas id="cv"></canvas><div class="mu">Capturada (vermelho = NC, cinza = não avaliável)</div></div></div>
<table><tr><th>ROI</th><th>Estado</th><th>Índices</th></tr>${L.res.map(x=>`<tr><td>${pd(x.i)} ${esc(x.n)}</td><td>${x.s=="ok"?"conforme":x.s=="no"?"NC":"n/a"}</td><td>${chkT(x)}</td></tr>`).join("")}</table></div>
${S.cfg.f.val?`<div class="c"><b>Validação da acurácia</b><div class="row"><span style="flex:1" class="mu">Resultado real desta peça:${truth}</span><button class="g" onclick="setTruth(0,'ok')">OK</button><button class="g" onclick="setTruth(0,'no')">NOK</button></div></div>`:""}
<details class="c"><summary>Treinamento supervisionado: rotular amostras desta captura</summary>${L.res.map(x=>x.ali&&x.tp!="ocr"?`<div class="row"><span style="flex:1">ROI ${pd(x.i)} · ${esc(x.n)}<div class="mu">n_OK = ${x.o.ok.length} · n_NOK = ${x.o.no.length}</div></span><button class="g" onclick="teach('ok',${x.i})">Rotular OK</button><button class="g" onclick="teach('no',${x.i})">Rotular NOK</button></div>`:"").join("")}<button class="g" style="width:100%;margin-top:8px" onclick="teach('ok')">Rotular todas as ROIs visuais como OK</button><div id="tm" class="mu" style="margin-top:8px"></div></details>`}
function learnP(o,k,ali){o[k].push(V.feat(ali));const t=k=="ok"?"ot":"nt";(o[t]=o[t]||[]).push(urlOf(ali,64,.6))}
function teach(k,i){if(!last)return;last.res.forEach((d,j)=>{if((i===undefined||i===j)&&d.ali&&d.tp!="ocr")learnP(last.r.rois[j],k,d.ali)});sv();const m="Amostra rotulada como "+(k=="ok"?"OK":"NOK")+". Reinspecione para validar.";const e=$("#tm");if(e)e.textContent=m;say(m)}
function setTruth(i,v){if(S.log[i]){S.log[i].truth=v;sv();R()}}
function paint(){const cv=$("#cv"),cr=$("#cr");if(!cv||!last)return;const L=last,c=L.c,W=c.width,H=c.height,rc=L.P.rc;cv.width=W;cv.height=H;cr.width=rc.width;cr.height=rc.height;let on=false;
const draw=()=>{on=!on;const x=cv.getContext("2d"),fs=Math.max(14,W/32);x.drawImage(c,0,0);x.font=`bold ${fs}px sans-serif`;
L.res.forEach(d=>{if(!d.quad)return;const cc=SC[d.s];x.lineWidth=Math.max(3,W/150);x.strokeStyle=x.fillStyle=cc;x.setLineDash(d.s=="na"?[10,8]:[]);if(d.s=="no"&&on){x.save();x.globalAlpha=.3;quadPath(x,d.quad,W,H);x.fill();x.restore();x.lineWidth=Math.max(6,W/70)}quadPath(x,d.quad,W,H);x.stroke();x.setLineDash([]);x.fillText((d.s=="no"?"NC-":"")+pd(d.i)+" "+d.n,d.quad[0][0]*W+4,Math.max(fs,d.quad[0][1]*H-6))});
const y=cr.getContext("2d");y.drawImage(rc,0,0);y.font=`bold ${Math.max(14,rc.width/32)}px sans-serif`;L.r.rois.forEach((o,i)=>{const d=L.res[i],cc=SC[d.s];y.lineWidth=Math.max(3,rc.width/150)*(d.s=="no"&&on?2:1);y.strokeStyle=y.fillStyle=cc;y.strokeRect(o.x*rc.width,o.y*rc.height,o.w*rc.width,o.h*rc.height);y.fillText(pd(i),o.x*rc.width+4,Math.max(14,o.y*rc.height-5))})};
draw();if(L.res.some(d=>d.s=="no"))bt=setInterval(draw,450)}
/* ---------- referências (modelos) ---------- */
function vR(){return `<div class="c"><label>Novo modelo (código do chicote)</label><input id="nm" placeholder="Ex.: CAT-1234"><button class="b" onclick="newR()">Criar modelo</button></div>`+S.recipes.map(r=>`<div class="c row"><b style="flex:1">${esc(r.name)}</b><span class="mu">v${r.ver}${r.lock?" · congelada":""} · ${r.rois.length} ROIs</span><button class="g" onclick="edit('${r.id}')">Editar</button></div>`).join("")}
function newR(){const n=$("#nm").value.trim();if(!n){say("Informe o código do chicote.");return}const r={id:Date.now().toString(36),name:n,ref:null,rois:[],th:.1,takt:0,sinal:0,relay:"",lock:0,ver:1};S.recipes.push(r);sel=r.id;sv();edit(r.id)}
async function edit(id){E=id;refC=null;refI=null;const r=cur();if(r.ref){refC=await fromURL(r.ref);refI=imgOf(refC)}R()}
const lvl=o=>{if(o.tp=="ocr")return o.tx?3:1;const nO=o.ok.length,nN=o.no.length;return nO>=10&&nN>=5?4:nO>=3&&nN>=2?3:nO>=3?2:1};
const lvN=["","Nível 1 · referência única","Nível 2 · treinamento parcial (classe OK)","Nível 3 · validado (OK + NOK)","Nível 4 · robusto"];
function vE(){const r=cur(),lk=r.lock,rl=S.cfg.relays.map(x=>`<option value="${esc(x.id)}"${x.id==r.relay?" selected":""}>${esc(x.id)}${x.nome?" · "+esc(x.nome):""}</option>`).join("");
const gal=o=>`<div class="gal"><img class="th" style="border-color:var(--ac)" src="${urlOf(refPatch(refI,o),64,.6)}" alt="">${(o.ot||[]).map(u=>`<img class="th" style="border-color:var(--ok)" src="${u}" alt="">`).join("")}${(o.nt||[]).map(u=>`<img class="th" style="border-color:var(--no)" src="${u}" alt="">`).join("")}</div>`;
return `<div class="c"><div class="row"><b style="flex:1">${esc(r.name)} <span class="mu">v${r.ver}${lk?" · congelada":""}</span></b><button class="g" onclick="E=null;R()">Voltar</button></div>
<button class="b" onclick="setRef()"${lk?" disabled":""}>${r.ref?"🔄 Substituir imagem de referência (golden sample)":"📷 Imagem de referência (golden sample)"}</button>
${r.ref?`<p class="mu">${lk?"Referência congelada: as ROIs não podem ser alteradas.":"Arraste sobre a imagem para criar cada ROI (região de interesse). Nomes claros: Conector principal, Fusível F12."}</p><canvas id="ec" style="touch-action:none"></canvas>
<div class="row"><button class="g" onclick="toggleLock()">${lk?"🔓 Descongelar (administrador)":"🔒 Congelar referência"}</button></div>`:""}</div>
${r.ref?`<div class="c"><b>Parâmetros do modelo</b><div class="row"><span style="min-width:9em">Takt (s)</span><input type="number" min="0" value="${r.takt||""}" placeholder="${S.cfg.takt}" onchange="cur().takt=+this.value||0;sv()"></div>
<div class="row"><label style="margin:0"><input type="checkbox" ${r.sinal?"checked":""} onchange="cur().sinal=this.checked?1:0;sv();R()"> Enviar sinal ao relé (0 = bloqueado · 1 = aprovado)</label></div>
${r.sinal?`<div class="row"><select onchange="cur().relay=this.value;sv()"><option value="">— selecione o relé —</option>${rl}</select><button class="g" onclick="pairRelay(true)">Detectar relé</button></div><div class="mu">${r.relay?"ID do relé: "+esc(r.relay):"Nenhum relé associado. Use Detectar relé (Bluetooth) para reconhecer e registrar o ID único."}</div>`:""}
<label id="rl" style="margin-top:8px">Limiar de decisão τ = ${f2(r.th)} (menor = mais rigoroso)</label><input type="range" min="3" max="25" value="${Math.round(r.th*100)}" oninput="rig(this.value)"></div>
<div class="c"><b>ROIs e referências aprendidas</b><p class="mu">Amarelo = referência, verde = amostra OK, vermelho = NC rotulada.</p>
${r.rois.map((o,i)=>`<div class="it" style="border-left-color:var(--ac)"><div class="row"><input value="${esc(o.n)}" onchange="cur().rois[${i}].n=this.value;sv()"><button class="g" onclick="delRoi(${i})"${lk?" disabled":""}>✕</button></div>
<div class="row"><select onchange="cur().rois[${i}].tp=this.value;sv();R()"><option value="vis"${o.tp!="ocr"?" selected":""}>Verificação visual (cor, presença, forma)</option><option value="ocr"${o.tp=="ocr"?" selected":""}>Leitura OCR (texto)</option></select></div>
${o.tp=="ocr"?`<div class="row"><input placeholder="Texto esperado" value="${esc(o.tx||"")}" onchange="cur().rois[${i}].tx=this.value;sv()"><button class="g" onclick="readRef(${i})">Ler da referência</button></div><div class="mu">Orientação do texto na referência: ${o.rot||0}° (detectada automaticamente) · ${lvN[lvl(o)]}</div>`:`<div class="mu">n_OK = ${o.ok.length} · n_NOK = ${o.no.length} · ${lvN[lvl(o)]}</div>${gal(o)}<button class="g" style="margin-top:6px" onclick="resetR(${i})">Limpar aprendizado</button>`}</div>`).join("")||'<p class="mu">Nenhuma ROI definida.</p>'}
<button class="g" style="width:100%;margin-top:8px" onclick="addS('ok')">＋ Amostra OK (todas as ROIs conformes)</button><p class="mu">Para ensinar não conformidades (NOK), use a inspeção e rotule a ROI com NC.</p></div>`:""}
<button class="g" style="width:100%;color:var(--no)" onclick="delR()">Excluir modelo</button>`}
function toggleLock(){const r=cur();if(r.lock&&!ADM){say("Descongelar exige acesso de administrador (aba Config).");return}r.lock=r.lock?0:1;if(!r.lock)r.ver++;sv();R()}
async function setRef(){const r=cur();if(r.lock)return;const c=await grab();if(!c)return;refC=c;refI=imgOf(c);r.ref=c.toDataURL("image/jpeg",.85);r.ver++;r.rois.forEach(o=>{o.ok=[V.feat(refPatch(refI,o))];o.no=[];o.ot=[];o.nt=[]});sv();R()}
async function addS(k){const r=cur(),c=await grab();if(!c)return;say("Analisando amostra…");const A=await analyze(c,r,{noOcr:1});if(A.gl){say("Amostra não alinhada ("+CAUSA[A.gl]+"): refaça a captura.");return}A.res.forEach((d,i)=>{if(d.ali&&r.rois[i].tp!="ocr")learnP(r.rois[i],k,d.ali)});sv();say("Amostra OK adicionada.");R()}
async function readRef(i){const r=cur(),o=r.rois[i];say("Lendo o texto e detectando a orientação (cerca de 10 s)…");try{const rw=refI.w*o.w,rh=refI.h*o.h,k=Math.min(3,Math.max(1,140/rh)),ali=V.warp(refI,null,o,0,Math.round(rw*k),Math.round(rh*k)),d=await V.ocrDetect(a=>recog(ali,a));o.rot=d.a;o.tx=d.text.trim().replace(/\s+/g," ");sv();say(`Texto lido (confiança ${Math.round(d.conf)}%, orientação ${d.a}°). Confira e corrija se necessário.`);R()}catch(e){say("OCR indisponível: conecte à internet para carregar o motor.")}}
function resetR(i){const o=cur().rois[i];o.ok=[V.feat(refPatch(refI,o))];o.no=[];o.ot=[];o.nt=[];sv();R()}
function delRoi(i){const r=cur();if(r.lock)return;r.rois.splice(i,1);r.ver++;sv();R()}
function delR(){S.recipes=S.recipes.filter(x=>x.id!=E);E=null;sel="";sv();R()}
function rig(v){cur().th=v/100;$("#rl").textContent="Limiar de decisão τ = "+f2(v/100)+" (menor = mais rigoroso)";sv()}
function paintE(){const cv=$("#ec");if(!cv||!refC)return;const r=cur();cv.width=refC.width;cv.height=refC.height;let a=null;
const draw=(a,b)=>{const x=cv.getContext("2d"),W=cv.width,H=cv.height;x.drawImage(refC,0,0);x.lineWidth=Math.max(3,W/150);x.font=`bold ${Math.max(14,W/35)}px sans-serif`;x.strokeStyle=x.fillStyle="#f5c01a";r.rois.forEach(o=>{x.strokeRect(o.x*W,o.y*H,o.w*W,o.h*H);x.fillText(o.n,o.x*W+4,o.y*H-5)});if(a&&b){x.strokeStyle="#fff";x.strokeRect(a[0]*W,a[1]*H,(b[0]-a[0])*W,(b[1]-a[1])*H)}};
const P=e=>{const b=cv.getBoundingClientRect();return[(e.clientX-b.left)/b.width,(e.clientY-b.top)/b.height]};
draw();if(r.lock)return;cv.onpointerdown=e=>{a=P(e);cv.setPointerCapture(e.pointerId)};cv.onpointermove=e=>{if(a)draw(a,P(e))};
cv.onpointerup=e=>{if(!a)return;const b=P(e),x=Math.min(a[0],b[0]),y=Math.min(a[1],b[1]),w=Math.abs(a[0]-b[0]),h=Math.abs(a[1]-b[1]);a=null;
if(w>.02&&h>.02){const o={n:"R"+(r.rois.length+1),x,y,w,h,ok:[],no:[],ot:[],nt:[],tp:"vis",tx:"",rot:0};o.ok=[V.feat(refPatch(refI,o))];r.rois.push(o);r.ver++;sv()}R()}}
/* ---------- relatório e validação estatística ---------- */
function vL(){const L=S.log,n={ok:0,no:0,na:0};L.forEach(l=>n[l.f]++);const tot=L.length,cts=L.filter(l=>l.ct).map(l=>l.ct/1000),tk=V.takt(cts,S.cfg.takt),cf=V.conf(L.map(l=>({sys:l.f,truth:l.truth})));
const par={};L.forEach(l=>(l.nc||[]).forEach(x=>{const k=x.n+" · "+(CAUSA[x.c]||x.c);par[k]=(par[k]||0)+1}));const pr=Object.entries(par).sort((a,b)=>b[1]-a[1]).slice(0,8),mx=pr.length?pr[0][1]:1;
const grp=(f)=>{const g={};L.forEach(l=>{const k=f(l);g[k]=g[k]||{ok:0,no:0,na:0,ct:[]};g[k][l.f]++;if(l.ct)g[k].ct.push(l.ct/1000)});return Object.entries(g).map(([k,v])=>`<tr><td>${esc(k)}</td><td>${v.ok}</td><td>${v.no}</td><td>${v.na}</td><td>${v.ct.length?f2(v.ct.reduce((a,b)=>a+b,0)/v.ct.length,1)+" s":"—"}</td></tr>`).join("")};
const ci=a=>pc(a[0])+" a "+pc(a[1]);
return `<div class="three" style="margin-bottom:10px"><div class="kp ok"><b>${n.ok}</b>conformes</div><div class="kp no"><b>${n.no}</b>não conformes</div><div class="kp na"><b>${n.na}</b>não avaliáveis</div></div>
<div class="c"><b>Indicadores</b><div class="mu">Inspeções: ${tot} · conformidade de primeira passada: ${tot?pc(n.ok/tot):"—"}</div>
${tk?`<div class="mu">Tempo de ciclo: média ${f2(tk.avg,1)} s · P95 ${f2(tk.p95,1)} s · mín ${f2(tk.min,1)} s · máx ${f2(tk.max,1)} s · dentro do takt (${S.cfg.takt} s): ${pc(tk.pin)}</div>`:""}</div>
<div class="c"><b>Validação estatística da acurácia</b>${cf.n?`<div class="mu">Peças com resultado real informado: ${cf.n} (defeituosas ${cf.nn} · boas ${cf.no})</div>
<table><tr><th></th><th>Sistema: NC/NA</th><th>Sistema: conforme</th></tr><tr><td>Real NOK</td><td>${cf.TP}</td><td><b>${cf.FN}</b> (escape)</td></tr><tr><td>Real OK</td><td>${cf.FP} (falso-reprovado)</td><td>${cf.TN}</td></tr></table>
<div class="mu">Acurácia ${pc(cf.acc)} · sensibilidade ${pc(cf.sens)} · especificidade ${pc(cf.spec)} · κ de Cohen ${cf.kappa===null?"—":f2(cf.kappa,3)}</div>
<div class="mu"><b>Taxa de falso-aprovado:</b> ${cf.FN}/${cf.nn} = ${pc(cf.far)} · IC 95% (Wilson) ${ci(cf.farCI)}${cf.r3!==null?" · regra dos três: ≤ "+pc(cf.r3):""}</div>
<div class="mu">Taxa de falso-reprovado: ${cf.FP}/${cf.no} = ${pc(cf.frr)} · IC 95% ${ci(cf.frrCI)}</div>`:`<div class="mu">Informe o resultado real (OK/NOK) de cada peça na tela do resultado ou abaixo, para calcular matriz de confusão, falso-aprovado e intervalo de confiança.</div>`}</div>
<div class="c"><b>Pareto de não conformidades</b>${pr.length?pr.map(([k,v])=>`<div class="mu">${esc(k)} · ${v}</div><div class="bar" style="width:${Math.round(100*v/mx)}%"></div>`).join(""):'<div class="mu">Sem NC registradas.</div>'}</div>
<div class="c"><b>Por operador</b><table><tr><th>Matrícula</th><th>OK</th><th>NC</th><th>NA</th><th>Ciclo</th></tr>${grp(l=>l.op?l.op.mat+" "+l.op.nome:"(sem login)")}</table><b>Por modelo</b><table><tr><th>Modelo</th><th>OK</th><th>NC</th><th>NA</th><th>Ciclo</th></tr>${grp(l=>l.n+" v"+l.ver)}</table></div>
${L.map((l,k)=>`<div class="c row"><img src="${l.th}" width="56" height="42" style="object-fit:cover;border-radius:6px" alt=""><div style="flex:1"><b>${esc(l.n)}</b> v${l.ver} · ${l.q!==null&&l.q!==undefined?l.q+"%":"—"}${l.auto?" · auto":""}<div class="mu">${new Date(l.t).toLocaleString("pt-BR")}${l.op?" · "+esc(l.op.mat):""}${l.ct?" · "+f2(l.ct/1000,1)+" s":""}${l.qr?" · WMS "+esc(l.qr.slice(0,24)):""}</div>${(l.nc||[]).length?`<div style="font-size:.85rem">${l.nc.map(x=>esc(x.n)+": "+esc(CAUSA[x.c]||x.c)).join("; ")}</div>`:""}
${S.cfg.f.val?`<div class="mu">Real: ${l.truth?(l.truth=="ok"?"OK":"NOK"):"não informado"} <button class="g" onclick="setTruth(${k},'ok')">OK</button><button class="g" onclick="setTruth(${k},'no')">NOK</button></div>`:""}</div><span class="dot ${l.f}"></span><button class="g" onclick="delL(${k})">✕</button></div>`).join("")}
${L.length?`<button class="g" style="width:100%" onclick="csv()">Mostrar CSV para copiar</button><textarea id="cs" rows="6" hidden></textarea>`:'<p class="mu">Nenhuma inspeção registrada ainda.</p>'}`}
function delL(k){S.log.splice(k,1);sv();R()}
function csv(){const t=$("#cs");t.hidden=false;const N={ok:"CONFORME",no:"NAO_CONFORME",na:"NAO_AVALIAVEL"};t.value="data_hora;modelo;versao;matricula;operador;qr_wms;resultado;indice_pct;tempo_s;sinal;nc;real\n"+S.log.map(l=>[new Date(l.t).toLocaleString("pt-BR"),l.n,l.ver,l.op?l.op.mat:"",l.op?l.op.nome:"",l.qr||"",N[l.f],l.q??"",l.ct?(l.ct/1000).toFixed(1):"",l.sig||"",(l.nc||[]).map(x=>x.n+":"+x.c).join("|"),l.truth||""].join(";")).join("\n");t.select();try{navigator.clipboard.writeText(t.value)}catch(e){}}
/* ---------- configuração (administrador) ---------- */
const FL={login:"Exigir login do operador",face:"Exigir confirmação facial no login",qr:"Exigir leitura do QR do WMS",sinal:"Enviar sinal ao relé (0/1)",voz:"Voz do diagnóstico",takt:"Mostrar takt time",val:"Modo validação: informar resultado real"};
function vC(){if(!ADM)return `<div class="c"><b>Acesso do administrador</b><p class="mu">${S.cfg.pin?"Informe o PIN.":"Defina um PIN (mínimo 4 dígitos) para proteger as configurações."}</p><div class="row"><input id="pin" type="password" inputmode="numeric" placeholder="PIN"><button class="g" onclick="admIn()">${S.cfg.pin?"Entrar":"Definir PIN"}</button></div></div>`;
return `<div class="c"><b>Modo administrador · opções do teste</b><p class="mu">Desmarque para testar a acurácia sem login, QR, facial ou sinal; marque quando for colocar em produção. Cada alteração vale para este aparelho.</p>
${Object.keys(FL).map(k=>`<div class="row"><label style="margin:0"><input type="checkbox" ${S.cfg.f[k]?"checked":""} onchange="flag('${k}',this.checked)"> ${FL[k]}</label></div>`).join("")}
<div class="row"><span style="min-width:12em">Manter sinal 1 por (s)</span><input type="number" min="1" value="${S.cfg.hold}" onchange="S.cfg.hold=+this.value||10;sv()"></div>
<div class="row"><span style="min-width:12em">Takt padrão (s)</span><input type="number" min="1" value="${S.cfg.takt}" onchange="S.cfg.takt=+this.value||60;sv()"></div>
<div class="row"><span style="min-width:12em">Alinhamento mínimo (NCC)</span><input type="number" step="0.05" min="0.1" max="0.9" value="${S.cfg.alq}" onchange="S.cfg.alq=+this.value||.3;sv()"></div></div>
<div class="c"><b>Operadores</b><p class="mu">O rosto é guardado só como vetor numérico (sem foto).</p>${S.ops.map((o,i)=>`<div class="row"><span style="flex:1">${esc(o.mat)} · ${esc(o.nome)} ${o.face&&o.face.length?"🙂":"(sem rosto)"}</span><button class="g" onclick="enrollOp(${i})">Cadastrar rosto</button><button class="g" onclick="delOp(${i})">✕</button></div>`).join("")}
<div class="row"><input id="om" placeholder="Matrícula" inputmode="numeric"><input id="on" placeholder="Nome"><button class="g" onclick="addOp()">Adicionar</button></div></div>
<div class="c"><b>Relés (Bluetooth)</b><p class="mu">Cada relé tem ID único (KVR-xxxx), gravado no firmware. O app reconhece e registra ao detectar.</p>${S.cfg.relays.map((x,i)=>`<div class="row"><span style="flex:1"><b>${esc(x.id)}</b> ${RL.ok&&RL.id==x.id?"🟢":"⚪"}<input value="${esc(x.nome||"")}" placeholder="Apelido (ex.: Mesa 03)" onchange="S.cfg.relays[${i}].nome=this.value;sv()"></span><button class="g" onclick="testRelay('${esc(x.id)}')">Testar</button><button class="g" onclick="delRelay(${i})">✕</button></div>`).join("")}
<button class="b" onclick="pairRelay()">🔎 Detectar relé</button><div class="mu" id="rlm">${esc(RL.err)}</div></div>
<div class="c"><b>Câmera</b><button class="b" onclick="camTest()">🎥 Teste de câmera (zoom, foco, exposição, resolução)</button></div>
<div class="c"><b>Dados armazenados</b><p class="mu">${S.recipes.length} modelos · ${S.log.length} inspeções · ${S.ops.length} operadores · aprox. ${Math.round(JSON.stringify(S).length/1024)} KB. Nada é enviado a servidores.</p>
<button class="g" style="width:100%" onclick="wipe('log')">Apagar registro de inspeções</button><button class="g" style="width:100%;margin-top:8px" onclick="wipe('train')">Apagar treinamento (amostras OK/NOK)</button><button class="g" style="width:100%;margin-top:8px" onclick="wipe('ops')">Apagar operadores e rostos</button><button class="g" style="width:100%;margin-top:8px" onclick="wipe('models')">Apagar todos os modelos</button><button class="b" style="background:var(--no);color:#fff" onclick="wipe('all')">Apagar TUDO e limpar o cache do app</button>
<button class="g" style="width:100%;margin-top:8px" onclick="ADM=false;R()">Sair do modo administrador</button></div>`}
async function admIn(){const v=($("#pin").value||"").trim(),h=await sha(v);if(!S.cfg.pin){if(v.length<4){say("O PIN precisa ter ao menos 4 dígitos.");return}S.cfg.pin=h;ADM=true;sv()}else if(h==S.cfg.pin)ADM=true;else{say("PIN incorreto.");return}say("");R()}
function flag(k,v){S.cfg.f[k]=v?1:0;sv()}
function addOp(){const m=$("#om").value.trim(),n=$("#on").value.trim();if(!m||!n){say("Informe matrícula e nome.");return}if(S.ops.some(o=>o.mat==m)){say("Matrícula já cadastrada.");return}S.ops.push({mat:m,nome:n,face:[]});sv();R()}
function delOp(i){S.ops.splice(i,1);if(SES.op&&!S.ops.includes(SES.op))SES.op=null;sv();R()}
async function enrollOp(i){try{const L=await faceEnroll();if(L){S.ops[i].face=L;sv();say("Rosto cadastrado (vetores numéricos, sem foto).")}else say("Cadastro cancelado ou rosto não detectado.")}catch(e){say("Reconhecimento facial indisponível: "+(e.message||e))}R()}
async function pairRelay(inRecipe){try{const d=await rlPair();if(!S.cfg.relays.some(x=>x.id==d.name))S.cfg.relays.push({id:d.name,nome:""});await rlConnect(d);if(inRecipe&&cur()){cur().relay=d.name}sv();say("Relé reconhecido: "+d.name+" (ID único).")}catch(e){RL.err=String(e.message||e);say("Não foi possível detectar o relé: "+RL.err)}R()}
async function testRelay(id){try{if(!await rlEnsure(id)){const d=await navigator.bluetooth.requestDevice({filters:[{name:id}],optionalServices:[NUS.s]});await rlConnect(d)}rlWant(1);setTimeout(()=>{rlWant(0);R()},1000);say("Pulso de teste enviado a "+id)}catch(e){say("Falha no teste: "+(e.message||e))}}
function delRelay(i){S.cfg.relays.splice(i,1);sv();R()}
async function wipe(w){const m={log:"Apagar todo o registro de inspeções?",train:"Apagar todas as amostras de treinamento (OK/NOK)? Referências e ROIs serão mantidas.",ops:"Apagar todos os operadores e os vetores faciais?",models:"Apagar TODOS os modelos (referências, ROIs e treinamento)?",all:"Apagar TODOS os dados e limpar o cache do app? Não pode ser desfeito."}[w];if(!confirm(m))return;
if(w=="log"||w=="all")S.log=[];if(w=="ops"||w=="all"){S.ops=[];SES.op=null}if(w=="train")S.recipes.forEach(r=>r.rois.forEach(o=>{o.ok=o.ok.slice(0,1);o.no=[];o.ot=[];o.nt=[]}));if(w=="models"||w=="all"){S.recipes=[];sel="";E=null;RC={}}
last=null;if(w=="all"){S=JSON.parse(JSON.stringify(DEF));ADM=false;try{localStorage.removeItem("kv");const k=await caches.keys();await Promise.all(k.map(x=>caches.delete(x)))}catch(e){}}else sv();say("Dados apagados.");R()}
function R(){clearInterval(bt);document.querySelectorAll("nav button").forEach(b=>b.classList.toggle("on",b.dataset.v==V_));$("#app").innerHTML=V_=="insp"?vI():V_=="rec"?(E?vE():vR()):V_=="cfg"?vC():vL();if(V_=="insp")paint();if(V_=="rec"&&E)paintE()}
R();
