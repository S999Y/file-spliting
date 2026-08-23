import fs from "fs";
import crypto from "crypto";
import path from "path";
import AdmZip from "adm-zip";

export const calculateChecksum = (filePath: string): string => {
  const fileBuffer = fs.readFileSync(filePath);
  const hashSum = crypto.createHash('sha256');
  hashSum.update(fileBuffer);
  return hashSum.digest('hex');
};

export const splitFile = async (filePath: string, partSize: number): Promise<{partPaths: string[], checksums: string[]}> => {
    const fileStats = fs.statSync(filePath);
    const fileSize = fileStats.size;
    const partPaths: string[] = [];
    const checksums: string[] = [];
    const fileName = path.basename(filePath);
    const tempDir = path.join(path.dirname(filePath), `${fileName}_parts`);

    if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir);
    }

    let offset = 0;
    let partIndex = 0;

    while (offset < fileSize) {
        const partPath = path.join(tempDir, `${fileName}.part${partIndex}`);
        const buffer = Buffer.alloc(Math.min(partSize, fileSize - offset));
        
        const fd = fs.openSync(filePath, 'r');
        fs.readSync(fd, buffer, 0, buffer.length, offset);
        fs.closeSync(fd);

        fs.writeFileSync(partPath, buffer);
        partPaths.push(partPath);
        checksums.push(calculateChecksum(partPath));
        offset += buffer.length;
        partIndex++;
    }

    return {partPaths, checksums};
};

export const reassembleFiles = (partPaths: string[], partChecksums: string[], outputPath: string): boolean => {
    // Sort parts numerically based on the index in the filename
    const sortedPaths = partPaths.sort((a, b) => {
        const indexA = parseInt(a.split('.part')[1]);
        const indexB = parseInt(b.split('.part')[1]);
        return indexA - indexB;
    });

    const writeStream = fs.createWriteStream(outputPath);
    for (let i = 0; i < sortedPaths.length; i++) {
        const partPath = sortedPaths[i];
        
        // Verify Checksum
        if (calculateChecksum(partPath) !== partChecksums[i]) {
            return false;
        }

        const data = fs.readFileSync(partPath);
        writeStream.write(data);
    }
    writeStream.end();
    return true;
};

export const compressFile = (filePath: string): string => {
    const zip = new AdmZip();
    zip.addLocalFile(filePath);
    const compressedPath = `${filePath}.zip`;
    zip.writeZip(compressedPath);
    return compressedPath;
};
