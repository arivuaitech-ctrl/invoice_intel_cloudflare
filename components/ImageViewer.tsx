import React, { useState, useEffect } from 'react';
import { X, Download, FileText, AlertCircle, Loader2, ImageIcon } from 'lucide-react';

interface ImageViewerProps {
  isOpen: boolean;
  onClose: () => void;
  imageUrl?: string;
  title: string;
}

const ImageViewer = ({ isOpen, onClose, imageUrl, title }: ImageViewerProps) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setLoading(true);
      setError(false);
    }
  }, [isOpen, imageUrl]);

  if (!isOpen || !imageUrl) return null;

  const isPdf = imageUrl.toLowerCase().startsWith('data:application/pdf');

  return (
    <div className="fixed inset-0 z-[60] overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">

        {/* Backdrop */}
        <div
          className="fixed inset-0 bg-slate-900/95 transition-opacity backdrop-blur-md"
          aria-hidden="true"
          onClick={onClose}
        ></div>

        <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>

        <div className="inline-block align-middle bg-white rounded-2xl text-left overflow-hidden shadow-2xl transform transition-all sm:max-w-4xl w-full border border-slate-200 flex flex-col max-h-[90vh]">
          {/* Header */}
          <div className="bg-slate-900 px-6 py-4 flex justify-between items-center shrink-0 border-b border-white/10">
            <div className="flex items-center gap-3 truncate max-w-[70%]">
              <div className="p-2 bg-indigo-500/20 rounded-lg">
                {isPdf ? <FileText className="w-5 h-5 text-indigo-400" /> : <ImageIcon className="w-5 h-5 text-indigo-400" />}
              </div>
              <div>
                <h3 className="text-white text-sm font-bold truncate">{title}</h3>
                <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest leading-none mt-1">Receipt Viewer</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <a
                href={imageUrl}
                download={`receipt-${title.replace(/\s+/g, '_')}.${isPdf ? 'pdf' : 'png'}`}
                className="bg-white/5 text-slate-300 hover:text-white hover:bg-white/20 rounded-xl p-2.5 transition-all active:scale-95"
                onClick={(e: React.MouseEvent) => e.stopPropagation()}
                title="Download"
              >
                <Download className="w-5 h-5" />
              </a>
              <button
                onClick={onClose}
                className="bg-white/5 text-slate-300 hover:text-white hover:bg-white/20 rounded-xl p-2.5 transition-all active:scale-95"
                title="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Content Area */}
          <div className="relative w-full flex-1 bg-slate-50 flex items-center justify-center p-6 overflow-auto min-h-[60vh]">
            {loading && !error && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-50 z-10">
                <Loader2 className="w-10 h-10 text-indigo-600 animate-spin mb-4" />
                <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Loading sensitive data...</p>
              </div>
            )}

            {error && (
              <div className="flex flex-col items-center justify-center p-12 text-center">
                <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mb-4">
                  <AlertCircle className="w-8 h-8 text-red-500" />
                </div>
                <h4 className="text-lg font-bold text-slate-900">Unable to display image</h4>
                <p className="text-sm text-slate-500 mt-2 max-w-xs">This might be due to local privacy restrictions or an invalid file format.</p>
                <a
                  href={imageUrl}
                  download={`receipt-${title}.${isPdf ? 'pdf' : 'png'}`}
                  className="mt-6 px-6 py-2 bg-indigo-600 text-white text-xs font-black uppercase tracking-widest rounded-full hover:bg-indigo-700 transition-colors"
                >
                  Download Original
                </a>
              </div>
            )}

            {isPdf ? (
              <iframe
                src={imageUrl}
                className={`w-full h-[75vh] border-0 bg-white rounded-xl shadow-lg transition-opacity duration-300 ${loading ? 'opacity-0' : 'opacity-100'}`}
                title="PDF Viewer"
                onLoad={() => setLoading(false)}
                onError={() => { setError(true); setLoading(false); }}
              />
            ) : (
              <div className={`flex items-center justify-center w-full h-full transition-opacity duration-300 ${loading ? 'opacity-0' : 'opacity-100'}`}>
                <img
                  src={imageUrl}
                  alt="Receipt"
                  className="max-w-full max-h-[75vh] object-contain shadow-2xl rounded-lg bg-white"
                  onLoad={() => setLoading(false)}
                  onError={() => { setError(true); setLoading(false); }}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ImageViewer;