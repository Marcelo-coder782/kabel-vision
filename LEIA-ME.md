# Kabel Vision Station v4

A visão (alinhamento automático, leitura de texto por IA neural, comparação) roda **no PC da mesa de teste**.
O celular/tablet é a câmera e a tela. Receitas, histórico, backups e o **arquivo de sinal 01/00** ficam nesse PC.

## 1. Instalar no PC da mesa (uma vez)
1. Python 3.10 ou superior (marque "Add Python to PATH").
2. Extraia esta pasta (ex.: `C:\KabelVision`) e execute `instalar.bat` (precisa de internet).
3. Execute `iniciar.bat`. Ele mostra os endereços, ex.: `https://192.168.0.25:8443`.
   Libere a porta **8443** no firewall do Windows quando ele perguntar.

## 2. Abrir no celular/tablet (mesma rede Wi-Fi)
Abra o endereço no Chrome e aceite o aviso de certificado (Avançado → continuar). Permita a câmera e escolha a **traseira**.
O HTTPS é necessário para a câmera. A TI pode trocar o certificado por um confiável (`data\cert.pem` e `data\key.pem`).

## 3. Primeiro uso
1. **Config** → defina o PIN. Para testar a acurácia deixe desmarcados: login, facial, QR e sinal.
2. **Receitas** → nova receita → *Imagem de referência* (golden sample) → arraste para criar as ROIs.
   - Tipos: **visual** (cor/forma/presença) · **texto OCR** (etiqueta) · **texto fixo por imagem** · **fusível** (cor pela amperagem + dígitos).
   - Em ROI de texto/fusível: *Ler da referência* (a IA lê e detecta a orientação) e confira o texto.
   - Ajuste o **nível de aceitação** (%), adicione 3+ amostras OK, clique **Testar com foto** e depois **Salvar**.
3. **Inspecionar** → *Inspeção contínua*: a peça é enquadrada sozinha sobre a referência; aprova após 3 quadros conformes seguidos.
4. Peça boa reprovada por detalhe de leitura/forma? Toque **Aceitar esta variação como correta**: o sistema aprende (com histórico e *Desfazer*).

## 4. Sinal 01/00 para o seu processo de teste
Na receita, marque **Emitir sinal ao arquivo da mesa** e informe o nome da mesa. Em Config defina a pasta do sinal.
- Arquivo único por mesa: `<pasta>\MESA01.txt` com `01` (aprovado) ou `00` (bloqueado). Gravação atômica.
- Histórico: `<pasta>\MESA01.log` → `data_hora;mesa;receita;serial;matricula;valor;qualidade;ciclo_ms;resultado;TESTE`.
- O sinal vai a `00` no início do ciclo e sempre que a peça não está conforme; vai a `01` só ao aprovar.
- Seu script espera o `01`, segue o ciclo e volta a `00`: veja `leitor_exemplo.py` (função `esperar_aprovacao`).
- Botão **Testar envio** na receita grava 01 e 00 para você conferir o arquivo.

## 5. Dados e backup
`data\state.json` (receitas, histórico, operadores) e `data\backup\` (até 40 cópias, no máx. 1 a cada 2 min).
Exportar/Importar receita em `.json` na aba Receitas.

## 6. O que foi testado e o que NÃO foi
**Testado (simulado, com a sua foto real "Amostra cat3194"):** alinhamento com giro, inclinação, desfoque e brilho; relé ausente;
fusível de cor trocada; texto trocado; imagem desfocada; outra cena; leitura de 12VDC e dos códigos dos relés; aprendizagem de
leituras aceitas; sinal 01/00 e log; salvar e backup; telas e inspeção contínua ponta a ponta contra o servidor; subida em HTTPS.
**NÃO testado:** câmera real e HTTPS no Android/tablet, voz, login facial, leitura de QR e o desempenho no seu PC de mesa.
A foto de teste era de uma tela de monitor (reflexo/moiré). Use fotos reais da peça.

## 7. Limites conhecidos
- Texto pequeno e dígitos em fusível: a leitura por OCR pode oscilar. Por isso há leituras aceitas (aprendidas de peças boas),
  tolerância por ROI e comparação de imagem. Na primeira peça boa de cada etiqueta pode ser preciso **Aceitar variação** uma vez.
- Tempo por quadro: cerca de 2 a 3 s no ambiente de teste (varia com o PC).
- O facial não tem prova de vida; use com a matrícula e consulte o jurídico/DPO.
- Acesso fora da rede da fábrica (internet): decisão da TI (VPN, servidor ou túnel). A v4 funciona na rede local.
