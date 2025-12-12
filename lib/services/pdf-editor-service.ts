import { PDFDocument, PDFPage, PDFFont, rgb, PDFForm, RGB } from "pdf-lib";

export type Annotation = {
  id: string;
  type: "text" | "highlight" | "note";
  x: number;
  y: number;
  width?: number;
  height?: number;
  content: string;
  color?: string;
  page: number;
};

export type Signature = {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  imageData: string; // Base64 image data
  page: number;
};

export class PdfEditorService {
  static async loadPdf(file: File | Blob): Promise<PDFDocument> {
    const arrayBuffer = await file.arrayBuffer();
    return await PDFDocument.load(arrayBuffer);
  }

  static async savePdf(pdfDoc: PDFDocument): Promise<Blob> {
    const pdfBytes = await pdfDoc.save();
    // Uint8Array is compatible with Blob constructor
    return new Blob([pdfBytes as any], { type: "application/pdf" });
  }

  static async addTextAnnotation(
    pdfDoc: PDFDocument,
    pageIndex: number,
    text: string,
    x: number,
    y: number,
    fontSize: number = 12,
    color: RGB = rgb(0, 0, 0)
  ): Promise<void> {
    const pages = pdfDoc.getPages();
    const page = pages[pageIndex];
    const font = await pdfDoc.embedFont("Helvetica");

    page.drawText(text, {
      x,
      y: page.getHeight() - y, // PDF coordinates are bottom-up
      size: fontSize,
      font,
      color,
    });
  }

  static async addHighlight(
    pdfDoc: PDFDocument,
    pageIndex: number,
    x: number,
    y: number,
    width: number,
    height: number,
    color: RGB = rgb(1, 1, 0) // Yellow highlight
  ): Promise<void> {
    const pages = pdfDoc.getPages();
    const page = pages[pageIndex];

    page.drawRectangle({
      x,
      y: page.getHeight() - y - height, // PDF coordinates are bottom-up
      width,
      height,
      color,
      opacity: 0.3,
    });
  }

  static async addSignature(
    pdfDoc: PDFDocument,
    pageIndex: number,
    imageData: string, // Base64 image data URL
    x: number,
    y: number,
    width: number,
    height: number
  ): Promise<void> {
    const pages = pdfDoc.getPages();
    const page = pages[pageIndex];

    try {
      // Convert base64 data URL to Uint8Array
      const base64Data = imageData.includes(",") ? imageData.split(",")[1] : imageData;
      const imageBytes = Uint8Array.from(atob(base64Data), (c) => c.charCodeAt(0));
      
      // Try PNG first, then JPEG
      let image;
      try {
        image = await pdfDoc.embedPng(imageBytes);
      } catch {
        image = await pdfDoc.embedJpg(imageBytes);
      }

      page.drawImage(image, {
        x,
        y: page.getHeight() - y - height, // PDF coordinates are bottom-up
        width,
        height,
      });
    } catch (err) {
      console.error("Failed to add signature", err);
      throw err;
    }
  }

  static async fillFormField(
    pdfDoc: PDFDocument,
    fieldName: string,
    value: string
  ): Promise<boolean> {
    const form = pdfDoc.getForm();
    const field = form.getTextField(fieldName);

    if (field) {
      field.setText(value);
      return true;
    }
    return false;
  }

  static async getFormFields(pdfDoc: PDFDocument): Promise<Array<{ name: string; type: string }>> {
    try {
      const form = pdfDoc.getForm();
      const fields: Array<{ name: string; type: string }> = [];

      form.getFields().forEach((field) => {
        fields.push({
          name: field.getName(),
          type: field.constructor.name,
        });
      });

      return fields;
    } catch (err) {
      console.error("Failed to get form fields", err);
      return [];
    }
  }
}

