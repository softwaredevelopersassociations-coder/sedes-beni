import {
  PHOTO_PRINT_PAPER_HEIGHT_MM,
  PHOTO_PRINT_PAPER_WIDTH_MM,
  PHOTO_PRINT_SIZE_MM,
  PHOTO_PRINT_SIZE_PX
} from './photoPrintSettings';

export function printDocument() {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  window.dispatchEvent(new Event('carnet_settings_changed'));
  window.print();
}

function preparePhotoForPrint(photoUrl) {
  return new Promise((resolve) => {
    const image = new Image();
    try {
      const source = new URL(photoUrl, window.location.href);
      const isHttpImage = source.protocol === 'http:' || source.protocol === 'https:';
      if (isHttpImage && source.origin !== window.location.origin) image.crossOrigin = 'anonymous';
    } catch {}

    image.onload = () => {
      try {
        const side = Math.min(image.naturalWidth, image.naturalHeight);
        const cropX = (image.naturalWidth - side) / 2;
        const cropY = (image.naturalHeight - side) / 2;
        const canvas = document.createElement('canvas');
        canvas.width = PHOTO_PRINT_SIZE_PX;
        canvas.height = PHOTO_PRINT_SIZE_PX;
        const context = canvas.getContext('2d');
        if (!context || !side) return resolve(photoUrl);

        context.fillStyle = '#fff';
        context.fillRect(0, 0, PHOTO_PRINT_SIZE_PX, PHOTO_PRINT_SIZE_PX);
        context.drawImage(
          image,
          cropX,
          cropY,
          side,
          side,
          0,
          0,
          PHOTO_PRINT_SIZE_PX,
          PHOTO_PRINT_SIZE_PX
        );
        resolve(canvas.toDataURL('image/jpeg', 0.95));
      } catch {
        // Si el origen de la imagen impide convertirla, se imprime el archivo original.
        resolve(photoUrl);
      }
    };
    image.onerror = () => resolve(photoUrl);
    image.src = photoUrl;
  });
}

export function printPhotoSheet(photoUrl, copies = 1) {
  if (typeof window === 'undefined' || !photoUrl) return;

  const printWindow = window.open('', '_blank', 'popup,width=440,height=700');
  if (!printWindow) {
    window.alert('El navegador bloqueó la ventana de impresión. Permite las ventanas emergentes para imprimir la foto.');
    return;
  }

  const safeCopies = Math.min(12, Math.max(1, Number(copies) || 1));
  const columnCount = Math.min(safeCopies, 3);
  const renderAndPrint = async () => {
    const preparedPhoto = await preparePhotoForPrint(photoUrl);
    if (printWindow.closed) return;
    const safePreparedPhoto = String(preparedPhoto)
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    const photoMarkup = Array.from({ length: safeCopies }, () => `<img src="${safePreparedPhoto}" alt="">`).join('');

    printWindow.document.open();
    printWindow.document.write(`<!doctype html>
    <html lang="es">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>Foto carnet sanitario</title>
        <style>
          @page { size: ${PHOTO_PRINT_PAPER_WIDTH_MM}mm ${PHOTO_PRINT_PAPER_HEIGHT_MM}mm; margin: 0; }
          * { box-sizing: border-box; }
          html, body { width: ${PHOTO_PRINT_PAPER_WIDTH_MM}mm; height: ${PHOTO_PRINT_PAPER_HEIGHT_MM}mm; margin: 0; padding: 0; }
          body { display: grid; place-items: center; overflow: hidden; }
          .sheet {
            width: ${PHOTO_PRINT_PAPER_WIDTH_MM}mm;
            height: ${PHOTO_PRINT_PAPER_HEIGHT_MM}mm;
            display: grid;
            grid-template-columns: repeat(${columnCount}, ${PHOTO_PRINT_SIZE_MM}mm);
            grid-auto-rows: ${PHOTO_PRINT_SIZE_MM}mm;
            gap: 2mm;
            justify-content: center;
            align-content: center;
          }
          img { display: block; width: ${PHOTO_PRINT_SIZE_MM}mm; height: ${PHOTO_PRINT_SIZE_MM}mm; object-fit: cover; object-position: center; }
          @media screen {
            body { background: #e2e8f0; }
            .sheet { background: white; box-shadow: 0 2px 12px #0002; }
          }
        </style>
      </head>
      <body><main class="sheet">${photoMarkup}</main></body>
    </html>`);
    printWindow.document.close();

    const images = Array.from(printWindow.document.images);
    await Promise.all(images.map((image) => {
      if (image.complete) return Promise.resolve();
      return new Promise((resolve) => {
        image.addEventListener('load', resolve, { once: true });
        image.addEventListener('error', resolve, { once: true });
      });
    }));
    if (printWindow.closed) return;
    printWindow.addEventListener('afterprint', () => printWindow.close(), { once: true });
    printWindow.focus();
    printWindow.print();
  };

  renderAndPrint();
}
