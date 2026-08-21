/**
 * Downscale and re-encode a camera capture before upload.
 *
 * Phone cameras produce 4–12MB frames. Sending those raw over hotel wifi is the
 * slowest part of any capture flow, and none of that resolution survives the
 * uses these images are put to. 1280px on the long edge keeps a CNIC or passport
 * comfortably readable while landing around 200KB.
 */
export async function compressImage(
  file: File,
  maxPx = 1280,
  quality = 0.82,
): Promise<{ base64: string; mimeType: string }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, maxPx / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width  = Math.round(img.width  * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(
        (blob) => {
          if (!blob) { reject(new Error("Failed to compress image")); return; }
          const reader = new FileReader();
          reader.onload = () => {
            const b64 = (reader.result as string).split(",")[1];
            resolve({ base64: b64!, mimeType: "image/jpeg" });
          };
          reader.readAsDataURL(blob);
        },
        "image/jpeg",
        quality,
      );
    };
    img.onerror = reject;
    img.src = url;
  });
}
