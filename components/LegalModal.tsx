
import React from 'react';
import { X, Shield, Scale, Lock, Globe, Mail } from 'lucide-react';

interface LegalModalProps {
    isOpen: boolean;
    onClose: () => void;
    type: 'privacy' | 'terms';
}

const LegalModal: React.FC<LegalModalProps> = ({ isOpen, onClose, type }) => {
    if (!isOpen) return null;

    const isPrivacy = type === 'privacy';

    return (
        <div className="fixed inset-0 z-[110] overflow-y-auto" role="dialog" aria-modal="true">
            <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md transition-opacity" aria-hidden="true" onClick={onClose} />

                <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>

                <div className="inline-block align-middle bg-white rounded-3xl text-left overflow-hidden shadow-2xl transform transition-all sm:max-w-2xl w-full border border-slate-100 pb-8">
                    {/* Header */}
                    <div className="sticky top-0 bg-white/80 backdrop-blur-md px-8 py-6 border-b border-slate-100 flex justify-between items-center z-10">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-indigo-50 rounded-xl">
                                {isPrivacy ? <Shield className="w-5 h-5 text-indigo-600" /> : <Scale className="w-5 h-5 text-indigo-600" />}
                            </div>
                            <h2 className="text-xl font-black text-slate-900 tracking-tight">
                                {isPrivacy ? "Privacy Policy" : "Terms of Service"}
                            </h2>
                        </div>
                        <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                            <X className="w-6 h-6 text-slate-400" />
                        </button>
                    </div>

                    {/* Content */}
                    <div className="px-8 py-8 h-[60vh] overflow-y-auto prose prose-slate prose-sm max-w-none scroll-smooth">
                        {isPrivacy ? (
                            <div className="space-y-8">
                                <section>
                                    <h3 className="text-lg font-bold text-slate-900 mb-3 flex items-center gap-2">
                                        <Globe className="w-4 h-4 text-indigo-500" />
                                        1. Introduction</h3>
                                    <p className="text-slate-600 leading-relaxed font-medium">
                                        At InvoiceIntel, we respect your privacy and are committed to protecting your personal data. This privacy policy will inform you as to how we look after your personal data when you visit our website and tell you about your privacy rights and how the law protects you.
                                    </p>
                                </section>

                                <section>
                                    <h3 className="text-lg font-bold text-slate-900 mb-3">2. The Data We Collect</h3>
                                    <p className="text-slate-600 leading-relaxed font-medium mb-3">
                                        We collect and process the following data to provide our AI-powered expense tracking services:
                                    </p>
                                    <ul className="list-disc pl-5 text-slate-600 space-y-2 font-medium">
                                        <li><strong>Account Data:</strong> Email address and name provided during sign-up.</li>
                                        <li><strong>Receipt Data:</strong> Merchant name, date, amount, currency, and line items extracted from your uploaded images.</li>
                                        <li><strong>Usage Data:</strong> Information about how you use our application to improve our services.</li>
                                        <li><strong>Consent Data:</strong> Proof of your agreement to these terms (Timestamp, Policy Version, and anonymized IP).</li>
                                    </ul>
                                </section>

                                <section>
                                    <h3 className="text-lg font-bold text-slate-900 mb-3">3. How We Use Your Data</h3>
                                    <p className="text-slate-600 leading-relaxed font-medium mb-3">
                                        We use Google Gemini AI to analyze your receipt images. Your data is used specifically for:
                                    </p>
                                    <ul className="list-disc pl-5 text-slate-600 space-y-2 font-medium">
                                        <li>Converting images into structured expense records.</li>
                                        <li>Generating your financial analytics and budget reports.</li>
                                        <li>Managing your subscription and usage limits.</li>
                                    </ul>
                                </section>

                                <section>
                                    <h3 className="text-lg font-bold text-slate-900 mb-3 flex items-center gap-2">
                                        <Lock className="w-4 h-4 text-emerald-500" />
                                        4. Data Security</h3>
                                    <p className="text-slate-600 leading-relaxed font-medium">
                                        We have put in place appropriate security measures to prevent your personal data from being accidentally lost, used or accessed in an unauthorized way. Your data is stored in secure, private database instances (Supabase) and is encrypted at rest and in transit.
                                    </p>
                                </section>

                                <section>
                                    <h3 className="text-lg font-bold text-slate-900 mb-3">5. Data Deletion</h3>
                                    <p className="text-slate-600 leading-relaxed font-medium">
                                        You have the right to delete your data at any time. When you click delete on an expense, the record and the associated image are permanently removed from our servers.
                                    </p>
                                </section>
                            </div>
                        ) : (
                            <div className="space-y-8">
                                <section>
                                    <h3 className="text-lg font-bold text-slate-900 mb-3">1. Agreement to Terms</h3>
                                    <p className="text-slate-600 leading-relaxed font-medium">
                                        By accessing or using InvoiceIntel, you agree to be bound by these Terms of Service. If you disagree with any part of the terms, you may not access the service.
                                    </p>
                                </section>

                                <section>
                                    <h3 className="text-lg font-bold text-slate-900 mb-3">2. Description of Service</h3>
                                    <p className="text-slate-600 leading-relaxed font-medium">
                                        InvoiceIntel provides AI-powered OCR (Optical Character Recognition) services to extract data from financial documents. We do not provide financial advice.
                                    </p>
                                </section>

                                <section>
                                    <h3 className="text-lg font-bold text-slate-900 mb-3">3. Subscriptions</h3>
                                    <p className="text-slate-600 leading-relaxed font-medium">
                                        Certain parts of the service are billed on a subscription basis. You will be billed in advance on a recurring and periodic basis. Subscription fees are based on the monthly document processing limits of your chosen plan.
                                    </p>
                                </section>

                                <section>
                                    <h3 className="text-lg font-bold text-slate-900 mb-3">4. User Responsibilities</h3>
                                    <p className="text-slate-600 leading-relaxed font-medium">
                                        You are responsible for the accuracy of the documents you upload and for maintaining the security of your account. You agree not to use the service for any illegal or unauthorized purpose.
                                    </p>
                                </section>

                                <section>
                                    <h3 className="text-lg font-bold text-slate-900 mb-3">5. Termination</h3>
                                    <p className="text-slate-600 leading-relaxed font-medium">
                                        We may terminate or suspend your account immediately, without prior notice or liability, for any reason whatsoever, including without limitation if you breach the Terms.
                                    </p>
                                </section>
                            </div>
                        )}

                        <div className="mt-12 p-6 bg-slate-50 rounded-2xl border border-slate-100 flex items-start gap-4">
                            <div className="p-2 bg-white rounded-lg shadow-sm">
                                <Mail className="w-4 h-4 text-slate-400" />
                            </div>
                            <div>
                                <h4 className="font-bold text-slate-800 text-sm">Have questions?</h4>
                                <p className="text-xs text-slate-500 font-medium mt-1">
                                    Contact our legal team at <a href="mailto:arivu.ai.tech@gmail.com" className="text-indigo-600 font-bold hover:underline">arivu.ai.tech@gmail.com</a>
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default LegalModal;
