/* Kabel Vision · núcleo de visão (sem DOM). Imagens: {w,h,data:RGBA}. Cinzas: {w,h,g:Float32Array} */
(function(G){
const V={},cl=(x,a,b)=>Math.max(a,Math.min(b,x));
V.gray=I=>{const n=I.w*I.h,o=new Float32Array(n),d=I.data;for(let i=0;i<n;i++)o[i]=.3*d[i*4]+.59*d[i*4+1]+.11*d[i*4+2];return{w:I.w,h:I.h,g:o}};
V.downMax=(Y,M)=>{const k=M/Math.max(Y.w,Y.h),W=Math.max(1,Math.round(Y.w*k)),H=Math.max(1,Math.round(Y.h*k)),o=new Float32Array(W*H);
for(let y=0;y<H;y++){const y0=Math.floor(y*Y.h/H),y1=Math.max(y0+1,Math.floor((y+1)*Y.h/H));for(let x=0;x<W;x++){const x0=Math.floor(x*Y.w/W),x1=Math.max(x0+1,Math.floor((x+1)*Y.w/W));let s=0,n=0;for(let j=y0;j<y1;j++)for(let i=x0;i<x1;i++){s+=Y.g[j*Y.w+i];n++}o[y*W+x]=s/n}}return{w:W,h:H,g:o}};
V.hp=(Y,r)=>{const{w,h,g}=Y,S=new Float64Array((w+1)*(h+1));for(let y=0;y<h;y++){let row=0;for(let x=0;x<w;x++){row+=g[y*w+x];S[(y+1)*(w+1)+x+1]=S[y*(w+1)+x+1]+row}}
const o=new Float32Array(w*h);for(let y=0;y<h;y++)for(let x=0;x<w;x++){const x0=Math.max(0,x-r),x1=Math.min(w,x+r+1),y0=Math.max(0,y-r),y1=Math.min(h,y+r+1),s=S[y1*(w+1)+x1]-S[y0*(w+1)+x1]-S[y1*(w+1)+x0]+S[y0*(w+1)+x0];o[y*w+x]=g[y*w+x]-s/((x1-x0)*(y1-y0))}return{w,h,g:o}};
V.sharp=Y=>{let s=0,q=0,n=0;for(let y=1;y<Y.h-1;y++)for(let x=1;x<Y.w-1;x++){const i=y*Y.w+x,v=4*Y.g[i]-Y.g[i-1]-Y.g[i+1]-Y.g[i-Y.w]-Y.g[i+Y.w];s+=v;q+=v*v;n++}return n?q/n-(s/n)*(s/n):0};
/* ---------- alinhamento global (rotação + escala + translação) ---------- */
V.pts=(R,st)=>{const x=[],y=[],v=[];for(let j=0;j<R.h;j+=st)for(let i=0;i<R.w;i+=st){x.push(i-R.w/2);y.push(j-R.h/2);v.push(R.g[j*R.w+i])}return{x:Float32Array.from(x),y:Float32Array.from(y),v:Float32Array.from(v),n:v.length}};
V.sc=(P,T,th,s,tx,ty)=>{const rd=Math.round,c=Math.cos(th),sn=Math.sin(th),W=T.w,H=T.h,cx=W/2+tx,cy=H/2+ty;let n=0,sa=0,sb=0,saa=0,sbb=0,sab=0;
for(let i=0;i<P.n;i++){const xr=P.x[i],yr=P.y[i],X=rd(cx+s*(c*xr-sn*yr)),Y=rd(cy+s*(sn*xr+c*yr));if(X<0||Y<0||X>=W||Y>=H)continue;const b=T.g[Y*W+X],a=P.v[i];n++;sa+=a;sb+=b;saa+=a*a;sbb+=b*b;sab+=a*b}
if(n<P.n*.3)return -1;const va=saa-sa*sa/n,vb=sbb-sb*sb/n;if(va<1e-6||vb<1e-6)return -1;const r=(sab-sa*sb/n)/Math.sqrt(va*vb),k=n/(P.n*.6);return r*(k<1?k:1)};
V.align=(Rp,Tp,pr,deep)=>{const R0=Rp[0],T0=Tp[0],R1=Rp[1],T1=Tp[1],P0=V.pts(R0,2),P1=V.pts(R1,2),D=Math.PI/180,A=[],S=[];let b={q:-2};
if(pr){for(let a=-20;a<=20;a+=5)A.push(pr.th+a*D);for(const k of[.9,.95,1,1.05,1.1])S.push(pr.s*k)}else{for(let a=0;a<360;a+=deep?5:10)A.push(a*D);for(const k of[.7,.8,.9,1,1.12,1.25,1.4])S.push(k)}
const rg=pr?8:deep?16:12,st=pr?2:deep?2:4,bx=pr?pr.txf*T0.w:0,by=pr?pr.tyf*T0.h:0;
for(const th of A)for(const s of S)for(let dy=-rg;dy<=rg;dy+=st)for(let dx=-rg;dx<=rg;dx+=st){const q=V.sc(P0,T0,th,s,bx+dx,by+dy);if(q>b.q)b={q,th,s,tx:bx+dx,ty:by+dy}}
const fx=T1.w/T0.w,fy=T1.h/T0.h;let c={q:-2};
for(let a=-6;a<=6;a+=2)for(let k=-.06;k<=.061;k+=.03)for(let dy=-6;dy<=6;dy+=2)for(let dx=-6;dx<=6;dx+=2){const th=b.th+a*D,s=b.s*(1+k),tx=b.tx*fx+dx,ty=b.ty*fy+dy,q=V.sc(P1,T1,th,s,tx,ty);if(q>c.q)c={q,th,s,tx,ty}}
return{th:c.th,s:c.s,txf:c.tx/T1.w,tyf:c.ty/T1.h,q:c.q,R:{w:R1.w,h:R1.h},T:{w:T1.w,h:T1.h}}};
V.mapN=(T,u,v)=>{const R=T.R,Q=T.T,xr=u*R.w-R.w/2,yr=v*R.h-R.h/2,c=Math.cos(T.th),s=Math.sin(T.th);return[(Q.w/2+T.txf*Q.w+T.s*(c*xr-s*yr))/Q.w,(Q.h/2+T.tyf*Q.h+T.s*(s*xr+c*yr))/Q.h]};
/* ---------- amostragem, retificação e refino local ---------- */
V.bil=(I,x,y,o)=>{x-=.5;y-=.5;const x0=Math.floor(x),y0=Math.floor(y);if(x0<0||y0<0||x0>=I.w-1||y0>=I.h-1)return false;const fx=x-x0,fy=y-y0,d=I.data,i=(y0*I.w+x0)*4,j=i+I.w*4;
for(let k=0;k<3;k++)o[k]=(d[i+k]*(1-fx)+d[i+4+k]*fx)*(1-fy)+(d[j+k]*(1-fx)+d[j+4+k]*fx)*fy;return true};
V.warp=(I,T,roi,mf,W,H)=>{const out=new Uint8ClampedArray(W*H*4),o=[0,0,0],x0=roi.x-roi.w*mf,y0=roi.y-roi.h*mf,ww=roi.w*(1+2*mf),hh=roi.h*(1+2*mf);let ins=0;
for(let j=0;j<H;j++)for(let i=0;i<W;i++){const u=x0+(i+.5)/W*ww,v=y0+(j+.5)/H*hh;let X,Y;if(T){const m=V.mapN(T,u,v);X=m[0]*I.w;Y=m[1]*I.h}else{X=u*I.w;Y=v*I.h}
const k=(j*W+i)*4;if(V.bil(I,X,Y,o)){out[k]=o[0];out[k+1]=o[1];out[k+2]=o[2];out[k+3]=255;ins++}}
return{w:W,h:H,data:out,cov:ins/(W*H)}};
V.crop=(I,x,y,w,h)=>{x=cl(x,0,Math.max(0,I.w-w));y=cl(y,0,Math.max(0,I.h-h));w=Math.min(w,I.w);h=Math.min(h,I.h);const out=new Uint8ClampedArray(w*h*4);for(let j=0;j<h;j++)for(let i=0;i<w;i++){const a=((y+j)*I.w+x+i)*4,b=(j*w+i)*4;out[b]=I.data[a];out[b+1]=I.data[a+1];out[b+2]=I.data[a+2];out[b+3]=I.data[a+3]}return{w,h,data:out,cov:I.cov}};
V.refine=(pat,tpl)=>{const g=V.gray(pat),tw=tpl.w,th=tpl.h,mx=Math.max(0,Math.round((pat.w-tw)/2)),my=Math.max(0,Math.round((pat.h-th)/2)),idx=[],tv=[];
for(let j=0;j<th;j+=2)for(let i=0;i<tw;i+=2){idx.push(j*g.w+i);tv.push(tpl.g[j*tw+i])}
const n=tv.length;let mt=0;for(const v of tv)mt+=v;mt/=n;let vt=0;for(const v of tv)vt+=(v-mt)*(v-mt);vt=Math.sqrt(vt);
if(vt/Math.sqrt(n)<5)return{dx:0,dy:0,q:null,mx,my,tw,th};
let b={q:-2,dx:0,dy:0};
for(let dy=-my;dy<=my;dy++)for(let dx=-mx;dx<=mx;dx++){const o=(my+dy)*g.w+mx+dx;let s=0,q=0,p=0;for(let a=0;a<n;a++){const v=g.g[o+idx[a]];s+=v;q+=v*v;p+=v*tv[a]}const vg=Math.sqrt(Math.max(q-s*s/n,1e-6)),r=(p-s*mt)/(vg*vt);if(r>b.q)b={q:r,dx,dy}}
return{dx:b.dx,dy:b.dy,q:b.q,mx,my,tw,th}};
/* ---------- características, cor ---------- */
V.feat=I=>{const N=6,s=new Float64Array(N*N*3),c=new Float64Array(N*N);for(let y=0;y<I.h;y++){const cy=Math.min(N-1,Math.floor(y*N/I.h));for(let x=0;x<I.w;x++){const k=(y*I.w+x)*4;if(!I.data[k+3])continue;const q=cy*N+Math.min(N-1,Math.floor(x*N/I.w));s[q*3]+=I.data[k];s[q*3+1]+=I.data[k+1];s[q*3+2]+=I.data[k+2];c[q]++}}
let m=0;const v=[];for(let q=0;q<N*N;q++)for(let k=0;k<3;k++){const a=c[q]?s[q*3+k]/c[q]:0;v.push(a);m+=a}m=m/v.length||1;return v.map(a=>+(a/m).toFixed(3))};
V.dist=(a,b)=>{let s=0;for(let i=0;i<a.length;i++)s+=Math.abs(a[i]-b[i]);return s/a.length};
V.stats=I=>{const N=12,s=new Float64Array(N*N*3),c=new Float64Array(N*N);for(let y=0;y<I.h;y++){const cy=Math.min(N-1,Math.floor(y*N/I.h));for(let x=0;x<I.w;x++){const k=(y*I.w+x)*4;if(!I.data[k+3])continue;const q=cy*N+Math.min(N-1,Math.floor(x*N/I.w));s[q*3]+=I.data[k];s[q*3+1]+=I.data[k+1];s[q*3+2]+=I.data[k+2];c[q]++}}
let r=0,g=0,b=0,n=0;const L=[];for(let q=0;q<N*N;q++)if(c[q]){const a=s[q*3]/c[q],e=s[q*3+1]/c[q],f=s[q*3+2]/c[q];r+=a;g+=e;b+=f;n++;L.push(.3*a+.59*e+.11*f)}
if(!n)return{rgb:[0,0,0],sd:0};const m=L.reduce((a,v)=>a+v,0)/n;return{rgb:[r/n|0,g/n|0,b/n|0],sd:Math.sqrt(L.reduce((a,v)=>a+(v-m)*(v-m),0)/n)}};
V.lab=(r,g,b)=>{const f=v=>{v/=255;return v>.04045?Math.pow((v+.055)/1.055,2.4):v/12.92},R=f(r),Gg=f(g),B=f(b),h=t=>t>.008856?Math.cbrt(t):7.787*t+16/116,X=h((.4124*R+.3576*Gg+.1805*B)/.95047),Y=h(.2126*R+.7152*Gg+.0722*B),Z=h((.0193*R+.1192*Gg+.9505*B)/1.08883);return[116*Y-16,500*(X-Y),200*(Y-Z)]};
V.dab=(a,b)=>{const p=V.lab(...a),q=V.lab(...b);return{dab:Math.hypot(p[1]-q[1],p[2]-q[2]),dL:Math.abs(p[0]-q[0])}};
V.cname=(r,g,b)=>{const mx=Math.max(r,g,b),mn=Math.min(r,g,b),d=mx-mn,v=mx/255,s=mx?d/mx:0;if(v<.2)return"preto";if(s<.2)return v>.8?"branco":"cinza";let h=mx==r?((g-b)/d)%6:mx==g?(b-r)/d+2:(r-g)/d+4;h=(h*60+360)%360;if(h<15||h>=345)return v<.5?"marrom":"vermelho";if(h<40)return v<.55?"marrom":"laranja";if(h<70)return"amarelo";if(h<165)return"verde";if(h<200)return"ciano";if(h<260)return"azul";if(h<300)return"roxo";return"rosa"};
V.visIdx=(d,th)=>cl(1-.3*d/(.7*th),0,1);V.colIdx=d=>cl(1-.3*d/12,0,1);
V.vis=(f,o,th)=>{const m=ss=>ss&&ss.length?Math.min(...ss.map(a=>V.dist(f,a))):9,ok=m(o.ok),no=m(o.no);let s=ok<=th*.7?"ok":ok>th?"no":"na";if(no<ok)s="no";else if(s=="ok"&&no<ok*1.5)s="na";return{ok,no,s,idx:V.visIdx(ok,th)}};
/* ---------- texto / OCR (lógica) ---------- */
V.nz=t=>(t||"").toUpperCase().replace(/[^A-Z0-9]/g,"");V.fold=t=>t.replace(/O/g,"0").replace(/[IL]/g,"1").replace(/S/g,"5").replace(/B/g,"8").replace(/Z/g,"2");
V.lev=(a,b)=>{const m=a.length,n=b.length,d=Array.from({length:m+1},(_,i)=>[i,...Array(n).fill(0)]);for(let j=1;j<=n;j++)d[0][j]=j;for(let i=1;i<=m;i++)for(let j=1;j<=n;j++)d[i][j]=Math.min(d[i-1][j]+1,d[i][j-1]+1,d[i-1][j-1]+(a[i-1]==b[j-1]?0:1));return d[m][n]};
V.txt=(exp,lido,conf)=>{const e=V.nz(exp),g=V.nz(lido),d=e&&g.includes(e)?0:V.lev(e,g),idx=e.length?Math.max(0,1-d/e.length):0;
if(d==0)return{s:"ok",d,idx:1,g};if(conf<55)return{s:"na",c:"ocr_ileg",d,idx,g};if(d<=1||V.fold(g).includes(V.fold(e)))return{s:"na",c:"ocr_inc",d,idx,g};return{s:"no",c:"ocr_div",d,idx,g}};
V.ocrSearch=async(recog,exp,start,more)=>{const ord=[start,...(more||[])].filter((a,i,r)=>r.indexOf(a)==i);let best=null;
for(const a of ord){const r=await recog(a),t=V.txt(exp,r.text,r.conf),sc=t.s=="ok"?2:1-t.d/Math.max(1,V.nz(exp).length)+r.conf/1000;const o={text:r.text,conf:r.conf,a,t,sc};if(!best||sc>best.sc)best=o;if(t.s=="ok")break}return best};
V.ocrDetect=async recog=>{const R=[];for(const a of[0,90,180,270]){const r=await recog(a);R.push({a,text:r.text,conf:r.conf})}R.sort((x,y)=>y.conf-x.conf);const b=R[0];
for(const d of[15,-15,30,-30]){const a=(b.a+d+360)%360,r=await recog(a);if(r.conf>b.conf+3)return{a,text:r.text,conf:r.conf}}return b};
/* ---------- estatística de validação, takt ---------- */
V.wilson=(k,n,z=1.96)=>{if(!n)return[0,0];const p=k/n,d=1+z*z/n,c=p+z*z/(2*n),a=z*Math.sqrt(p*(1-p)/n+z*z/(4*n*n));return[Math.max(0,(c-a)/d),Math.min(1,(c+a)/d)]};
V.conf=rows=>{let TP=0,FN=0,TN=0,FP=0;for(const r of rows){if(!r.truth)continue;const pos=r.sys!="ok";if(r.truth=="no"){pos?TP++:FN++}else{pos?FP++:TN++}}
const n=TP+FN+TN+FP,nn=TP+FN,no=TN+FP,acc=n?(TP+TN)/n:null,pe=n?((TP+FP)*(TP+FN)+(FN+TN)*(FP+TN))/(n*n):0,kappa=n&&pe<1?(acc-pe)/(1-pe):null;
return{TP,FN,TN,FP,n,nn,no,acc,far:nn?FN/nn:null,frr:no?FP/no:null,sens:nn?TP/nn:null,spec:no?TN/no:null,kappa,farCI:V.wilson(FN,nn),frrCI:V.wilson(FP,no),r3:nn&&FN==0?3/nn:null}};
V.takt=(a,t)=>{if(!a.length)return null;const s=[...a].sort((x,y)=>x-y),avg=s.reduce((x,y)=>x+y,0)/s.length,p95=s[Math.min(s.length-1,Math.ceil(.95*s.length)-1)];return{n:s.length,avg,p95,min:s[0],max:s[s.length-1],pin:t?s.filter(x=>x<=t).length/s.length:null}};
G.V=V;if(typeof module!="undefined")module.exports=V;
})(typeof window!="undefined"?window:globalThis);
