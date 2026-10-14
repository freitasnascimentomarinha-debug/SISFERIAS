// Redução de imagens no navegador antes de enviar ao servidor: evita que
// fotos de celular (vários MB) façam o banco de dados crescer à toa.

/** Tamanho máximo aceito pelo servidor para imagens (em bytes do arquivo). */
export const MAX_IMAGE_BYTES = 2 * 1024 * 1024;

interface ResizeOptions {
  /** Maior lado da imagem final, em pixels. */
  maxSize: number;
  /** Mantém PNG (com transparência) em vez de converter para JPEG. */
  keepTransparency?: boolean;
  /** Qualidade do JPEG (0 a 1). */
  quality?: number;
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Arquivo de imagem inválido ou não suportado.')); };
    img.src = url;
  });
}

/**
 * Lê o arquivo escolhido, reduz para no máximo `maxSize` pixels no maior lado
 * e devolve como data URL (JPEG, ou PNG quando `keepTransparency`).
 */
export async function resizeImageFile(file: File, { maxSize, keepTransparency = false, quality = 0.85 }: ResizeOptions): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('Escolha um arquivo de imagem (JPG, PNG ou WEBP).');
  const img = await loadImage(file);
  const scale = Math.min(1, maxSize / Math.max(img.naturalWidth, img.naturalHeight));
  const width = Math.max(1, Math.round(img.naturalWidth * scale));
  const height = Math.max(1, Math.round(img.naturalHeight * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Não foi possível processar a imagem neste navegador.');
  const asPng = keepTransparency && file.type === 'image/png';
  if (!asPng) {
    // JPEG não tem transparência: fundo branco no lugar do transparente.
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
  }
  ctx.drawImage(img, 0, 0, width, height);
  const dataUrl = asPng ? canvas.toDataURL('image/png') : canvas.toDataURL('image/jpeg', quality);
  if (dataUrl.length * 0.75 > MAX_IMAGE_BYTES) throw new Error('A imagem continua grande demais mesmo reduzida. Escolha outra.');
  return dataUrl;
}
