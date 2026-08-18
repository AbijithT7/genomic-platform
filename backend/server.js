const express = require('express');
const cors = require('cors');
const { PrismaClient } = require('@prisma/client');
require('dotenv').config();

const uploadRouter = require('./routes/upload');
const { analyzePatientVariants } = require('./services/pipelineService');

const app = express();
const prisma = new PrismaClient();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ extended: true, limit: '100mb' }));

// Request logging middleware
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// Mount upload router
app.use('/api', uploadRouter);

// Health check endpoint
app.get('/', (req, res) => {
  res.json({
    status: 'ok',
    message: 'Genomic Platform API is running',
    version: '1.0.0',
    endpoints: {
      health: 'GET /api/health',
      upload: 'POST /api/upload',
      analyze: 'POST /api/analyze/:patientId',
      patients: 'GET, POST /api/patients',
      patientById: 'GET, DELETE /api/patients/:id',
      variants: 'GET, POST /api/variants',
      variantById: 'GET, PATCH, DELETE /api/variants/:id',
      evidence: 'GET, POST /api/evidence',
      evidenceByVariant: 'GET /api/evidence/variant/:variantId'
    }
  });
});

app.get('/api/health', async (req, res) => {
  try {
    // Check database connection
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: 'healthy', database: 'connected', timestamp: new Date().toISOString() });
  } catch (error) {
    res.status(500).json({ status: 'unhealthy', database: 'disconnected', error: error.message });
  }
});

// ==========================================
// PATIENT ROUTES
// ==========================================

// Get all patients with their variants and evidence
app.get('/api/patients', async (req, res) => {
  try {
    const patients = await prisma.patient.findMany({
      include: {
        variants: {
          include: {
            evidence: true
          }
        }
      },
      orderBy: {
        date: 'desc'
      }
    });
    res.json(patients);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch patients', details: error.message });
  }
});

// Get a single patient by ID
app.get('/api/patients/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const patient = await prisma.patient.findUnique({
      where: { id },
      include: {
        variants: {
          include: {
            evidence: true
          }
        }
      }
    });

    if (!patient) {
      return res.status(404).json({ error: 'Patient not found' });
    }

    res.json(patient);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch patient', details: error.message });
  }
});

// Create a new patient
app.post('/api/patients', async (req, res) => {
  try {
    const { filename, date } = req.body;

    if (!filename) {
      return res.status(400).json({ error: 'Filename is required' });
    }

    const patient = await prisma.patient.create({
      data: {
        filename,
        date: date ? new Date(date) : undefined
      }
    });

    res.status(201).json(patient);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create patient', details: error.message });
  }
});

// Delete all patients (cascades and clears all variants & evidence)
app.delete('/api/patients', async (req, res) => {
  try {
    await prisma.evidence.deleteMany();
    await prisma.variant.deleteMany();
    const result = await prisma.patient.deleteMany();
    res.json({
      message: 'All patient records and associated variants/evidence deleted successfully',
      count: result.count,
    });
  } catch (error) {
    console.error('Failed to clear database history:', error);
    res.status(500).json({ error: 'Failed to clear database', details: error.message });
  }
});

// Delete a single patient (cascades variants and evidence)
app.delete('/api/patients/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.patient.delete({
      where: { id }
    });
    res.json({ message: 'Patient and related data deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete patient', details: error.message });
  }
});

// ==========================================
// VARIANT ROUTES
// ==========================================

// Get all variants (filterable by patientId, chrom, status)
app.get('/api/variants', async (req, res) => {
  try {
    const { patientId, chrom, status } = req.query;
    const where = {};

    if (patientId) where.patientId = String(patientId);
    if (chrom) where.chrom = String(chrom);
    if (status) where.status = String(status);

    const variants = await prisma.variant.findMany({
      where,
      include: {
        patient: true,
        evidence: true
      }
    });
    res.json(variants);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch variants', details: error.message });
  }
});

// Get a single variant by ID
app.get('/api/variants/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const variant = await prisma.variant.findUnique({
      where: { id },
      include: {
        patient: true,
        evidence: true
      }
    });

    if (!variant) {
      return res.status(404).json({ error: 'Variant not found' });
    }

    res.json(variant);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch variant', details: error.message });
  }
});

// Create a new variant
app.post('/api/variants', async (req, res) => {
  try {
    const { patientId, chrom, pos, ref, alt, status } = req.body;

    if (!patientId || !chrom || pos === undefined || !ref || !alt) {
      return res.status(400).json({
        error: 'Missing required fields: patientId, chrom, pos, ref, alt are required'
      });
    }

    const variant = await prisma.variant.create({
      data: {
        patientId,
        chrom,
        pos: parseInt(pos, 10),
        ref,
        alt,
        status: status || 'pending'
      },
      include: {
        patient: true
      }
    });

    res.status(201).json(variant);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create variant', details: error.message });
  }
});

// Update variant status
app.patch('/api/variants/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { status, chrom, pos, ref, alt } = req.body;

    const data = {};
    if (status !== undefined) data.status = status;
    if (chrom !== undefined) data.chrom = chrom;
    if (pos !== undefined) data.pos = parseInt(pos, 10);
    if (ref !== undefined) data.ref = ref;
    if (alt !== undefined) data.alt = alt;

    const variant = await prisma.variant.update({
      where: { id },
      data,
      include: {
        evidence: true
      }
    });

    res.json(variant);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update variant', details: error.message });
  }
});

// Delete a variant
app.delete('/api/variants/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.variant.delete({
      where: { id }
    });
    res.json({ message: 'Variant deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete variant', details: error.message });
  }
});

// ==========================================
// EVIDENCE ROUTES
// ==========================================

// Get all evidence entries
app.get('/api/evidence', async (req, res) => {
  try {
    const evidence = await prisma.evidence.findMany({
      include: {
        variant: {
          include: {
            patient: true
          }
        }
      }
    });
    res.json(evidence);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch evidence', details: error.message });
  }
});

// Get evidence by variant ID
app.get('/api/evidence/variant/:variantId', async (req, res) => {
  try {
    const { variantId } = req.params;
    const evidence = await prisma.evidence.findUnique({
      where: { variantId },
      include: {
        variant: true
      }
    });

    if (!evidence) {
      return res.status(404).json({ error: 'Evidence not found for the specified variant' });
    }

    res.json(evidence);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch evidence', details: error.message });
  }
});

// Create or update evidence for a variant (upsert)
app.post('/api/evidence', async (req, res) => {
  try {
    const { variantId, frequency, conservation_score, ml_score, shap_explanation } = req.body;

    if (
      !variantId ||
      frequency === undefined ||
      conservation_score === undefined ||
      ml_score === undefined ||
      shap_explanation === undefined
    ) {
      return res.status(400).json({
        error: 'Missing required fields: variantId, frequency, conservation_score, ml_score, shap_explanation'
      });
    }

    const explanationString =
      typeof shap_explanation === 'object'
        ? JSON.stringify(shap_explanation)
        : String(shap_explanation);

    const evidence = await prisma.evidence.upsert({
      where: { variantId },
      update: {
        frequency: parseFloat(frequency),
        conservation_score: parseFloat(conservation_score),
        ml_score: parseFloat(ml_score),
        shap_explanation: explanationString
      },
      create: {
        variantId,
        frequency: parseFloat(frequency),
        conservation_score: parseFloat(conservation_score),
        ml_score: parseFloat(ml_score),
        shap_explanation: explanationString
      },
      include: {
        variant: true
      }
    });

    res.status(201).json(evidence);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create/update evidence', details: error.message });
  }
});

// ==========================================
// ANALYSIS PIPELINE ROUTE
// ==========================================

// Trigger variant annotation & ML analysis pipeline for a patient
app.post('/api/analyze/:patientId', async (req, res) => {
  try {
    const { patientId } = req.params;
    const result = await analyzePatientVariants(patientId);
    res.json({
      message: 'Analysis pipeline completed successfully',
      data: result,
    });
  } catch (error) {
    if (error.message.includes('Patient not found')) {
      return res.status(404).json({ error: error.message });
    }
    console.error('Pipeline execution error:', error);
    res.status(500).json({
      error: 'Analysis pipeline failed',
      details: error.message,
    });
  }
});

// Start the server
const server = app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});

// Handle graceful shutdown
const handleShutdown = async (signal) => {
  console.log(`\nReceived ${signal}. Shutting down gracefully...`);
  server.close(async () => {
    console.log('HTTP server closed.');
    await prisma.$disconnect();
    console.log('Prisma database connection closed.');
    process.exit(0);
  });
};

process.on('SIGINT', () => handleShutdown('SIGINT'));
process.on('SIGTERM', () => handleShutdown('SIGTERM'));

module.exports = { app, prisma, server };
