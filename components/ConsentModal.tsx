
import React, { useState } from 'react';
import { ShieldCheck, Info, FileText, Database, Trash2, Eye, Lock, CheckCircle2 } from 'lucide-react';
import { UserProfile } from '../types';

interface ConsentModalProps {
    isOpen: boolean;
    onAccept: () => void;
    user: UserProfile;
    onViewLegal: (type: 'privacy' | 'terms') => void;
}

const ConsentModal: React.FC<ConsentModalProps> = ({ isOpen, onAccept, user, onViewLegal }) => {
    const [step, setStep] = useState(1);

    if (!isOpen) return null;

    const DATA_ITEMS = [
        {
            icon: <FileText className="w-5 h-5 text-indigo-600" />,
            title: "What we collect",
            desc: "Only the data found on your receipts: Merchant name, date, totals, and line items."
        },
        {
            icon: <Eye className="w-5 h-5 text-emerald-600" />,
            title: "How we use it",
            desc: "We use Google Gemini AI to extract data and build your expense analytics dashboard."
        },
        {
            icon: <Database className="w-5 h-5 text-amber-600" />,
            title: "Where it's stored",
            desc: "Your data is stored securely in your private Supabase database instance."
        },
        {
            icon: <Trash2 className="w-5 h-5 text-rose-600" />,
            title: "You're in control",
            desc: "You can view, edit, or permanently delete any of your data at any time."
        }
    ];

    return (
        <div className="fixed inset-0 z-[100] overflow-y-auto" role="dialog" aria-modal="true">
            <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-md transition-opacity" aria-hidden="true" />

                <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>

                <div className="inline-block align-middle bg-white rounded-3xl text-left overflow-hidden shadow-2xl transform transition-all sm:max-w-xl w-full border border-slate-100 animate-scaleIn">
                    <div className="p-8 sm:p-10">
                        {/* Header */}
                        <div className="flex items-center gap-4 mb-8">
                            <div className="p-3 bg-indigo-50 rounded-2xl">
                                <ShieldCheck className="w-8 h-8 text-indigo-600" />
                            </div>
                            <div>
                                <h2 className="text-2xl font-black text-slate-900 tracking-tight">Your Privacy Matters</h2>
                                <p className="text-slate-500 font-medium">Please review our data usage policy.</p>
                            </div>
                        </div>

                        {/* Content */}
                        <div className="space-y-6 mb-10">
                            {DATA_ITEMS.map((item, idx) => (
                                <div key={idx} className="flex gap-4 p-4 rounded-2xl bg-slate-50 border border-slate-100 transition-all hover:bg-white hover:shadow-md hover:shadow-slate-100 group">
                                    <div className="shrink-0 p-2 bg-white rounded-xl shadow-sm border border-slate-100 group-hover:scale-110 transition-transform">
                                        {item.icon}
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-slate-900 mb-0.5">{item.title}</h3>
                                        <p className="text-sm text-slate-500 leading-relaxed font-medium">{item.desc}</p>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Footer Info */}
                        <div className="bg-indigo-50/50 p-4 rounded-2xl border border-indigo-100/50 flex gap-3 mb-10">
                            <Lock className="w-5 h-5 text-indigo-500 shrink-0 mt-0.5" />
                            <p className="text-xs text-indigo-700/80 font-medium leading-relaxed">
                                We never sell your data. We use industry-standard encryption to protect your information at rest and in transit.
                            </p>
                        </div>

                        {/* Action */}
                        <button
                            onClick={onAccept}
                            className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-2xl transition-all shadow-xl shadow-indigo-100 active:scale-[0.98] flex items-center justify-center gap-3 group"
                        >
                            <span>I Understand & Agree</span>
                            <CheckCircle2 className="w-5 h-5 group-hover:rotate-12 transition-transform" />
                        </button>

                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest text-center mt-6 leading-loose">
                            By clicking, you consent to our <button onClick={() => onViewLegal('privacy')} className="text-indigo-500 hover:underline">Privacy Policy</button> <br /> and <button onClick={() => onViewLegal('terms')} className="text-indigo-500 hover:underline">Terms of Service</button>.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ConsentModal;
