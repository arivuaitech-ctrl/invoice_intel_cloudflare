
import React from 'react';
import { UserProfile } from '../types';
import { userService } from '../services/userService';
import { stripeService } from '../services/stripeService';
import { X, LogOut, CreditCard, Mail, User, ShieldCheck, Zap, Lock, LifeBuoy, ChevronDown, HelpCircle, BookOpen, MapPin, Calculator, Briefcase, Cpu, Globe } from 'lucide-react';

interface ProfileModalProps {
    isOpen: boolean;
    onClose: () => void;
    user: UserProfile;
    onLogout: () => void;
    onUpdate: (updatedUser: UserProfile) => void;
}

const FAQItem: React.FC<{ question: string; answer: string }> = ({ question, answer }) => {
    const [isOpen, setIsOpen] = React.useState(false);

    return (
        <div className="border-b border-indigo-100/30 last:border-0 pb-3 last:pb-0">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center justify-between w-full text-left group"
            >
                <span className="text-xs font-bold text-slate-700 group-hover:text-indigo-600 transition-colors">{question}</span>
                <ChevronDown className={`w-3 h-3 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>
            {isOpen && (
                <p className="mt-1.5 text-[11px] leading-relaxed text-slate-500 font-medium bg-white/50 p-2 rounded-lg border border-slate-50">
                    {answer}
                </p>
            )}
        </div>
    );
};

const ProfileModal: React.FC<ProfileModalProps> = ({ isOpen, onClose, user, onLogout, onUpdate }) => {
    if (!isOpen) return null;

    const [editingLimit, setEditingLimit] = React.useState(false);
    const [tempLimit, setTempLimit] = React.useState<number | string>(user.customUsageLimit || '');

    React.useEffect(() => {
        setTempLimit(user.customUsageLimit || '');
    }, [user.customUsageLimit]);

    const handleCustomerPortal = async () => {
        if (user.stripeCustomerId) {
            await stripeService.redirectToCustomerPortal(user.stripeCustomerId);
        }
    };

    const saveCustomLimit = async () => {
        try {
            const val = tempLimit === '' ? null : Number(tempLimit);
            if (val !== null && val < 500) {
                alert("Limit cannot be less than the base (500).");
                return;
            }
            const updatedUser = await userService.updateCustomLimit(user.id, val);
            onUpdate(updatedUser);
            setEditingLimit(false);
        } catch (e) {
            console.error(e);
            alert("Failed to update limit");
        }
    };

    const remainingDocs = user.monthlyDocsLimit - user.docsUsedThisMonth;
    const usagePercent = Math.min(100, Math.max(0, (user.docsUsedThisMonth / user.monthlyDocsLimit) * 100));

    return (
        <div className="fixed inset-0 z-[80] overflow-y-auto" role="dialog" aria-modal="true">
            <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
                <div
                    className="fixed inset-0 bg-slate-900/60 backdrop-blur-md transition-opacity"
                    aria-hidden="true"
                    onClick={onClose}
                ></div>

                <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>

                <div className="inline-block align-middle bg-white rounded-3xl text-left overflow-hidden shadow-2xl transform transition-all sm:my-8 sm:max-w-lg w-full border border-slate-100 mb-20 sm:mb-8">
                    <div className="relative">
                        {/* Header Image/Pattern */}
                        <div className="h-32 bg-gradient-to-br from-indigo-600 to-violet-600 relative overflow-hidden">
                            <div className="absolute inset-0 opacity-10">
                                <Zap className="w-64 h-64 -right-16 -bottom-16 absolute rotate-12" />
                            </div>
                            <button
                                onClick={onClose}
                                className="absolute top-4 right-4 text-white/80 hover:text-white p-2 hover:bg-white/10 rounded-full transition-all"
                            >
                                <X className="w-6 h-6" />
                            </button>
                        </div>

                        {/* Profile Info Section */}
                        <div className="px-8 pb-8 -mt-12 text-center relative z-10">
                            <div className="inline-flex items-center justify-center w-24 h-24 bg-white rounded-3xl shadow-xl border-4 border-white mb-4">
                                <User className="w-12 h-12 text-indigo-600" />
                            </div>
                            <h2 className="text-2xl font-black text-slate-800 tracking-tight">{user.name}</h2>
                            <div className="flex items-center justify-center gap-2 text-slate-500 mt-1">
                                <Mail className="w-4 h-4" />
                                <span className="text-sm font-medium">{user.email}</span>
                            </div>

                            {user.isAdmin && (
                                <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-1 bg-purple-50 border border-purple-100 rounded-full text-[10px] font-black uppercase tracking-widest text-purple-600">
                                    <ShieldCheck className="w-3 h-3" />
                                    Admin Account
                                </div>
                            )}
                        </div>

                        {/* Subscription & Usage Section */}
                        <div className="px-8 space-y-6">
                            <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100">
                                <div className="flex justify-between items-center mb-4">
                                    <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Subscription Plan</h3>
                                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${user.planId === 'free' ? 'bg-slate-200 text-slate-600' : 'bg-indigo-100 text-indigo-600'
                                        }`}>
                                        {user.planId}
                                    </span>
                                </div>

                                <div className="space-y-4">
                                    <div className="flex justify-between items-end">
                                        <div className="space-y-1">
                                            <p className="text-sm font-bold text-slate-600">Document Usage</p>
                                            <p className="text-xs text-slate-400 font-medium">
                                                {user.docsUsedThisMonth} of {user.monthlyDocsLimit} monthly limit
                                            </p>
                                        </div>
                                        <p className="text-xl font-black text-slate-800">
                                            {remainingDocs > 0 ? remainingDocs : 0} <span className="text-[10px] text-slate-400 uppercase">left</span>
                                        </p>
                                    </div>

                                    {/* Business Metered UI */}
                                    {user.planId === 'business' && (
                                        <div className="bg-indigo-50/50 rounded-xl p-3 border border-indigo-100/50 mt-2">
                                            <div className="flex justify-between items-center">
                                                <span className="text-xs font-bold text-indigo-700">Total Usage Limit</span>
                                                {!editingLimit ? (
                                                    <button onClick={() => setEditingLimit(true)} className="text-[10px] font-black uppercase text-indigo-500 hover:text-indigo-700">Change Cap</button>
                                                ) : (
                                                    <div className="flex gap-2">
                                                        <button onClick={saveCustomLimit} className="text-[10px] font-black uppercase text-emerald-600">Save</button>
                                                        <button onClick={() => setEditingLimit(false)} className="text-[10px] font-black uppercase text-slate-400">Cancel</button>
                                                    </div>
                                                )}
                                            </div>

                                            {editingLimit ? (
                                                <input
                                                    type="number"
                                                    className="w-full mt-2 p-1.5 text-xs border rounded-lg"
                                                    placeholder="No Limit"
                                                    value={tempLimit}
                                                    onChange={(e) => setTempLimit(e.target.value)}
                                                />
                                            ) : (
                                                <p className="text-xs text-indigo-600 mt-1">
                                                    Hard Cap: <span className="font-bold">{user.customUsageLimit ? user.customUsageLimit : 'None (Unlimited)'}</span>
                                                </p>
                                            )}
                                            <p className="text-[10px] text-slate-400 mt-1 leading-tight font-medium">
                                                Overage charges ($5 for every extra 100 receipts) apply for usage above 500 up to your Hard Cap.
                                            </p>
                                        </div>
                                    )}

                                    <div className="h-2 w-full bg-slate-200 rounded-full overflow-hidden">
                                        <div
                                            className={`h-full transition-all duration-500 rounded-full ${usagePercent > 90 ? 'bg-red-500' : usagePercent > 70 ? 'bg-amber-500' : 'bg-indigo-600'
                                                }`}
                                            style={{ width: `${usagePercent}%` }}
                                        ></div>
                                    </div>
                                </div>
                            </div>

                            {/* Actions Section */}
                            <div className="grid grid-cols-1 gap-3">
                                {user.planId === 'free' && !user.isAdmin && (
                                    <button
                                        onClick={() => { onClose(); window.dispatchEvent(new CustomEvent('open-pricing')); }}
                                        className="flex items-center justify-center gap-3 w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-2xl transition-all shadow-lg shadow-indigo-100 active:scale-[0.98]"
                                    >
                                        <Zap className="w-5 h-5" />
                                        Upgrade to Premium
                                    </button>
                                )}

                                {user.stripeCustomerId && (
                                    <button
                                        onClick={handleCustomerPortal}
                                        className="flex items-center justify-center gap-3 w-full py-4 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-bold rounded-2xl transition-all shadow-sm active:scale-[0.98]"
                                    >
                                        <CreditCard className="w-5 h-5 text-indigo-600" />
                                        Manage Billing & Subscription
                                    </button>
                                )}

                                <button
                                    onClick={() => {
                                        const subject = encodeURIComponent(`Support Request - ${user.email}`);
                                        window.location.href = `mailto:arivu.ai.tech@gmail.com?subject=${subject}`;
                                    }}
                                    className="flex items-center justify-center gap-3 w-full py-4 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-bold rounded-2xl transition-all shadow-sm active:scale-[0.98]"
                                >
                                    <LifeBuoy className="w-5 h-5 text-slate-400" />
                                    Contact Support
                                </button>

                                <button
                                    onClick={onLogout}
                                    className="flex items-center justify-center gap-3 w-full py-4 bg-white hover:bg-red-50 border border-slate-200 hover:border-red-100 text-slate-600 hover:text-red-600 font-bold rounded-2xl transition-all shadow-sm active:scale-[0.98]"
                                >
                                    <LogOut className="w-5 h-5" />
                                    Sign Out
                                </button>
                            </div>
                        </div>

                        {/* Use Cases Section */}
                        <div className="px-8 mt-6">
                            <div className="p-6 bg-indigo-50/30 rounded-2xl border border-indigo-100/30">
                                <div className="flex items-center gap-2 mb-4">
                                    <Cpu className="w-4 h-4 text-indigo-500" />
                                    <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-500">From the Creators: ARIVU-AI</h3>
                                </div>
                                <div className="mb-6 pb-6 border-b border-indigo-100/30">
                                    <p className="text-[11px] text-slate-600 font-medium leading-relaxed">
                                        <span className="font-bold text-indigo-600">Arivu</span> stands for <span className="italic">Intelligence</span> in Tamil. As part of a team with 15+ years in Data & Insights, ARIVU-AI creates tools to empower Malaysians and global citizens to focus on human creativity rather than repetitive tasks.
                                    </p>
                                </div>

                                <div className="flex items-center gap-2 mb-4">
                                    <BookOpen className="w-4 h-4 text-indigo-500" />
                                    <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-500">How to use Invoice Intel</h3>
                                </div>
                                <div className="grid grid-cols-1 gap-4">
                                    <div className="flex gap-4">
                                        <div className="w-10 h-10 shrink-0 bg-white rounded-xl shadow-sm border border-slate-100 flex items-center justify-center">
                                            <Briefcase className="w-5 h-5 text-indigo-500" />
                                        </div>
                                        <div>
                                            <h4 className="text-xs font-bold text-slate-800">Professional travel</h4>
                                            <p className="text-[10px] text-slate-500 font-medium leading-relaxed mt-1">Perfect for professionals who need to group hotel, meal, and transport receipts for company reimbursement.</p>
                                        </div>
                                    </div>
                                    <div className="flex gap-4">
                                        <div className="w-10 h-10 shrink-0 bg-white rounded-xl shadow-sm border border-slate-100 flex items-center justify-center">
                                            <Calculator className="w-5 h-5 text-emerald-500" />
                                        </div>
                                        <div>
                                            <h4 className="text-xs font-bold text-slate-800">Tax optimization</h4>
                                            <p className="text-[10px] text-slate-500 font-medium leading-relaxed mt-1">Keep medical, utility, and house tax receipts organized all year round for seamless tax filing.</p>
                                        </div>
                                    </div>
                                    <div className="flex gap-4">
                                        <div className="w-10 h-10 shrink-0 bg-white rounded-xl shadow-sm border border-slate-100 flex items-center justify-center">
                                            <MapPin className="w-5 h-5 text-rose-500" />
                                        </div>
                                        <div>
                                            <h4 className="text-xs font-bold text-slate-800">Local tracking</h4>
                                            <p className="text-[10px] text-slate-500 font-medium leading-relaxed mt-1">Smart currency detection makes it ideal for global exploration or domestic bookkeeping.</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* FAQ Section */}
                        <div className="px-8 mt-6">
                            <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100">
                                <div className="flex items-center gap-2 mb-4">
                                    <HelpCircle className="w-4 h-4 text-slate-400" />
                                    <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Frequently Asked Questions</h3>
                                </div>
                                <div className="space-y-4">
                                    <FAQItem
                                        question="Where are my images stored?"
                                        answer="For your total privacy, receipt images are stored ONLY in your local browser. They are never uploaded to our servers, ensuring your sensitive data stays on your device."
                                    />
                                    <FAQItem
                                        question="Why are images missing on other devices?"
                                        answer="Since images are stored locally, they won't follow you to different browsers or computers. You'll see the expense data, but not the images."
                                    />
                                    <FAQItem
                                        question="How do I cancel my subscription?"
                                        answer="Click 'Manage Billing' above to be redirected to the secure Stripe portal where you can cancel or change your plan anytime."
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Footer Security Note */}
                        <div className="p-8 text-center">
                            <div className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-300">
                                <Lock className="w-3 h-3" />
                                Secure Account Management
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ProfileModal;
