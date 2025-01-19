import React from 'react';
import { FileUp, X, FileText, Download, AlertTriangle } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { clsx } from 'clsx';
import { Button } from './Button';
import { Modal } from './Modal';
import { supabase } from '../../lib/supabase';

interface FileUploadManagerProps {
  bucketName: string;
  folderPath: string;
  onUploadComplete?: (fileData: {
    name: string;
    path: string;
    type: string;
    size: number;
  }) => Promise<void>;
  onDeleteComplete?: (filePath: string, markedForDeletion: boolean) => Promise<void>;
  files?: Array<{
    name: string;
    path: string;
    type: string;
    size: number;
  }>;
  maxSize?: number; // in bytes, default 10MB
  accept?: string;
  className?: string;
}

export function FileUploadManager({
  bucketName,
  folderPath,
  onUploadComplete,
  onDeleteComplete,
  files = [],
  maxSize = 10 * 1024 * 1024, // 10MB default
  accept,
  className
}: FileUploadManagerProps) {
  const [markedForDeletion, setMarkedForDeletion] = React.useState<Set<string>>(new Set());
  const [isDragging, setIsDragging] = React.useState(false);
  const [isUploading, setIsUploading] = React.useState(false);
  const [uploadProgress, setUploadProgress] = React.useState(0);
  const [showDeleteModal, setShowDeleteModal] = React.useState(false);
  const [fileToDelete, setFileToDelete] = React.useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      for (const file of e.dataTransfer.files) {
        await handleFileUpload(file);
      }
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      for (const file of Array.from(e.target.files)) {
        await handleFileUpload(file);
      }
      e.target.value = ''; // Reset input
    }
  };

  const handleFileUpload = async (file: File) => {
    if (file.size > maxSize) {
      toast.error(`File size exceeds ${formatFileSize(maxSize)}`);
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);

    try {
      const filePath = `${folderPath}/${Date.now()}-${file.name}`;
      
      const { error: uploadError, data } = await supabase.storage
        .from(bucketName)
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) throw uploadError;

      if (onUploadComplete) {
        await onUploadComplete({
          name: file.name,
          path: filePath,
          type: file.type,
          size: file.size
        });
      }

      toast.success('File uploaded successfully');
      setUploadProgress(100);
    } catch (error) {
      console.error('Error uploading file:', error);
      toast.error('Failed to upload file');
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  const handleDelete = async () => {
    if (!fileToDelete) return;

    // Mark file for deletion
    setMarkedForDeletion(prev => new Set([...prev, fileToDelete]));

    // Notify parent about marking file for deletion
    if (onDeleteComplete) {
      await onDeleteComplete(fileToDelete, true);
    }

    setFileToDelete(null);
    setShowDeleteModal(false);
    toast.success('File marked for deletion - will be removed when saving');
  };

  const handleDownload = async (filePath: string, fileName: string) => {
    try {
      const { data, error } = await supabase.storage
        .from(bucketName)
        .download(filePath);

      if (error) throw error;

      // Create a download link
      const url = window.URL.createObjectURL(data);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', fileName);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading file:', error);
      toast.error('Failed to download file');
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className={clsx('space-y-4', className)}>
      {/* Upload Area */}
      <div
        className={clsx(
          'border-2 border-dashed rounded-lg p-8 text-center transition-colors',
          isDragging ? 'border-indigo-500 bg-indigo-50' : 'border-gray-300 hover:border-gray-400',
          isUploading && 'opacity-50 cursor-not-allowed'
        )}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => !isUploading && fileInputRef.current?.click()}
      >
        <input
          type="file"
          className="hidden"
          multiple
          ref={fileInputRef}
          onChange={handleFileSelect}
          accept={accept}
          disabled={isUploading}
        />
        
        {isUploading ? (
          <div className="space-y-3">
            <div className="w-full bg-gray-200 rounded-full h-2.5">
              <div
                className="bg-indigo-600 h-2.5 rounded-full transition-all duration-300"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
            <p className="text-sm text-gray-600">Uploading files... {uploadProgress}%</p>
          </div>
        ) : (
          <>
            <FileUp className="mx-auto h-12 w-12 text-gray-400" />
            <p className="mt-2 text-sm text-gray-600">
              Drag and drop your files here, or click to select
            </p>
            {accept && (
              <p className="mt-1 text-xs text-gray-500">
                Allowed file types: {accept}
              </p>
            )}
            <p className="mt-1 text-xs text-gray-500">
              Maximum file size per file: {formatFileSize(maxSize)}
            </p>
          </>
        )}
      </div>

      {/* File List */}
      {files.length > 0 && (
        <div className="space-y-2">
          {files.map((file, index) => (
            <div
              key={index}
              className="flex items-center justify-between p-3 bg-white rounded-lg border border-gray-200"
            >
              <div className={clsx(
                "flex items-center gap-3",
                markedForDeletion.has(file.path) && "opacity-50"
              )}>
                <div className="p-2 bg-indigo-50 rounded-lg">
                  <FileText className="w-5 h-5 text-indigo-600" />
                </div>
                <div>
                  <p className={clsx(
                    "text-sm font-medium text-gray-900",
                    markedForDeletion.has(file.path) && "line-through"
                  )}>{file.name}</p>
                  <p className="text-xs text-gray-500">{formatFileSize(file.size)}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {markedForDeletion.has(file.path) ? (
                  <button
                    onClick={() => {
                      setMarkedForDeletion(prev => {
                        const next = new Set(prev);
                        next.delete(file.path);
                        return next;
                      });
                      toast.success('File unmarked for deletion');
                    }}
                    className="text-indigo-600 hover:text-indigo-900 text-sm font-medium"
                  >
                    Undo
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => handleDownload(file.path, file.name)}
                      className="p-1 text-gray-500 hover:text-gray-700"
                      title="Download"
                    >
                      <Download className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setFileToDelete(file.path);
                        setShowDeleteModal(true);
                      }}
                      className="p-1 text-red-500 hover:text-red-700"
                      title="Delete"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        title="Mark File for Deletion"
      >
        <div className="space-y-4">
          <div className="flex items-center gap-3 text-amber-600">
            <AlertTriangle className="h-6 w-6" />
            <p className="font-medium">This action cannot be undone</p>
          </div>
          <p className="text-gray-600">
            This file will be marked for deletion and removed when you save the form.
          </p>
          <div className="flex justify-end gap-3 mt-6">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setShowDeleteModal(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="danger"
              onClick={handleDelete}
              className="min-w-[100px]"
            >
              Delete
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}