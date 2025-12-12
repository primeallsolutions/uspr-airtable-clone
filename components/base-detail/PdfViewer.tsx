"use client";

type PdfViewerProps = {
  fileUrl: string;
};

export const PdfViewer = ({ fileUrl }: PdfViewerProps) => {
  return (
    <div className="w-full h-full overflow-hidden bg-gray-100">
      <object data={fileUrl} type="application/pdf" className="w-full h-full">
        <p className="p-4 text-sm text-gray-600">
          Unable to display PDF.{" "}
          <a href={fileUrl} target="_blank" rel="noreferrer" className="text-blue-600 underline">
            Open in new tab
          </a>.
        </p>
      </object>
    </div>
  );
};

