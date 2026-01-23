
import React, { useState, useEffect, useRef } from 'react';
import { X, Download, AlertCircle, Loader2 } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

interface ImageViewerProps {
  isOpen: boolean;
  onClose: () => void;
  imageUrl?: string;
  title: string;
}

const ImageViewer = ({ isOpen, onClose, imageUrl, title }: ImageViewerProps) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [safeUrl, setSafeUrl] = useState<string | null>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    if (isOpen && imageUrl) {
      console.log(`[ImageViewer] Opening. Original URL length: ${imageUrl.length}`);
      setLoading(true);
      setError(false);

      let objectUrl: string | null = null;

      // Optimization: Convert Data URL to Blob URL for more efficient browser rendering
      if (imageUrl.startsWith('data:')) {
        try {
          const parts = imageUrl.split(',');
          const mime = parts[0].match(/:(.*?);/)?.[1] || 'image/jpeg';
          const bstr = atob(parts[1]);
          let n = bstr.length;
          const u8arr = new Uint8Array(n);
          while (n--) {
            u8arr[n] = bstr.charCodeAt(n);
          }
          const blob = new Blob([u8arr], { type: mime });
          objectUrl = URL.createObjectURL(blob);
          setSafeUrl(objectUrl);
          console.log(`[ImageViewer] Created Blob URL: ${objectUrl}`);
        } catch (e) {
          console.error('[ImageViewer] Error creating blob URL, falling back to original:', e);
          setSafeUrl(imageUrl);
        }
      } else {
        setSafeUrl(imageUrl);
      }

      // Safety timeout
      const timer = setTimeout(() => {
        // Double check if image is actually loaded but onLoad didn't fire
        if (imgRef.current?.complete && imgRef.current?.naturalWidth > 0) {
          console.log('[ImageViewer] Image detected as complete via Ref after timeout');
          setLoading(false);
          return;
        }

        if (loading && !error) {
          console.warn('[ImageViewer] Loading timed out after 10s');
          setError(true);
          setLoading(false);
        }
      }, 10000);

      return () => {
        if (objectUrl) {
          console.log(`[ImageViewer] Revoking Blob URL: ${objectUrl}`);
          URL.revokeObjectURL(objectUrl);
        }
        clearTimeout(timer);
      };
    } else {
      setSafeUrl(null);
    }
  }, [isOpen, imageUrl]);

  // Early check if image is already complete (for cached images)
  useEffect(() => {
    if (safeUrl && imgRef.current?.complete && loading) {
      console.log('[ImageViewer] Image already complete on render');
      setLoading(false);
    }
  }, [safeUrl]);

  if (!isOpen || !imageUrl) return null;

  const isPdf = imageUrl.toLowerCase().startsWith('data:application/pdf');

  const handleDownload = async () => {
    if (Capacitor.isNativePlatform() && safeUrl) {
      try {
        const fileName = `receipt-${title.toLowerCase().replace(/\s+/g, '-')}.${isPdf ? 'pdf' : 'jpg'}`;
        // For data URLs, we can parse them directly
        let data = safeUrl;
        if (safeUrl.startsWith('data:')) {
          // Keep as is
        } else {
          // Assuming it's a blob url or remote, might be tricky. 
          // For now, our safeUrl is usually a blob URL which Filesystem can't read directly unless we fetch it.
          // However, looking at App.tsx, the imageData is stored as base64 data URI!
          // So if safeUrl is a blob URL, we might need the original 'imageUrl' which IS the data URI.
          data = imageUrl;
        }

        // Strip prefix for filesystem write
        const base64Data = data.split(',')[1];

        const savedFile = await Filesystem.writeFile({
          path: fileName,
          data: base64Data,
          directory: Directory.Cache
        });

        await Share.share({
          url: savedFile.uri,
        });
      } catch (err) {
        console.warn("Native share cancelled or failed:", err);
        // alert("Failed to share file."); // Suppress alert for better UX on cancel
      }
    } else {
      const link = document.createElement('a');
      link.href = imageUrl;
      link.download = `receipt-${title.toLowerCase().replace(/\s+/g, '-')}.${isPdf ? 'pdf' : 'jpg'}`;
      link.click();
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 backdrop-blur-md p-4 transition-all animate-in fade-in duration-300">
      <div className="relative w-full max-w-4xl max-h-[90vh] flex flex-col items-center">
        {/* Header */}
        <div className="absolute -top-14 left-0 right-0 flex justify-between items-center text-white/90 px-4 py-2">
          <div className="flex flex-col">
            <h3 className="text-sm font-black tracking-tight uppercase">{title}</h3>
            <p className="text-[10px] text-white/40 font-bold uppercase tracking-widest mt-0.5">Secure Local View</p>
          </div>
          <div className="flex gap-4">
            <button
              onClick={handleDownload}
              className="p-2.5 bg-white/5 hover:bg-white/10 rounded-2xl transition-all border border-white/5 hover:border-white/10"
              title="Download"
            >
              <Download className="w-5 h-5" />
            </button>
            <button
              onClick={onClose}
              className="p-2.5 bg-white/5 hover:bg-white/10 rounded-2xl transition-all border border-white/5 hover:border-white/10"
              title="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Display Area */}
        <div className="w-full h-full min-h-[400px] flex items-center justify-center relative overflow-hidden rounded-[2rem] bg-slate-900 border border-white/10 shadow-2xl">
          {loading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-white/50 bg-slate-900 z-50">
              <Loader2 className="w-10 h-10 animate-spin mb-4 text-indigo-500" />
              <div className="text-center">
                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-white">Opening Receipt</p>
                <p className="text-[9px] font-bold text-slate-500 mt-1 uppercase tracking-widest">Hydrating from locally stored data...</p>
              </div>
            </div>
          )}

          {error && (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-12 text-white bg-slate-900 z-50">
              <div className="w-20 h-20 bg-rose-500/10 rounded-3xl flex items-center justify-center mb-6 border border-rose-500/20">
                <AlertCircle className="w-10 h-10 text-rose-500" />
              </div>
              <h4 className="text-xl font-black mb-3">Silent Rendering Failure</h4>
              <p className="text-sm text-slate-400 max-w-sm mb-8 font-medium leading-relaxed">
                Your browser is struggling to render this image locally, likely due to high resolution or strict memory limits.
                <br /><span className="text-indigo-400 mt-2 block">Don't worry, your data is safe.</span>
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <button
                  onClick={handleDownload}
                  className="px-8 py-3 bg-white text-slate-900 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-indigo-50 transition-all flex items-center justify-center gap-3 shadow-lg shadow-indigo-500/10"
                >
                  <Download className="w-5 h-5" />
                  Download to View
                </button>
                <button
                  onClick={onClose}
                  className="px-8 py-3 bg-slate-800 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-700 transition-all border border-white/5"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {safeUrl && (
            isPdf ? (
              <iframe
                ref={iframeRef}
                src={safeUrl}
                className={`w-full h-[75vh] border-0 bg-white shadow-inner transition-all duration-500 ${loading ? 'scale-95 opacity-0' : 'scale-100 opacity-100'}`}
                onLoad={() => {
                  console.log('[ImageViewer] PDF Load success');
                  setLoading(false);
                }}
                title="PDF Viewer"
              />
            ) : (
              <img
                ref={imgRef}
                src={safeUrl}
                alt="Receipt"
                className={`max-w-full max-h-[75vh] object-contain transition-all duration-500 ${loading ? 'scale-95 opacity-0' : 'scale-100 opacity-100'}`}
                onLoad={() => {
                  console.log('[ImageViewer] Image Load success');
                  setLoading(false);
                }}
                onError={(e) => {
                  console.error('[ImageViewer] Image Load error event triggered', e);
                  setError(true);
                  setLoading(false);
                }}
              />
            )
          )}
        </div>
      </div>
    </div>
  );
};

export default ImageViewer;