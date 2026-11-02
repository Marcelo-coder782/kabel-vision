# -*- coding: utf-8 -*-
"""Kabel Vision Station · servidor (FastAPI). Roda no PC da mesa de teste: visão, sinal 01/00 em arquivo e log, backup das receitas."""
import os, io, json, time, datetime, threading, shutil, cv2, numpy as np
from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Request
from fastapi.responses import JSONResponse, PlainTextResponse
from fastapi.staticfiles import StaticFiles
from engine import Engine

BASE = os.path.dirname(os.path.abspath(__file__)); DATA = os.path.join(BASE, "data"); WEB = os.path.join(BASE, "web"); os.makedirs(DATA, exist_ok=True)
CFG_PATH = os.path.join(DATA, "server.json"); STATE = os.path.join(DATA, "state.json"); VERSION = "4.0"
DEFAULT = {"signal_dir": os.path.join(BASE, "sinal"), "ok_value": "01", "nok_value": "00", "ext": ".txt"}
def load_cfg():
    try: return {**DEFAULT, **json.load(open(CFG_PATH, encoding="utf-8"))}
    except Exception: return dict(DEFAULT)
CFG = load_cfg(); eng = Engine(); app = FastAPI(title="Kabel Vision Station"); LK = threading.Lock()

def atomic_write(path, text):
    tmp = path + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f: f.write(text)
    for _ in range(20):                       # o leitor pode estar com o arquivo aberto no Windows
        try: os.replace(tmp, path); return
        except PermissionError: time.sleep(0.05)
    raise HTTPException(500, "não foi possível gravar o arquivo de sinal (em uso)")

@app.get("/api/health")
def health(): return {"ok": True, "version": VERSION, "refs": len(eng.refs), "signal_dir": CFG["signal_dir"]}

@app.post("/api/ref")
async def put_ref(file: UploadFile = File(...)):
    try: return {"hash": eng.put_ref(await file.read())}
    except ValueError as e: raise HTTPException(400, str(e))

@app.post("/api/analyze")
async def analyze(file: UploadFile = File(...), recipe: str = Form(...), opts: str = Form("{}")):
    rec = json.loads(recipe); op = json.loads(opts or "{}")
    if rec.get("ref_hash") not in eng.refs: return JSONResponse({"need_ref": True}, status_code=409)
    img = cv2.imdecode(np.frombuffer(await file.read(), np.uint8), cv2.IMREAD_COLOR)
    if img is None: raise HTTPException(400, "imagem inválida")
    return eng.analyze(img, rec, op)

@app.post("/api/roifeat")
async def roifeat(r: Request):
    b = await r.json()
    if b["ref_hash"] not in eng.refs: return JSONResponse({"need_ref": True}, status_code=409)
    return eng.roi_feat(b["ref_hash"], b["roi"])

@app.post("/api/readref")
async def readref(r: Request):
    b = await r.json()
    if b["ref_hash"] not in eng.refs: return JSONResponse({"need_ref": True}, status_code=409)
    return eng.read_ref(b["ref_hash"], b["roi"])

@app.get("/api/store")
def get_store():
    if not os.path.exists(STATE): return JSONResponse({"empty": True})
    return PlainTextResponse(open(STATE, encoding="utf-8").read(), media_type="application/json")

@app.put("/api/store")
async def put_store(r: Request):
    txt = (await r.body()).decode("utf-8"); json.loads(txt)
    with LK:
        if os.path.exists(STATE):
            bdir = os.path.join(DATA, "backup"); os.makedirs(bdir, exist_ok=True); old = sorted(os.listdir(bdir))
            if not old or time.time() - os.path.getmtime(os.path.join(bdir, old[-1])) > 120:      # no máximo 1 backup a cada 2 min, guarda os últimos 40
                shutil.copy(STATE, os.path.join(bdir, "state_" + datetime.datetime.now().strftime("%Y%m%d_%H%M%S") + ".json"))
                for f in sorted(os.listdir(bdir))[:-40]: os.remove(os.path.join(bdir, f))
        atomic_write(STATE, txt)
    return {"saved": True, "bytes": len(txt), "t": time.time()}

@app.get("/api/server-cfg")
def get_cfg(): return CFG
@app.put("/api/server-cfg")
async def put_cfg(r: Request):
    global CFG; b = await r.json(); CFG = {**CFG, **{k: b[k] for k in DEFAULT if k in b}}; atomic_write(CFG_PATH, json.dumps(CFG, ensure_ascii=False, indent=1)); return CFG

@app.post("/api/signal")
async def signal(r: Request):
    """value: 'ok' grava o valor de aprovado (01) · 'nok' grava o de bloqueado (00). Arquivo único por mesa + log em anexo."""
    b = await r.json(); mesa = "".join(c for c in str(b.get("mesa", "MESA01")) if c.isalnum() or c in "-_")[:40] or "MESA01"
    v = CFG["ok_value"] if b.get("value") == "ok" else CFG["nok_value"]; d = CFG["signal_dir"]; os.makedirs(d, exist_ok=True)
    ts = datetime.datetime.now().isoformat(timespec="milliseconds"); path = os.path.join(d, mesa + CFG["ext"])
    with LK:
        atomic_write(path, v + "\n")
        with open(os.path.join(d, mesa + ".log"), "a", encoding="utf-8") as f:
            f.write(";".join(str(x) for x in [ts, mesa, b.get("recipe", ""), b.get("serial", ""), b.get("mat", ""), v, b.get("q", ""), b.get("ct", ""), b.get("f", ""), "TESTE" if b.get("test") else ""]) + "\n")
    return {"written": True, "path": path, "value": v, "ts": ts}

@app.get("/api/signal/last")
def last_signal(mesa: str = "MESA01"):
    p = os.path.join(CFG["signal_dir"], mesa + CFG["ext"])
    return {"value": open(p, encoding="utf-8").read().strip() if os.path.exists(p) else None, "path": p}

if os.path.isdir(WEB): app.mount("/", StaticFiles(directory=WEB, html=True), name="web")
