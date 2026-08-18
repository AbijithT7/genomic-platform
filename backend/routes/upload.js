const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { PrismaClient } = require('@prisma/client');
const { parseVCF } = require('../services/vcfParser');

const router = express.Router();
const prisma = new PrismaClient();

// Ensure uploads directory exists
const uploadDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Multer storage configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const safeOriginalName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    cb(null, `${uniqueSuffix}-${safeOriginalName}`);
  },
});

// File filter: accept only .vcf files
const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  if (ext === '.vcf') {
    cb(null, true);
  } else {
    cb(new Error('Invalid file format. Only .vcf files are allowed.'), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 300 * 1024 * 1024, // 300MB limit for large genomic VCF files
  },
});

/**
 * POST /api/upload
 * Handles .vcf file upload, parses locally using stream-based parseVCF(),
 * creates a Patient record, bulk-inserts variants via prisma.variant.createMany,
 * and deletes the uploaded temporary file with fs.unlinkSync.
 */
router.post('/upload', (req, res, next) => {
  upload.any()(req, res, async (err) => {
    if (err instanceof multer.MulterError) {
      return res.status(400).json({ error: `Upload error: ${err.message}` });
    } else if (err) {
      return res.status(400).json({ error: err.message });
    }

    const uploadedFile = req.files && req.files.length > 0 ? req.files[0] : req.file;

    if (!uploadedFile) {
      return res.status(400).json({
        error: 'No file uploaded. Please upload a .vcf file using the "file" or "vcfFile" field.',
      });
    }

    const filePath = uploadedFile.path;
    const originalFilename = uploadedFile.originalname;

    try {
      // 1. Create Patient entry in database
      const patient = await prisma.patient.create({
        data: {
          filename: originalFilename,
        },
      });

      // 2. Parse VCF stream using local fs and readline
      const parsedVariants = await parseVCF(filePath);

      let totalInserted = 0;

      if (Array.isArray(parsedVariants) && parsedVariants.length > 0) {
        // Map parsed variants to database schema format
        const variantsData = parsedVariants.map((v) => ({
          patientId: patient.id,
          chrom: String(v.chrom),
          pos: parseInt(v.pos, 10),
          ref: String(v.ref),
          alt: String(v.alt),
          qual: v.qual !== null && v.qual !== undefined ? parseFloat(v.qual) : null,
          status: v.clinvar_status && ['pathogenic', 'benign', 'vus'].includes(v.clinvar_status.toLowerCase())
            ? (v.clinvar_status.charAt(0).toUpperCase() + v.clinvar_status.slice(1).toLowerCase())
            : 'pending',
        }));

        // Batch-insert records into Variant table (in chunks of 1000 for SQLite optimization)
        const chunkSize = 1000;
        for (let i = 0; i < variantsData.length; i += chunkSize) {
          const chunk = variantsData.slice(i, i + chunkSize);
          const result = await prisma.variant.createMany({
            data: chunk,
          });
          totalInserted += result.count;
        }

        // Attach initial disease / evidence records if annotated in VCF
        const createdVariants = await prisma.variant.findMany({
          where: { patientId: patient.id },
          orderBy: { pos: 'asc' },
        });

        const { GENE_DISEASE_MAP } = require('../services/annotationService');

        for (let i = 0; i < createdVariants.length && i < parsedVariants.length; i++) {
          const pv = parsedVariants[i];
          const cv = createdVariants[i];
          let initialDisease = pv.disease || null;
          if (!initialDisease && pv.gene && GENE_DISEASE_MAP[pv.gene.toUpperCase()]) {
            initialDisease = GENE_DISEASE_MAP[pv.gene.toUpperCase()];
          }

          if (initialDisease || pv.clinvar_status) {
            await prisma.evidence.create({
              data: {
                variantId: cv.id,
                frequency: pv.af !== null && !isNaN(pv.af) ? pv.af : 0,
                conservation_score: 0,
                ml_score: pv.clinvar_status?.toLowerCase() === 'pathogenic' ? 0.95 : (pv.clinvar_status?.toLowerCase() === 'benign' ? 0.05 : 0.5),
                clinvar_status: pv.clinvar_status || null,
                disease: initialDisease,
                shap_explanation: `Ingested from VCF annotation${pv.gene ? ` (Gene: ${pv.gene})` : ''}${initialDisease ? ` (Disease: ${initialDisease})` : ''}`,
              },
            }).catch(() => {});
          }
        }
      }

      // 3. Delete the temporary uploaded file
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }

      // 4. Fetch full patient with variants to return to frontend
      const fullPatient = await prisma.patient.findUnique({
        where: { id: patient.id },
        include: {
          variants: {
            include: {
              evidence: true,
            },
            orderBy: { pos: 'asc' },
          },
        },
      });

      // 5. Return response containing patientId, total variants, and full patient object
      return res.status(201).json({
        message: 'VCF file successfully uploaded and processed',
        patientId: patient.id,
        filename: originalFilename,
        totalVariants: totalInserted,
        patient: fullPatient,
      });
    } catch (processError) {
      // Ensure temp file cleanup on error
      try {
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      } catch (_) {}

      console.error('Error processing VCF file:', processError);
      return res.status(500).json({
        error: 'Failed to process VCF file',
        details: processError.message,
      });
    }
  });
});

module.exports = router;
