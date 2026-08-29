import React from 'react';
import { 
  X, 
  DownloadCloud, 
  BookOpen, 
  Trash2, 
  Eye, 
  HardDrive, 
  WifiOff, 
  CheckCircle2, 
  FileText 
} from 'lucide-react';
import { StudyMaterial } from '../types';

interface OfflineVaultDrawerProps {
  savedMaterials: StudyMaterial[];
  onOpenReader: (material: StudyMaterial) => void;
  onRemoveOffline: (materialId: string) => void;
  onClose: () => void;
}

export const OfflineVaultDrawer: React.FC<OfflineVaultDrawerProps> = ({
  savedMaterials,
  onOpenReader,
  onRemoveOffline,
  onClose
}) => {
  const totalKb = savedMaterials.reduce((acc, m) => acc + m.fileSizeKb, 0);
  const totalMb = (totalKb / 1024).toFixed(1);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-xs animate-fadeIn">
      <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[85vh]">
        
        {/* Drawer Header */}
        <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-emerald-600 text-white">
              <DownloadCloud className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">
                Offline Study Vault
              </h2>
              <p className="text-xs text-slate-400">
                PWA Local Cache • Readable without internet data
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Memory Storage Meter */}
        <div className="p-4 bg-slate-50 border-b border-slate-200">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-700 mb-1.5">
            <div className="flex items-center gap-1.5">
              <HardDrive className="w-4 h-4 text-emerald-600" />
              <span>Device Storage Used</span>
            </div>
            <span className="font-bold text-slate-900">{totalMb} MB / 50 MB Cache</span>
          </div>

          <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
            <div 
              className="bg-emerald-600 h-full rounded-full transition-all"
              style={{ width: `${Math.min(100, (Number(totalMb) / 50) * 100)}%` }}
            />
          </div>
        </div>

        {/* Saved Materials List */}
        <div className="p-4 overflow-y-auto flex-1 space-y-3">
          {savedMaterials.length === 0 ? (
            <div className="text-center py-10 space-y-3">
              <WifiOff className="w-10 h-10 text-slate-300 mx-auto" />
              <h3 className="text-sm font-bold text-slate-700">
                No materials saved offline yet
              </h3>
              <p className="text-xs text-slate-500 max-w-xs mx-auto">
                Click the download icon on any study material to save it for zero-data reading inside examination halls or low-network areas.
              </p>
            </div>
          ) : (
            savedMaterials.map((mat) => (
              <div
                key={mat.id}
                className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-slate-50 transition-colors flex items-center justify-between gap-3"
              >
                <div className="space-y-1 truncate">
                  <div className="flex items-center gap-1.5">
                    <span className="px-1.5 py-0.2 rounded bg-slate-900 text-white text-[10px] font-bold">
                      {mat.institutionId}
                    </span>
                    <span className="text-xs font-bold text-slate-900 truncate">
                      {mat.courseCode}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 truncate">
                    {mat.title}
                  </p>
                  <span className="text-[10px] text-emerald-700 font-semibold block">
                    {(mat.fileSizeKb / 1024).toFixed(2)} MB • {mat.pageCount} pages cached
                  </span>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={() => onOpenReader(mat)}
                    className="p-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-colors flex items-center gap-1"
                    title="Read Offline"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Read</span>
                  </button>

                  <button
                    onClick={() => onRemoveOffline(mat.id)}
                    className="p-2 text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                    title="Remove from Offline Cache"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 flex items-center justify-between">
          <span className="text-xs text-slate-500">
            {savedMaterials.length} Study Packs Available Offline
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-900 text-white hover:bg-slate-800 rounded-xl text-xs font-bold transition-colors"
          >
            Close Vault
          </button>
        </div>

      </div>
    </div>
  );
};
