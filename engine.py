# -*- coding: utf-8 -*-
"""Kabel Vision Station · motor de visão (OpenCV SIFT+homografia, OCR neural RapidOCR/PaddleOCR, kNN por exemplos)."""
import cv2, numpy as np, hashlib, base64, re, threading, uuid, time
from collections import OrderedDict

def b64(img, q=80, maxd=None):
    if maxd and max(img.shape[:2]) > maxd:
        k = maxd / max(img.shape[:2]); img = cv2.resize(img, None, fx=k, fy=k, interpolation=cv2.INTER_AREA)
    ok, buf = cv2.imencode(".jpg", img, [cv2.IMWRITE_JPEG_QUALITY, q])
    return "data:image/jpeg;base64," + base64.b64encode(buf.tobytes()).decode()

def nz(t): return re.sub(r"[^A-Z0-9]", "", (t or "").upper())
def fold(t): return t.replace("O", "0").replace("I", "1").replace("L", "1").replace("S", "5").replace("B", "8").replace("Z", "2")
def lev(a, b):
    m, n = len(a), len(b); d = list(range(n + 1))
    for i in range(1, m + 1):
        p, d[0] = d[0], i
        for j in range(1, n + 1):
            t = d[j]; d[j] = min(d[j] + 1, d[j - 1] + 1, p + (a[i - 1] != b[j - 1])); p = t
    return d[n]
def f1(t): return t.replace("O", "0").replace("I", "1").replace("L", "1")
def same(e, g): return bool(e) and (e in g or f1(e) in f1(g))
def body_color(p):
    hsv = cv2.cvtColor(p, cv2.COLOR_BGR2HSV); m = (hsv[..., 1] > 70) & (hsv[..., 2] > 70)
    if m.sum() < 30: return np.median(p.reshape(-1, 3), axis=0)[::-1]
    return np.median(p[m], axis=0)[::-1]
f2 = lambda v, n=2: f"{v:.{n}f}".replace(".", ",")
cl = lambda x, a=0.0, b=1.0: max(a, min(b, x))

NAMES = [(0, "vermelho"), (15, "laranja"), (40, "amarelo"), (70, "verde"), (165, "ciano"), (200, "azul"), (260, "roxo"), (300, "rosa"), (345, "vermelho")]
def cname(rgb):
    r, g, b = [float(x) for x in rgb]; mx, mn = max(r, g, b), min(r, g, b); d = mx - mn; v = mx / 255; s = d / mx if mx else 0
    if v < .2: return "preto"
    if s < .2: return "branco" if v > .8 else "cinza"
    if mx == r: h = ((g - b) / d) % 6
    elif mx == g: h = (b - r) / d + 2
    else: h = (r - g) / d + 4
    h = (h * 60 + 360) % 360
    if h < 15 or h >= 345: return "marrom" if v < .5 else "vermelho"
    if h < 40: return "marrom" if v < .55 else "laranja"
    for lim, nm in [(70, "amarelo"), (165, "verde"), (200, "ciano"), (260, "azul"), (300, "roxo"), (345, "rosa")]:
        if h < lim: return nm
    return "rosa"
FUSE_COR = {"5": "marrom", "7.5": "marrom", "10": "vermelho", "15": "azul", "20": "amarelo", "25": "branco", "30": "verde", "40": "laranja"}  # código de cores de fusíveis lâmina

CAUSA = {"cor": "Desvio cromático", "abs": "Ausência / perda de detalhe", "nok": "Similar a NC treinada", "dm": "Divergência morfológica", "ink": "Faixa de incerteza",
         "ocr_div": "Texto divergente", "ocr_inc": "Leitura inconclusiva", "ocr_ileg": "Texto ilegível", "ocr_na": "OCR indisponível", "txi": "Texto/caractere diferente da referência",
         "fus_cor": "Cor do fusível incompatível com o amperagem", "nl": "Peça não localizada", "bl": "Imagem desfocada", "fc": "ROI fora do campo"}

class Engine:
    def __init__(self):
        self.refs = {}; self.sift = cv2.SIFT_create(nfeatures=5000); self.bf = cv2.BFMatcher(cv2.NORM_L2)
        self._ocr = None; self.lock = threading.Lock(); self.cache = OrderedDict(); self.tcache = {}

    # ---------- referência ----------
    def put_ref(self, data: bytes) -> str:
        h = hashlib.sha256(data).hexdigest()[:16]
        if h in self.refs: return h
        img = cv2.imdecode(np.frombuffer(data, np.uint8), cv2.IMREAD_COLOR)
        if img is None: raise ValueError("imagem inválida")
        g = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY); s = min(1.0, 1400 / max(g.shape)); gs = cv2.resize(g, None, fx=s, fy=s, interpolation=cv2.INTER_AREA) if s < 1 else g
        gs = cv2.createCLAHE(2.0, (8, 8)).apply(gs); kp, de = self.sift.detectAndCompute(gs, None)
        self.refs[h] = dict(img=img, s=s, kp=np.float32([k.pt for k in kp]) if kp else np.zeros((0, 2), np.float32), de=de, sh=self.sharp(g))
        return h
    @staticmethod
    def sharp(g):
        g = cv2.resize(g, None, fx=200 / max(g.shape), fy=200 / max(g.shape), interpolation=cv2.INTER_AREA) if max(g.shape) > 200 else g
        return float(cv2.Laplacian(g, cv2.CV_64F).var())

    # ---------- alinhamento por pontos (homografia ref -> teste, em pixels de resolução cheia) ----------
    def align(self, ref, img):
        g = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY); s = min(1.0, 1400 / max(g.shape)); gs = cv2.resize(g, None, fx=s, fy=s, interpolation=cv2.INTER_AREA) if s < 1 else g
        gs = cv2.createCLAHE(2.0, (8, 8)).apply(gs); kp, de = self.sift.detectAndCompute(gs, None)
        if de is None or ref["de"] is None or len(kp) < 12 or len(ref["kp"]) < 12: return None, 0, 0
        m = self.bf.knnMatch(ref["de"], de, k=2); good = [a for a, b in (x for x in m if len(x) == 2) if a.distance < 0.75 * b.distance]
        if len(good) < 12: return None, len(good), 0
        src = np.float32([ref["kp"][g_.queryIdx] for g_ in good]).reshape(-1, 1, 2); dst = np.float32([kp[g_.trainIdx].pt for g_ in good]).reshape(-1, 1, 2)
        H, mask = cv2.findHomography(src, dst, cv2.RANSAC, 5.0)
        if H is None: return None, len(good), 0
        inl = int(mask.sum()); Sr = np.diag([ref["s"], ref["s"], 1.0]); St = np.diag([s, s, 1.0])
        return np.linalg.inv(St) @ H @ Sr, inl, len(good)

    # ---------- ROI retificada ----------
    @staticmethod
    def rect(src, H, x0, y0, w, h, k, mf):
        A = np.array([[1 / k, 0, x0 - w * mf], [0, 1 / k, y0 - h * mf], [0, 0, 1]], np.float64)
        M = (H @ A) if H is not None else A
        pw, ph = max(8, int(round(w * (1 + 2 * mf) * k))), max(8, int(round(h * (1 + 2 * mf) * k)))
        return cv2.warpPerspective(src, M, (pw, ph), flags=cv2.INTER_CUBIC | cv2.WARP_INVERSE_MAP, borderValue=(0, 0, 0)), pw, ph

    @staticmethod
    def feat(patch):
        v = cv2.resize(patch, (6, 6), interpolation=cv2.INTER_AREA).astype(np.float64)[..., ::-1].reshape(-1)  # RGB
        m = v.mean() or 1.0; return [round(float(x / m), 3) for x in v]
    @staticmethod
    def dist(a, b): return float(np.mean(np.abs(np.asarray(a) - np.asarray(b))))
    @staticmethod
    def stats(patch):
        small = cv2.resize(patch, (12, 12), interpolation=cv2.INTER_AREA); rgb = small[..., ::-1].reshape(-1, 3).mean(0)
        lum = small.astype(np.float64)[..., ::-1].reshape(-1, 3) @ np.array([.3, .59, .11]); return rgb, float(lum.std())
    @staticmethod
    def dab(a, b):
        la = cv2.cvtColor(np.uint8([[a[::-1]]]), cv2.COLOR_BGR2LAB)[0, 0].astype(float); lb = cv2.cvtColor(np.uint8([[b[::-1]]]), cv2.COLOR_BGR2LAB)[0, 0].astype(float)
        return float(np.hypot(la[1] - lb[1], la[2] - lb[2])), float(abs(la[0] - lb[0]))

    # ---------- OCR neural ----------
    def ocr(self):
        if self._ocr is None:
            from rapidocr_onnxruntime import RapidOCR; self._ocr = RapidOCR()
        return self._ocr
    def read_text(self, patch, rots=(0,), expected=None, variants=3, lines=1, alts=()):
        """lê a ROI retificada; para ao achar o texto esperado. Devolve (texto, confiança 0-100, ângulo)."""
        h, w = patch.shape[:2]; k = min(max(1.0, 80 / h), 960 / w); base = cv2.resize(patch, None, fx=k, fy=k, interpolation=cv2.INTER_CUBIC) if abs(k - 1) > .05 else patch
        e = nz(expected) if expected else None; best = ("", 0.0, rots[0], 99); AC = [x for x in [e] + [nz(a) for a in alts] if x]
        ok_ = lambda g: any(same(x, g) for x in AC)
        def prep(im, v):
            if v == 0: return im
            g = cv2.cvtColor(im, cv2.COLOR_BGR2GRAY); c = cv2.createCLAHE(3.0, (4, 4)).apply(g)
            return cv2.cvtColor(c if v == 1 else 255 - c, cv2.COLOR_GRAY2BGR)
        def run(x, det):
            with self.lock:
                if det: r, _ = self.ocr()(x); r = sorted(r or [], key=lambda q: (round(min(p[1] for p in q[0]) / 25), min(p[0] for p in q[0]))); L = [(q[1], float(q[2])) for q in r]
                else: r, _ = self.ocr()(x, use_det=False, use_cls=False, use_rec=True); L = [(q[0], float(q[1])) for q in (r or [])]
            return (" ".join(t for t, _ in L), 100 * float(np.mean([c for _, c in L]))) if L else ("", 0.0)
        if e is None:   # leitura livre (ao criar a receita): testa as orientações só com reconhecimento e refina o melhor ângulo
            cand = []
            for a in rots:
                im = base if a == 0 else cv2.rotate(base, {90: cv2.ROTATE_90_CLOCKWISE, 180: cv2.ROTATE_180, 270: cv2.ROTATE_90_COUNTERCLOCKWISE}[a])
                txt, conf = run(cv2.copyMakeBorder(im, 16, 16, 16, 16, cv2.BORDER_REPLICATE), False); cand.append((conf, txt, a))
            conf, txt, a = max(cand)
            if conf < 90:
                im = base if a == 0 else cv2.rotate(base, {90: cv2.ROTATE_90_CLOCKWISE, 180: cv2.ROTATE_180, 270: cv2.ROTATE_90_COUNTERCLOCKWISE}[a])
                for v in range(1, variants):
                    t2, c2 = run(cv2.copyMakeBorder(prep(im, v), 16, 16, 16, 16, cv2.BORDER_REPLICATE), False)
                    if c2 > conf: conf, txt = c2, t2
                t2, c2 = run(cv2.copyMakeBorder(im, 16, 16, 16, 16, cv2.BORDER_REPLICATE), True)
                if c2 > conf: conf, txt = c2, t2
            return txt, conf, a
        seq = [(rots[0], False, v) for v in range(variants)] + [(rots[0], True, 0)]
        for a in rots[1:]: seq += [(a, False, 0), (a, True, 0)]
        for n, (a, det, v) in enumerate(seq):
            im = base if a == 0 else cv2.rotate(base, {90: cv2.ROTATE_90_CLOCKWISE, 180: cv2.ROTATE_180, 270: cv2.ROTATE_90_COUNTERCLOCKWISE}[a])
            txt, conf = run(cv2.copyMakeBorder(prep(im, v), 16, 16, 16, 16, cv2.BORDER_REPLICATE), det)
            if txt:
                g = nz(txt); d = 0 if ok_(g) else min(lev(x, g) for x in AC)
                if d == 0: return txt, conf, a
                if (d, -conf) < (best[3], -best[1]): best = (txt, conf, a, d)
                if d <= 1 and conf >= 85: break                       # quase certo: não gasta mais tempo
            if n == variants and best[1] >= 60: break                  # orientação certa e texto legível: não procurar outras
        return best[0], best[1], best[2]

    # ---------- máscara de tinta e comparação de imagem (texto fixo / dígitos) ----------
    @staticmethod
    def ink(patch):
        g = cv2.cvtColor(patch, cv2.COLOR_BGR2GRAY); g = cv2.createCLAHE(2.0, (4, 4)).apply(g); g = cv2.GaussianBlur(g, (3, 3), 0)
        m = cv2.adaptiveThreshold(g, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, 21, 6)
        m2 = cv2.adaptiveThreshold(g, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY_INV, 21, 6)
        return m if (m > 0).mean() < (m2 > 0).mean() else m2            # tinta = o lado minoritário
    def overlap(self, a, b):
        ma, mb = self.ink(a) > 0, self.ink(b) > 0; ker = np.ones((5, 5), np.uint8)
        da, db = cv2.dilate(ma.astype(np.uint8), ker) > 0, cv2.dilate(mb.astype(np.uint8), ker) > 0
        if ma.sum() < 30 or mb.sum() < 30: return 0.0
        return float(min((ma & db).sum() / ma.sum(), (mb & da).sum() / mb.sum()))

    # ---------- leitura da ROI da referência (ao criar a receita) ----------
    def read_ref(self, rh, roi):
        ref = self.refs[rh]; img = ref["img"]; H_, W_ = img.shape[:2]
        x0, y0, w, h = roi["x"] * W_, roi["y"] * H_, roi["w"] * W_, roi["h"] * H_; k = max(1.0, 120 / h)
        p, _, _ = self.rect(img, None, x0, y0, w, h, k, 0.0)
        txt, conf, ang = self.read_text(p, rots=(0, 90, 270, 180), variants=1)
        if conf < 85: txt, conf, ang = max([(txt, conf, ang), self.read_text(p, rots=(ang,), variants=3)], key=lambda r: r[1])
        rgb, sd = self.stats(p)
        return dict(text=txt.strip(), conf=round(conf), rot=ang, cor=cname(rgb), rgb=[int(x) for x in rgb])

    def roi_feat(self, rh, roi):
        ref = self.refs[rh]; img = ref["img"]; H_, W_ = img.shape[:2]; x0, y0, w, h = roi["x"] * W_, roi["y"] * H_, roi["w"] * W_, roi["h"] * H_
        k = min(1.0, 160 / max(w, h)); p, _, _ = self.rect(img, None, x0, y0, w, h, k, 0.0)
        return dict(feat=self.feat(p), thumb=b64(p, 60, 64))

    # ---------- mensagens (técnicas, ação, voz) ----------
    def msg(self, R, ctx):
        c = R.get("cause", ""); m = R.get("m", {}); n = R["n"]; p = lambda x: f"{round(100 * x)}%"; t = "Conforme à referência"; a = v = ""
        if c == "nl": t = f"Referência não localizada na imagem: pontos coincidentes (inliers) = {ctx['inl']}, mínimo {ctx['min_inl']}"; a = "Enquadrar a peça e a jiga como na referência, com boa iluminação"; v = "Peça não localizada. Enquadre a peça como na referência."
        elif c == "bl": t = f"Imagem desfocada: nitidez relativa = {f2(ctx['bl'])} (mínimo 0,40 da referência). Avaliação suspensa"; a = "Estabilizar o aparelho, focar e evitar movimento"; v = "Imagem desfocada. Estabilize o aparelho e foque."
        elif c == "fc": t = f"ROI fora do campo de visão (cobertura {p(m.get('cov', 0))})"; a = "Reenquadrar para incluir toda a região"; v = f"{n}: região fora do campo. Reenquadre."
        elif c == "cor": t = f"Desvio cromático: ΔE*ab = {f2(m['dab'], 1)} (limite 12,0) · referência {m['cn'][0]} · encontrado {m['cn'][1]} · índice de cor {p(R['chk']['cor'])}"; a = "Substituir pelo componente com a cor especificada"; v = f"{n}: cor diferente. Esperado {m['cn'][0]}, encontrado {m['cn'][1]}. Substituir pelo componente da cor especificada."
        elif c == "abs": t = f"Perda de detalhe estrutural: σL = {f2(m['sdB'], 1)} contra {f2(m['sdA'], 1)} na referência. Possível ausência do componente"; a = "Montar o componente faltante"; v = f"{n}: componente possivelmente ausente. Montar o componente faltante."
        elif c == "nok": t = f"Similaridade com a classe NOK treinada: d_NOK = {f2(m['no'], 3)} < d_OK = {f2(m['ok'], 3)} · índice visual {p(R['chk']['vis'])}"; a = "Corrigir a montagem conforme a referência"; v = f"{n}: parecido com defeito já ensinado. Corrigir a montagem conforme a referência."
        elif c == "dm": t = f"Divergência morfológica: d_OK = {f2(m['ok'], 3)} · índice visual {p(R['chk']['vis'])} (mínimo {p(ctx['accept'])})"; a = "Conferir tipo, posição e sentido do componente"; v = f"{n}: aparência diferente da referência. Conferir tipo, posição e sentido."
        elif c == "ink": t = f"Faixa de incerteza: índice visual {p(R['chk']['vis'])} (conforme ≥ {p(ctx['accept'])}). Decisão não conclusiva"; a = "Refazer a captura com boa iluminação; se persistir, acionar o supervisor"; v = f"{n}: avaliação incerta. Refaça a captura com boa iluminação."
        elif c == "ocr_div": t = f"Divergência de texto (OCR): esperado “{m['tx']['exp']}”, lido “{m['tx']['lido']}” · distância de Levenshtein = {m['tx']['d']} · confiança {m['tx']['conf']}%"; a = "Conferir se a etiqueta ou identificação corresponde ao especificado"; v = f"{n}: texto diferente. Esperado {m['tx']['exp']}, lido {m['tx']['lido']}."
        elif c == "ocr_inc": t = f"Leitura inconclusiva: esperado “{m['tx']['exp']}”, lido “{m['tx']['lido']}” · distância = {m['tx']['d']} · confiança {m['tx']['conf']}%"; a = "Aproximar, estabilizar e repetir; persistindo, conferir visualmente"; v = f"{n}: leitura do texto inconclusiva. Aproxime a câmera e repita."
        elif c == "ocr_ileg": t = f"Texto ilegível: confiança {m['tx']['conf']}% · lido “{m['tx']['lido'] or '—'}” · possível desfoque, reflexo ou pouca luz"; a = "Melhorar iluminação e foco, evitar reflexo e enquadrar a etiqueta"; v = f"{n}: texto ilegível. Melhore a iluminação, evite reflexo e enquadre a etiqueta."
        elif c == "txi": t = f"Texto/caractere diferente da referência: coincidência da tinta = {p(m['ov'])} (mínimo {p(ctx['accept'])})"; a = "Conferir o texto, os dígitos e o sentido da peça"; v = f"{n}: texto diferente da referência. Conferir os caracteres."
        elif c == "fus_cor": t = f"Cor do fusível incompatível com a amperagem {m['exp']} A: esperado {m['cor_exp']}, encontrado {m['cn'][1]}"; a = "Trocar pelo fusível da amperagem correta"; v = f"{n}: fusível com cor incompatível. Esperado {m['cor_exp']}, encontrado {m['cn'][1]}. Trocar pelo fusível correto."
        elif c == "ocr_na": t = "Motor OCR indisponível no servidor"; a = "Verificar a instalação do servidor"; v = f"{n}: leitura de texto indisponível."
        return dict(t=t, a=a, v=v)

    # ---------- análise ----------
    def analyze(self, img, rec, opts):
        t0 = time.time(); rh = rec["ref_hash"]; ref = self.refs[rh]; accept = cl(rec.get("accept", 70) / 100, .3, .98); H_, W_ = ref["img"].shape[:2]; th_, tw_ = img.shape[:2]
        H, inl, ng = self.align(ref, img); min_inl = 18
        g = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY); bl = self.sharp(g) / (ref["sh"] or 1)
        gl = "nl" if (H is None or inl < min_inl) else ("bl" if bl < .4 else "")
        ctx = dict(inl=inl, min_inl=min_inl, bl=bl, accept=accept); res = []
        order = [i for i, o in enumerate(rec["rois"]) if o.get("tp") not in ("ocr",)] + [i for i, o in enumerate(rec["rois"]) if o.get("tp") == "ocr"]
        out = {}
        for i in order:
            out[i] = self.roi(img, ref, H, rec, i, gl, accept, opts, out, W_, H_, tw_, th_)
        res = [out[i] for i in range(len(rec["rois"]))]
        for R in res: R["msg"] = self.msg(R, ctx)
        ev = [r["idx"] for r in res if r["idx"] is not None]
        f = "no" if any(r["s"] == "no" for r in res) else "na" if any(r["s"] == "na" for r in res) else "ok"
        f = "na" if gl else f
        aid = uuid.uuid4().hex[:12]
        self.cache[aid] = {i: r.pop("_patch", None) for i, r in enumerate(res)}
        while len(self.cache) > 40: self.cache.popitem(last=False)
        for R in res: R.pop("_patch", None); R.pop("_ref", None)
        return dict(id=aid, f=f, gl=gl, q=None if (gl or not ev) else int(round(100 * min(ev))), bl=round(bl, 3), align=dict(inliers=inl, matches=ng, ok=bool(H is not None and inl >= min_inl)),
                    ms=int((time.time() - t0) * 1000), accept=int(round(accept * 100)), res=res)

    def roi(self, img, ref, H, rec, i, gl, accept, opts, out, W_, H_, tw_, th_):
        o = rec["rois"][i]; tp = o.get("tp", "vis"); x0, y0, w, h = o["x"] * W_, o["y"] * H_, o["w"] * W_, o["h"] * H_
        R = dict(i=i, n=o["n"], tp=tp, s="na", idx=None, cause="", chk={}, m={}, quad=None)
        if gl: R["cause"] = gl; return R
        txt = tp in ("ocr", "txi", "fus"); k = min(3.0, max(1.0, 110 / h)) if txt else min(1.0, 160 / max(w, h)); mf = .12
        pat, pw, ph = self.rect(img, H, x0, y0, w, h, k, mf)
        cov = float((cv2.warpPerspective(np.full(img.shape[:2], 255, np.uint8), H @ np.array([[1 / k, 0, x0 - w * mf], [0, 1 / k, y0 - h * mf], [0, 0, 1]]), (pw, ph), flags=cv2.INTER_NEAREST | cv2.WARP_INVERSE_MAP) > 0).mean())
        R["m"]["cov"] = cov
        if cov < .6: R["cause"] = "fc"; return R
        tpl_full, _, _ = self.rect(ref["img"], None, x0, y0, w, h, k, mf)
        tw, th = int(round(w * k)), int(round(h * k)); mx, my = (pw - tw) // 2, (ph - th) // 2; tpl = tpl_full[my:my + th, mx:mx + tw]; dx = dy = 0
        if tpl.size and tpl.std() > 6:
            r = cv2.matchTemplate(cv2.cvtColor(pat, cv2.COLOR_BGR2GRAY), cv2.cvtColor(tpl, cv2.COLOR_BGR2GRAY), cv2.TM_CCOEFF_NORMED); _, mv, _, ml = cv2.minMaxLoc(r); dx, dy = ml[0] - mx, ml[1] - my
        ali = pat[max(0, my + dy):max(0, my + dy) + th, max(0, mx + dx):max(0, mx + dx) + tw]
        if ali.shape[0] < 4 or ali.shape[1] < 4: R["cause"] = "fc"; return R
        sx, sy = dx / k, dy / k; cs = np.float64([[x0 + sx, y0 + sy], [x0 + w + sx, y0 + sy], [x0 + w + sx, y0 + h + sy], [x0 + sx, y0 + h + sy]]).reshape(-1, 1, 2)
        q = cv2.perspectiveTransform(cs, H).reshape(-1, 2); R["quad"] = [[round(float(a / tw_), 4), round(float(b / th_), 4)] for a, b in q]
        R["_patch"] = ali; rgbA, sdA = self.stats(tpl); rgbB, sdB = self.stats(ali); dab, dL = self.dab(rgbA, rgbB); cnA, cnB = cname(rgbA), cname(rgbB)
        R["m"].update(dab=dab, dL=dL, cn=[cnA, cnB], sdA=sdA, sdB=sdB)
        if tp == "vis":
            ft = self.feat(ali); R["feat"] = ft; R["thumb"] = b64(ali, 60, 64)
            ds = lambda S: min((self.dist(ft, a) for a in S), default=9.0)
            dOK, dNO = ds(o.get("ok", [])), ds(o.get("no", [])); idx = cl(1 - dOK / .25); R["m"].update(ok=dOK, no=dNO); R["chk"]["vis"] = idx; R["chk"]["cor"] = cl(1 - .3 * dab / 12)
            col_bad = cnA != cnB and (dab > 12 or dL > 25); lost = sdA > 8 and sdB < sdA * .55
            s = "ok" if idx >= accept else ("no" if idx < accept - .12 else "na"); c = ""
            if dNO < dOK: s = "no"
            elif s == "ok" and dNO < dOK * 1.5: s = "na"
            if lost and (col_bad or s == "no"): s, c = "no", "abs"
            elif col_bad: s, c = "no", "cor"
            elif s == "no": c = "nok" if dNO < dOK else "dm"
            elif s == "na": c = "ink"
            R.update(s=s, cause=c, idx=min(idx, R["chk"]["cor"]))
        elif tp == "ocr":
            exp = o.get("tx", ""); rots = (o.get("rot", 0),) if opts.get("live") else (o.get("rot", 0), 0, 90, 180, 270)
            if opts.get("noOcr") or (opts.get("live") and any(out[j]["s"] == "no" for j in out)): R["cause"] = "ocr_skip"; R["s"] = "na"; return R
            try: t, conf, ang = self.read_text(ali, rots=tuple(dict.fromkeys(rots)), expected=exp, variants=2 if opts.get("live") else 3, alts=o.get("alt", []))
            except Exception: R["cause"] = "ocr_na"; return R
            e, g = nz(exp), nz(t); AC = [x for x in [e] + [nz(a) for a in o.get('alt', [])] if x]; d = 0 if any(same(x, g) for x in AC) else min([lev(x, g) for x in AC] or [len(g)]); idx = max(0.0, 1 - d / max(1, len(e)))
            R["m"]["tx"] = dict(exp=exp, lido=g, d=d, conf=int(conf), a=ang); R["chk"]["txt"] = idx; R["idx"] = idx
            tol = int(o.get("tol", 0) or 0)
            if d == 0: R["s"] = "ok"; R["idx"] = 1.0
            elif tol and d <= tol and conf >= 80: R["s"] = "ok"; R["idx"] = max(idx, .75); R["m"]["tx"]["tol"] = True
            elif conf < 55: R.update(s="na", cause="ocr_ileg")
            elif d <= 1 or fold(g).find(fold(e)) >= 0: R.update(s="na", cause="ocr_inc")
            else: R.update(s="no", cause="ocr_div")
        else:  # txi = texto fixo por comparação de imagem · fus = fusível (cor ISO + dígitos por comparação)
            ov = self.overlap(ali, tpl); R["m"]["ov"] = ov; idx = cl((ov - .55) / .40); R["chk"]["txt"] = idx; s, c = ("ok", "") if idx >= accept else (("no", "txi") if idx < accept - .12 else ("na", "ink"))
            if tp == "fus":
                exp = str(o.get("tx", "")); ce = FUSE_COR.get(exp.replace(",", "."), ""); bA, bB = body_color(tpl), body_color(ali); dfa, dfl = self.dab(bA, bB); cA, cB = cname(bA), cname(bB)
                R["m"].update(exp=exp, cor_exp=ce, cn=[cA, cB], dab=dfa); R["chk"]["cor"] = cl(1 - .3 * dfa / 12); okc = {("azul", "ciano"), ("ciano", "azul"), ("verde", "ciano"), ("ciano", "verde")}
                if ce and cB != ce and (ce, cB) not in okc: s, c = "no", "fus_cor"
                elif cA != cB and (dfa > 12 or dfl > 25) and (cA, cB) not in okc: s, c = "no", "cor"
            R.update(s=s, cause=c, idx=min([idx] + ([R["chk"]["cor"]] if "cor" in R["chk"] else [])))
        if opts.get("want_patch") or R["s"] != "ok":
            R["fo"] = b64(ali, 70, 160); R["ex"] = b64(tpl, 70, 160)
        return R

    def learn(self, aid, roi_idx):
        p = (self.cache.get(aid) or {}).get(roi_idx)
        if p is None: return None
        k = min(1.0, 160 / max(p.shape[:2])); pp = cv2.resize(p, None, fx=k, fy=k, interpolation=cv2.INTER_AREA) if k < 1 else p
        return dict(feat=self.feat(pp), thumb=b64(pp, 60, 64))
