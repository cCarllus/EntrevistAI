import mammoth from 'mammoth/mammoth.browser';
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.mjs?url';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

const maxFileSize = 5 * 1024 * 1024;

export interface ExtractedFile {
  fileName: string;
  text: string;
}

export async function extractTextFromFile(file: File): Promise<ExtractedFile> {
  if (file.size > maxFileSize) {
    throw new Error('Arquivo muito grande. O limite para upload é 5MB.');
  }

  const extension = file.name.split('.').pop()?.toLowerCase();

  if (extension === 'txt' || file.type === 'text/plain') {
    return { fileName: file.name, text: (await file.text()).trim() };
  }

  if (extension === 'pdf' || file.type === 'application/pdf') {
    return { fileName: file.name, text: await extractPdfText(file) };
  }

  if (
    extension === 'docx' ||
    file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ) {
    const result = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
    return { fileName: file.name, text: result.value.trim() };
  }

  throw new Error('Formato não suportado. Use PDF, DOCX ou TXT.');
}

async function extractPdfText(file: File): Promise<string> {
  try {
    const data = new Uint8Array(await file.arrayBuffer());
    const pdf = await pdfjsLib.getDocument({ data }).promise;
    const pages: string[] = [];

    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const content = await page.getTextContent();
      const text = content.items
        .map((item) => ('str' in item ? item.str : ''))
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();

      if (text) {
        pages.push(text);
      }
    }

    const extracted = pages.join('\n\n').trim();

    if (!extracted) {
      throw new Error('Nenhum texto encontrado no PDF.');
    }

    return extracted;
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'erro desconhecido';
    throw new Error(
      `Não foi possível ler este PDF (${detail}). Cole o texto manualmente para continuar.`
    );
  }
}
