# -*- coding: utf-8 -*-
"""Exemplo do SEU script de teste (pokayoke): espera o 01 do Kabel Vision e só então segue o ciclo.
Cole a função esperar_aprovacao() no seu processo, chame no ponto 'faça a inspeção' e continue o teste elétrico quando retornar True."""
import os, time
ARQUIVO = r"C:\KabelVision\sinal\MESA01.txt"      # = pasta definida em Config + nome da mesa + extensão

def esperar_aprovacao(timeout_s=300, arquivo=ARQUIVO):
    """Zera o sinal, espera '01' (aprovado). Retorna True ao receber 01; False se estourar o tempo."""
    with open(arquivo, "w") as f: f.write("00\n")                 # reinicia o ciclo
    t0 = time.time()
    while time.time() - t0 < timeout_s:
        try:
            if open(arquivo).read().strip() == "01":
                with open(arquivo, "w") as f: f.write("00\n")      # consome o sinal (fecha o ciclo)
                return True
        except OSError: pass                                        # arquivo em gravação: tenta de novo
        time.sleep(0.1)
    return False

if __name__ == "__main__":
    print("Aguardando aprovação do Kabel Vision...")
    print("APROVADO: seguir para o teste elétrico" if esperar_aprovacao() else "TEMPO ESGOTADO: peça não aprovada")
