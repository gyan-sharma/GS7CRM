import React from 'react';
import { FileText, Download } from 'lucide-react';
import { clsx } from 'clsx';

interface Document {
  id: string;
  name: string;
  file_path: string;
  file_type: string;
  file_size: number;
  created_at: string;
}

interface ReviewDocumentsSectionProps {
  documents: Document[];
  onDownloadDocument: (document: Document) => Promise<void>;
  className?: string;
}

export function ReviewDocumentsSection({
  documents,
  onDownloadDocument,
  className
}: ReviewDocumentsSectionProps) {
  // Sort documents by creation date
  const sortedDocuments = [...documents].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  // Group documents by date
  const groupedDocuments = sortedDocuments.reduce<{
    [key: string]: Document[];
  }>((acc, doc) => {
    const date = new Date(doc.created_at).toLocaleDateString();
    if (!acc[date]) {
      acc[date] = [];
    }
    acc[date].push(doc);
    return acc;
  }, {});

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  if (documents.length === 0) {
    return null;
  }

  return (
    <div className={clsx('space-y-6', className)}>
      <h3 className="text-lg font-medium text-gray-900">Review Documents</h3>
      
      <div className="space-y-6">
        {Object.entries(groupedDocuments).map(([date, docs], index) => (
          <div key={date} className="space-y-2">
            <h4 className={clsx(
              "text-sm font-medium",
              index === 0 ? "text-indigo-600" : "text-gray-500"
            )}>
              {index === 0 ? 'Latest Documents' : date}
            </h4>
            <div className="space-y-2">
              {docs.map((doc) => (
                <div
                  key={doc.id}
                  className="flex items-center justify-between p-3 bg-white rounded-lg border border-gray-200"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-indigo-50 rounded-lg">
                      <FileText className="w-5 h-5 text-indigo-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">{doc.name}</p>
                      <p className="text-xs text-gray-500">{formatFileSize(doc.file_size)}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => onDownloadDocument(doc)}
                    className="p-1 text-gray-500 hover:text-gray-700"
                    title="Download"
                  >
                    <Download className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}