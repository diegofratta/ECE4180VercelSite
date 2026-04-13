import React from 'react';

interface PartnerCheckoffModalProps {
  isOpen: boolean;
  studentName: string;
  partnerName: string;
  onConfirm: (alsoCheckoffPartner: boolean) => void;
  onCancel: () => void;
}

const PartnerCheckoffModal: React.FC<PartnerCheckoffModalProps> = ({
  isOpen,
  studentName,
  partnerName,
  onConfirm,
  onCancel
}) => {
  const [alsoCheckoffPartner, setAlsoCheckoffPartner] = React.useState(false);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-md overflow-hidden animate-scale-in">
        <div className="bg-gradient-gt p-4 flex items-center gap-2">
          {/* Header */}
          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
          <h3 className="font-semibold text-lg text-white">Partner Checkoff</h3>
        </div>

        <div className="p-6">
          <p className="text-gray-700 dark:text-gray-300 mb-4">
            Checking off <span className="font-semibold text-gray-900 dark:text-white">{studentName}</span>
          </p>

          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-4">
            <p className="text-blue-800 dark:text-blue-300 text-sm mb-3">
              This student has a lab partner:
            </p>
            <div className="flex items-center gap-3">
              <div className="bg-blue-500 dark:bg-blue-600 text-white rounded-full w-10 h-10 flex items-center justify-center font-bold shadow-sm">
                {partnerName.charAt(0)}
              </div>
              <span className="font-medium text-blue-900 dark:text-blue-100">{partnerName}</span>
            </div>
          </div>

          <label className="flex items-center gap-3 cursor-pointer p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors border border-gray-200 dark:border-gray-700">
            <input
              type="checkbox"
              checked={alsoCheckoffPartner}
              onChange={(e) => setAlsoCheckoffPartner(e.target.checked)}
              className="w-5 h-5 text-indigo-600 border-gray-300 dark:border-gray-600 rounded focus:ring-indigo-500 dark:bg-gray-700"
            />
            <div className="text-gray-700 dark:text-gray-300">
              Also give checkoff to <span className="font-medium text-gray-900 dark:text-white">{partnerName}</span>
            </div>
          </label>

          <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 ml-8">
            Only check this if the partner is present and participating
          </p>
        </div>

        <div className="bg-gray-50 dark:bg-gray-700/30 px-6 py-4 flex justify-end gap-3 border-t border-gray-100 dark:border-gray-700">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white font-medium transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm(alsoCheckoffPartner)}
            className="px-6 py-2 bg-gradient-gt hover:bg-gradient-gt-hover text-white font-medium rounded-lg transition-all shadow-md hover:shadow-lg"
          >
            Confirm Checkoff
          </button>
        </div>
      </div>
    </div>
  );
};

export default PartnerCheckoffModal;
