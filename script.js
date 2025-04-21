const fileList = document.getElementById('fileList');
const filesData = [];
const passwordInput = document.getElementById('senha');

// Carregar a senha salva no localStorage
window.onload = () => {
  const savedPassword = localStorage.getItem('pdfPassword');
  if (savedPassword) {
    passwordInput.value = savedPassword;
  }
};

document.getElementById('pdfInput').addEventListener('change', (event) => {
  Array.from(event.target.files).forEach((file) => {
    const reader = new FileReader();
    reader.onload = () => {
      const arrayBuffer = reader.result;
      const id = Date.now() + Math.random();
      const index = filesData.push({ id, file, arrayBuffer }) - 1;

      const div = document.createElement('div');
      div.className = 'file-entry';
      div.id = `entry-${id}`;
      div.innerHTML = `
        <p><strong>${file.name}</strong></p>
        <button onclick="removerArquivo(${id})">Remover</button>
      `;
      fileList.appendChild(div);
    };
    reader.readAsArrayBuffer(file);
  });
});

function removerArquivo(id) {
  const index = filesData.findIndex(f => f.id === id);
  if (index !== -1) filesData.splice(index, 1);
  const el = document.getElementById(`entry-${id}`);
  if (el) el.remove();
}

// Função para salvar a senha no localStorage
function savePassword() {
  const senha = passwordInput.value;
  if (senha) {
    localStorage.setItem('pdfPassword', senha);
    alert('Senha salva com sucesso!');
  } else {
    alert('Por favor, insira uma senha.');
  }
}

// Função para remover a senha salva no localStorage
function clearPassword() {
  localStorage.removeItem('pdfPassword');
  passwordInput.value = '';
  alert('Senha removida.');
}

async function desbloquearPDFs() {
  const senha = passwordInput.value;
  if (!senha) {
    alert('Por favor, insira uma senha para desbloquear os PDFs.');
    return;
  }

  for (const { file, arrayBuffer } of filesData) {
    try {
      const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer, password: senha });
      const pdf = await loadingTask.promise;

      const pdfDoc = await PDFLib.PDFDocument.create();
      for (let i = 0; i < pdf.numPages; i++) {
        const page = await pdf.getPage(i + 1);
        const viewport = page.getViewport({ scale: 2 });

        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.height = viewport.height;
        canvas.width = viewport.width;

        await page.render({ canvasContext: context, viewport }).promise;

        const imgData = canvas.toDataURL('image/png');
        const pageImage = await pdfDoc.embedPng(imgData);
        const pageRef = pdfDoc.addPage([viewport.width, viewport.height]);
        pageRef.drawImage(pageImage, { x: 0, y: 0, width: viewport.width, height: viewport.height });
      }

      const pdfBytes = await pdfDoc.save();
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `desbloqueado_${file.name}`;
      link.click();

    } catch (err) {
      alert(`Erro ao desbloquear ${file.name}: senha incorreta ou arquivo não suportado.`);
    }
  }
}
