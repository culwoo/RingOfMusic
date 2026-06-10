/** 파일 다운로드 유틸 */

export function downloadDataURL(url: string, fileName: string): void {
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  downloadDataURL(url, fileName);
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

export function downloadSVGElement(svg: SVGSVGElement, fileName: string): void {
  const xml = new XMLSerializer().serializeToString(svg);
  const blob = new Blob(['<?xml version="1.0" encoding="UTF-8"?>\n' + xml], {
    type: 'image/svg+xml;charset=utf-8',
  });
  downloadBlob(blob, fileName);
}
