import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import multer from "multer";
import { splitFile, compressFile, reassembleFiles } from "./src/server/fileUtils";
import fs from "fs";

async function startServer() {
  const app = express();
  const PORT = 3000;
  const upload = multer({ dest: 'uploads/' });

  app.use(express.json());

  // API routes FIRST
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  app.post("/api/split", upload.single("file"), async (req, res) => {
    const file = (req as any).file;
    if (!file) return res.status(400).send("No file uploaded");
    const { partSize } = req.body;
    try {
        const { partPaths, checksums } = await splitFile(file.path, parseInt(partSize));
        res.json({ partPaths, checksums });
    } catch (error) {
        res.status(500).send(error);
    }
  });

  app.post("/api/compress", upload.single("file"), async (req, res) => {
    const file = (req as any).file;
    if (!file) return res.status(400).send("No file uploaded");
    try {
        const compressedPath = compressFile(file.path);
        res.sendFile(compressedPath);
    } catch (error) {
        res.status(500).send(error);
    }
  });

  app.post("/api/reassemble", async (req, res) => {
    const { partPaths, partChecksums, outputPath } = req.body;
    try {
        const success = reassembleFiles(partPaths, partChecksums, outputPath);
        if (success) {
            res.send("Reassembled and verified");
        } else {
            res.status(400).send("Checksum verification failed");
        }
    } catch (error) {
        res.status(500).send(error);
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
