import JSZip from 'jszip';

export interface CompressionOptions {
  mode: 'lossless' | 'balanced' | 'maximum';
  imageQuality: number; // 0.1 to 1.0
  convertToWebP: boolean;
  archiveFormat: 'zip' | 'gzip';
  maxDimension?: number;
}

export interface CompressedAssetResult {
  originalFile: File;
  originalSize: number;
  compressedBlob: Blob;
  compressedSize: number;
  ratio: number; // Percentage saved
  outputName: string;
  mimeType: string;
  previewUrl?: string;
}

export async function compressImage(
  file: File,
  options: CompressionOptions
): Promise<CompressedAssetResult> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      let width = img.width;
      let height = img.height;

      // Scale down if maxDimension is provided
      if (options.maxDimension && (width > options.maxDimension || height > options.maxDimension)) {
        if (width > height) {
          height = Math.round((height * options.maxDimension) / width);
          width = options.maxDimension;
        } else {
          width = Math.round((width * options.maxDimension) / height);
          height = options.maxDimension;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Canvas 2D context not supported'));
        return;
      }

      // Draw with smooth interpolation
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, width, height);

      let targetMime = file.type;
      let targetExtension = file.name.split('.').pop() || 'png';

      if (options.convertToWebP) {
        targetMime = 'image/webp';
        targetExtension = 'webp';
      } else if (file.type === 'image/jpeg' || file.name.endsWith('.jpg') || file.name.endsWith('.jpeg')) {
        targetMime = 'image/jpeg';
      } else if (file.type === 'image/png') {
        targetMime = options.mode === 'lossless' ? 'image/png' : 'image/webp';
        if (targetMime === 'image/webp') targetExtension = 'webp';
      }

      const quality = options.mode === 'lossless' ? 1.0 : options.imageQuality;

      canvas.toBlob(
        blob => {
          if (!blob) {
            reject(new Error('Image compression failed'));
            return;
          }

          const ratio = Math.max(0, parseFloat((((file.size - blob.size) / file.size) * 100).toFixed(1)));
          const baseName = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
          const outputName = `${baseName}_optimized.${targetExtension}`;

          resolve({
            originalFile: file,
            originalSize: file.size,
            compressedBlob: blob,
            compressedSize: blob.size,
            ratio,
            outputName,
            mimeType: targetMime,
            previewUrl: URL.createObjectURL(blob),
          });
        },
        targetMime,
        quality
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Could not load image for optimization'));
    };

    img.src = objectUrl;
  });
}

export async function compressGenericFile(
  file: File,
  options: CompressionOptions
): Promise<CompressedAssetResult> {
  const isImage = file.type.startsWith('image/') && !file.type.includes('svg');
  if (isImage) {
    try {
      return await compressImage(file, options);
    } catch {
      // Fallback to archive compression
    }
  }

  // Use JSZip with maximum deflate level for generic files
  const zip = new JSZip();
  const compressionLevel = options.mode === 'maximum' ? 9 : options.mode === 'balanced' ? 6 : 1;

  zip.file(file.name, file, {
    compression: 'DEFLATE',
    compressionOptions: { level: compressionLevel },
  });

  const zipBlob = await zip.generateAsync({
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: { level: compressionLevel },
  });

  const ratio = Math.max(0, parseFloat((((file.size - zipBlob.size) / file.size) * 100).toFixed(1)));
  const outputName = `${file.name}.zip`;

  return {
    originalFile: file,
    originalSize: file.size,
    compressedBlob: zipBlob,
    compressedSize: zipBlob.size,
    ratio,
    outputName,
    mimeType: 'application/zip',
  };
}
