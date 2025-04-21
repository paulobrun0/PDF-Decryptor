document.addEventListener('DOMContentLoaded', () => {
    // --- DECLARAÇÕES PRIMEIRO ---
    // Mova todas as buscas de elementos DOM para cá
    const filesInput = document.getElementById('pdfFiles');
    const passwordInput = document.getElementById('pdfPassword');
    const unlockButton = document.getElementById('unlockButton');
    const statusDiv = document.getElementById('status');
    const statusParagraph = statusDiv ? statusDiv.querySelector('p') : null; // Adiciona verificação se statusDiv existe
    const logList = document.getElementById('logMessages');
    const progressBar = document.getElementById('progressBar');
    // --- FIM DAS DECLARAÇÕES ---

    // --- Funções Auxiliares (Definição pode vir antes ou depois, mas a chamada deve ser segura) ---
    function setStatus(message, isError = false) {
        if (!statusParagraph || !statusDiv || !logList) {
             console.error("Erro: Elementos de status não encontrados no DOM.");
             alert("Erro de interface: " + message); // Fallback
             return;
        }
        statusParagraph.textContent = message;
        statusDiv.className = isError ? 'error' : 'info';
        logList.innerHTML = ''; // Limpa logs anteriores ao iniciar novo processo
        console.log(`Status (${isError ? 'error' : 'info'}): ${message}`);
    }

    function addLog(message, type = 'info') {
        if (!logList) return; // Verifica se logList existe
        const li = document.createElement('li');
        li.textContent = message;
        li.className = `log-${type}`;
        logList.appendChild(li);
        // Scroll suave pode causar erro se chamado muito rapidamente antes do elemento estar visível.
        // Considerar um pequeno timeout ou uma abordagem mais robusta se necessário.
        try {
           li.scrollIntoView({ behavior: 'smooth', block: 'end' });
        } catch(e) {
            console.warn("Não foi possível rolar para o log:", e);
            logList.scrollTop = logList.scrollHeight; // Fallback de rolagem
        }
        console.log(`Log (${type}): ${message}`);
    }

    function showProgress(show = true) {
        if (!progressBar) return;
        progressBar.style.display = show ? 'block' : 'none';
        progressBar.value = 0;
    }

    function updateProgress(value) {
        if (!progressBar) return;
        progressBar.value = Math.max(0, Math.min(100, value));
    }

     // Função auxiliar para ler arquivo como ArrayBuffer usando Promise
    function readFileAsArrayBuffer(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (event) => {
                resolve(event.target.result);
            };
            reader.onerror = (error) => {
                console.error("FileReader Error:", error);
                reject(new Error(`Erro ao ler o arquivo ${file.name}`));
            };
            reader.readAsArrayBuffer(file);
        });
    }

    // Função auxiliar para iniciar o download
    function triggerDownload(pdfBytes, originalFileName) {
        try {
            const blob = new Blob([pdfBytes], { type: 'application/pdf' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            const unlockedName = originalFileName.replace(/\.pdf$/i, '');
            link.download = `${unlockedName}_desbloqueado.pdf`;

            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            setTimeout(() => URL.revokeObjectURL(url), 100); // Revoga após um pequeno atraso
        } catch (e) {
            console.error("Erro ao tentar iniciar download:", e);
            addLog(`Erro ao criar link de download para ${originalFileName}`, "error");
            // Tentar uma mensagem de erro para o usuário aqui, se apropriado
            setStatus("Erro ao preparar um dos downloads. Verifique o console.", true);
        }
    }


    // --- VERIFICAÇÃO DA BIBLIOTECA E INICIALIZAÇÃO ---
    // Verifica se pdf-lib e os elementos essenciais estão prontos
    if (typeof PDFLib === 'undefined' || typeof PDFLib.PDFDocument === 'undefined') {
        console.error("Erro: A biblioteca pdf-lib ou PDFDocument não foi carregada corretamente.");
        // Agora é seguro chamar setStatus porque as variáveis foram declaradas
        setStatus("Erro crítico: Falha ao carregar a biblioteca PDF. A ferramenta não funcionará.", true);
        if(unlockButton) unlockButton.disabled = true; // Desabilita botão se setup falhar
        return; // Interrompe a execução
    }
    // Verifica se os elementos essenciais da UI foram encontrados
    if (!filesInput || !passwordInput || !unlockButton || !statusParagraph || !logList || !progressBar) {
         console.error("Erro: Um ou mais elementos da interface não foram encontrados no DOM.");
         // Tenta usar alert como fallback se setStatus falhar
         alert("Erro crítico: Falha ao inicializar a interface do usuário. Verifique se o HTML está correto.");
         if(unlockButton) unlockButton.disabled = true;
         return;
    }

    const { PDFDocument } = PDFLib; // Pega a classe principal da biblioteca

    // Adiciona o listener ao botão apenas se tudo estiver ok
    unlockButton.addEventListener('click', handleUnlockMultiple);
    setStatus("Pronto para desbloquear PDFs."); // Mensagem inicial


    // --- Função Principal (handleUnlockMultiple) ---
    async function handleUnlockMultiple() {
        const files = filesInput.files;
        const password = passwordInput.value;

        if (files.length === 0) {
            setStatus("Por favor, selecione um ou mais arquivos PDF.", true);
            return;
        }
        if (!password) {
            setStatus("Por favor, digite a senha (única para todos os PDFs).", true);
            return;
        }

        unlockButton.disabled = true;
        setStatus(`Iniciando processamento de ${files.length} arquivo(s)...`);
        logList.innerHTML = ''; // Limpa logs específicos da execução anterior
        showProgress(true);
        updateProgress(0);

        let successCount = 0;
        let errorCount = 0;

        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            const fileIndexInfo = `[${i + 1}/${files.length}]`; // Adiciona info de índice
            addLog(`${fileIndexInfo} Processando: ${file.name}`, 'info');

            // Calcula progresso base para este arquivo
            const baseProgress = (i / files.length) * 100;
            const progressPerStep = (1 / files.length) * 100 / 4; // Divide progresso em etapas

            try {
                updateProgress(baseProgress + progressPerStep * 1); // Progresso: Lendo
                const arrayBuffer = await readFileAsArrayBuffer(file);
                addLog(`${fileIndexInfo} Arquivo lido: ${file.name}`, 'info');

                updateProgress(baseProgress + progressPerStep * 2); // Progresso: Desbloqueando
                const existingPdfDoc = await PDFDocument.load(arrayBuffer, {
                    password: password,
                    updateMetadata: false, // Pode acelerar um pouco
                    ignoreEncryption: false
                });
                addLog(`${fileIndexInfo} Desbloqueado: ${file.name}`, 'info');

                updateProgress(baseProgress + progressPerStep * 3); // Progresso: Gerando
                const newPdfDoc = await PDFDocument.create();
                const indices = existingPdfDoc.getPageIndices();
                const copiedPages = await newPdfDoc.copyPages(existingPdfDoc, indices);
                copiedPages.forEach(page => newPdfDoc.addPage(page));

                const pdfBytes = await newPdfDoc.save({ useObjectStreams: false }); // useObjectStreams: false pode ajudar compatibilidade
                addLog(`${fileIndexInfo} PDF gerado: ${file.name}`, 'info');

                updateProgress(baseProgress + progressPerStep * 4); // Progresso: Download
                triggerDownload(pdfBytes, file.name);
                addLog(`${fileIndexInfo} Download iniciado: ${file.name.replace(/\.pdf$/i, '')}_desbloqueado.pdf`, 'success');
                successCount++;

            } catch (err) {
                errorCount++;
                console.error(`Erro ao processar ${file.name}:`, err);
                let errorMessage = `${fileIndexInfo} Falha ao processar ${file.name}.`;
                 if (err instanceof PDFLib.PasswordError) { // Usando erro específico da Lib
                     errorMessage += " Senha incorreta.";
                 } else if (err.message && err.message.toLowerCase().includes('invalid pdf')) {
                      errorMessage += " Arquivo PDF inválido ou corrompido.";
                 } else if (err.message && err.message.includes('encrypted') && !err.message.toLowerCase().includes('password')) {
                      errorMessage += " Tipo de criptografia não suportado ou PDF danificado.";
                 }
                  else {
                     errorMessage += ` Detalhe: ${err.message || 'Erro desconhecido'}`;
                 }
                addLog(errorMessage, "error");
                // Atualiza progresso mesmo em caso de erro para não parar a barra
                 updateProgress(baseProgress + progressPerStep * 4);
            }
        } // Fim do loop for

        // --- Finalização ---
        showProgress(false);
        passwordInput.value = '';
        filesInput.value = ''; // Limpa seleção

        let finalMessage = `Processamento concluído. ${successCount} arquivo(s) desbloqueado(s).`;
        if (errorCount > 0) {
            finalMessage += ` ${errorCount} falharam. Verifique os logs acima.`;
            setStatus(finalMessage, true);
        } else if (successCount > 0) {
             setStatus(finalMessage, false); // Sucesso total ou parcial sem erros
        } else {
             // Caso nenhum arquivo tenha sido selecionado ou todos falharam sem sucesso
             setStatus("Nenhum PDF foi processado com sucesso.", true);
        }

        unlockButton.disabled = false;
    } // Fim handleUnlockMultiple

}); // Fim do DOMContentLoaded
