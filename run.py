# -*- coding: utf-8 -*-
"""Inicia o Kabel Vision Station em HTTPS (necessário para a câmera do celular/tablet). Uso: python run.py [porta]"""
import os, sys, socket, ipaddress, datetime
BASE = os.path.dirname(os.path.abspath(__file__)); CERT = os.path.join(BASE, "data", "cert.pem"); KEY = os.path.join(BASE, "data", "key.pem")
def ips():
    s = set()
    try:
        for i in socket.getaddrinfo(socket.gethostname(), None):
            if i[0] == socket.AF_INET: s.add(i[4][0])
    except Exception: pass
    try:
        t = socket.socket(socket.AF_INET, socket.SOCK_DGRAM); t.connect(("10.255.255.255", 1)); s.add(t.getsockname()[0]); t.close()
    except Exception: pass
    return sorted(x for x in s if not x.startswith("127."))
def ensure_cert():
    if os.path.exists(CERT) and os.path.exists(KEY): return
    from cryptography import x509; from cryptography.x509.oid import NameOID; from cryptography.hazmat.primitives import hashes, serialization; from cryptography.hazmat.primitives.asymmetric import rsa
    os.makedirs(os.path.dirname(CERT), exist_ok=True); k = rsa.generate_private_key(public_exponent=65537, key_size=2048); n = x509.Name([x509.NameAttribute(NameOID.COMMON_NAME, "Kabel Vision Station")])
    san = [x509.DNSName("localhost"), x509.DNSName(socket.gethostname())] + [x509.IPAddress(ipaddress.ip_address(i)) for i in ips() + ["127.0.0.1"]]
    c = (x509.CertificateBuilder().subject_name(n).issuer_name(n).public_key(k.public_key()).serial_number(x509.random_serial_number()).not_valid_before(datetime.datetime.utcnow() - datetime.timedelta(days=1))
         .not_valid_after(datetime.datetime.utcnow() + datetime.timedelta(days=3650)).add_extension(x509.SubjectAlternativeName(san), False).sign(k, hashes.SHA256()))
    open(KEY, "wb").write(k.private_bytes(serialization.Encoding.PEM, serialization.PrivateFormat.TraditionalOpenSSL, serialization.NoEncryption())); open(CERT, "wb").write(c.public_bytes(serialization.Encoding.PEM))
if __name__ == "__main__":
    import uvicorn; port = int(sys.argv[1]) if len(sys.argv) > 1 else 8443; ensure_cert()
    print("\n  Kabel Vision Station em execução. No celular/tablet (mesma rede), abra:"); [print(f"    https://{i}:{port}") for i in ips()]
    print("  (aceite o aviso de certificado na primeira vez)  ·  Ctrl+C para parar\n")
    uvicorn.run("server:app", host="0.0.0.0", port=port, ssl_keyfile=KEY, ssl_certfile=CERT, app_dir=BASE)
