import { PDFDocument } from 'pdf-lib';

// Limits Configuration
export const PDF_LIMITS = {
    MAX_PAGES_PER_PDF: 50,
    MAX_TOTAL_PAGES: 100,
    MAX_FILES: 20,
    MAX_FILE_SIZE: 10 * 1024 * 1024 // 10MB (already enforced in FileUpload.tsx)
};

/**
 * Check if a file is a PDF
 */
export function isPDF(file: File | Blob): boolean {
    return file.type === 'application/pdf' ||
        (file instanceof File && file.name.toLowerCase().endsWith('.pdf'));
}

/**
 * Get the number of pages in a PDF file
 */
export async function getPageCount(file: File): Promise<number> {
    const arrayBuffer = await file.arrayBuffer();
    const pdfDoc = await PDFDocument.load(arrayBuffer);
    return pdfDoc.getPageCount();
}

/**
 * Validate PDF limits before processing
 * Returns total page count if valid, or error message if invalid
 */
export async function validatePdfLimits(files: (File | Blob)[]):
    Promise<{ valid: boolean; error?: string; totalPages?: number }> {

    // 1. Check file count
    if (files.length > PDF_LIMITS.MAX_FILES) {
        return {
            valid: false,
            error: `Maximum ${PDF_LIMITS.MAX_FILES} files allowed per upload. You selected ${files.length}.`
        };
    }

    let totalPages = 0;

    // 2. Check each PDF's page count
    for (const file of files) {
        if (isPDF(file) && file instanceof File) {
            try {
                const pageCount = await getPageCount(file);

                if (pageCount > PDF_LIMITS.MAX_PAGES_PER_PDF) {
                    return {
                        valid: false,
                        error: `"${file.name}" has ${pageCount} pages (limit: ${PDF_LIMITS.MAX_PAGES_PER_PDF}). Please split into smaller files.`
                    };
                }

                totalPages += pageCount;
            } catch (error) {
                return {
                    valid: false,
                    error: `Failed to read "${file.name}". It may be corrupted or password-protected.`
                };
            }
        } else {
            // Non-PDF files (images) count as 1 page each
            totalPages += 1;
        }
    }

    // 3. Check total pages across all files
    if (totalPages > PDF_LIMITS.MAX_TOTAL_PAGES) {
        return {
            valid: false,
            error: `Upload contains ${totalPages} total pages (limit: ${PDF_LIMITS.MAX_TOTAL_PAGES}). Please reduce selection.`
        };
    }

    return { valid: true, totalPages };
}

/**
 * Split a multi-page PDF into separate single-page PDF Blobs
 */
export async function splitPdfIntoPages(file: File): Promise<Blob[]> {
    const arrayBuffer = await file.arrayBuffer();
    const pdfDoc = await PDFDocument.load(arrayBuffer);
    const pageCount = pdfDoc.getPageCount();
    const pages: Blob[] = [];

    for (let i = 0; i < pageCount; i++) {
        // Create a new PDF with single page
        const newPdfDoc = await PDFDocument.create();
        const [copiedPage] = await newPdfDoc.copyPages(pdfDoc, [i]);
        newPdfDoc.addPage(copiedPage);

        // Save as Uint8Array and convert to Blob
        const pdfBytes = await newPdfDoc.save();
        const blob = new Blob([pdfBytes as any], { type: 'application/pdf' });
        pages.push(blob);
    }

    return pages;
}
