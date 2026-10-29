# Kabel Vision v3

## Como atualizar no GitHub
No repositório `kabel-vision`: **Add file → Upload files** e envie **todos** os arquivos desta pasta
(`index.html`, `style.css`, `vision.js`, `dev.js`, `app.js`, `sw.js`, `manifest.webmanifest`, `icon-192.png`, `icon-512.png`).
Os arquivos com o mesmo nome substituem os antigos. **Commit changes**, espere 1–2 min e abra o app (feche e abra duas vezes se preciso).

## Importante
- **Recrie os modelos de teste.** O alinhamento e as características mudaram; modelos antigos podem se comportar diferente.
- Os dados ficam só no aparelho (inclusive vetores faciais, sem foto).

## Primeiros passos
1. **Config** → defina o PIN do administrador. Para testar a acurácia, deixe desmarcados: login, facial, QR e sinal.
2. **Referências** → novo modelo → imagem de referência → arraste para criar as ROIs → (etiquetas: tipo OCR → *Ler da referência*) → adicione 3+ amostras OK → *Congelar referência*.
3. **Inspecionar** → *Inspeção contínua*. Informe o resultado real (OK/NOK) de cada peça para alimentar a **validação estatística** no Relatório.

## O que há de novo
Alinhamento com rotação e escala · ROI retificada · OCR com orientação detectada · estados Conforme / Não conforme / Não avaliável · diagnóstico técnico por ROI com referência ao lado · índice de conformidade (%) · voz do diagnóstico · relé Bluetooth com ID único · login por matrícula + facial · QR do WMS · takt time · relatório com Pareto, por operador/modelo e matriz de confusão (falso-aprovado, IC 95%).

## Limites conhecidos
- OCR e reconhecimento facial baixam seus modelos da internet **na primeira vez** (depois ficam em cache).
- O facial não tem prova de vida (foto de foto pode enganar): use junto com a matrícula e consulte o jurídico/DPO.
- Relé por **Wi-Fi não está nesta versão**: o navegador bloqueia chamada HTTP a partir de página HTTPS. Bluetooth sim.
- Rotação suportada em qualquer ângulo; escala de 0,7× a 1,4×; perspectiva forte (inclinação da câmera) reduz a confiança.
