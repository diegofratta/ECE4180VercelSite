import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { API_ENDPOINT } from '../../aws-config';

interface SelfCheckoffUploaderProps {
  labId: string;
  partId: string;
  partTitle?: string;
  onCheckoffComplete: (submissionId: string) => void;
}

const SelfCheckoffUploader: React.FC<SelfCheckoffUploaderProps> = ({
  labId,
  partId,
  partTitle,
  onCheckoffComplete
}) => {
  const { authState } = useAuth();
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isConfirming, setIsConfirming] = useState(false);

  const handleSubmit = async () => {
    if (!labId || !partId) return;
    
    try {
      setIsSubmitting(true);
      setError(null);

      const token = localStorage.getItem('idToken');
      
      if (!token) {
        throw new Error('Not authenticated');
      }
      
      // Fix the URL by ensuring no double slashes
      const apiUrl = `${API_ENDPOINT.replace(/\/$/, '')}/part-submissions`;
      
      console.log('Sending self check-off request to:', apiUrl);
      
      // Log the token for debugging (first few characters only)
      console.log('Token prefix:', token.substring(0, 10) + '...');
      
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          labId,
          partId,
          notes,
          selfCheckoff: true // Flag to identify this as a self check-off request
        })
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to submit self-checkoff: ${response.status} ${errorText}`);
      }

      const submissionData = await response.json();
      
      // Reset form
      setNotes('');
      setIsConfirming(false);
      
      // Notify parent component
      onCheckoffComplete(submissionData.submissionId);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6 mb-6">
      <h3 className="text-xl font-bold mb-2">
        {partTitle ? `Complete ${partTitle}` : 'Complete Lab Part'}
      </h3>
      <p className="text-gray-600 mb-4">
        Mark this lab part as completed once you've finished the required tasks.
      </p>
      
      {error && (
        <div className="bg-red-100 border-l-4 border-red-500 p-4 mb-4">
          <p className="text-red-700">{error}</p>
        </div>
      )}
      
      <div className="space-y-4">
        <div>
          <label htmlFor={`notes-${partId}`} className="label">
            Notes (Optional)
          </label>
          <textarea
            id={`notes-${partId}`}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="input w-full h-24"
            placeholder="Add any notes about your completion..."
            disabled={isSubmitting}
          />
        </div>
        
        {!isConfirming ? (
          <button
            onClick={() => setIsConfirming(true)}
            className="btn-primary"
            disabled={isSubmitting}
          >
            Mark as Completed
          </button>
        ) : (
          <div className="space-y-4">
            <div className="bg-yellow-100 border-l-4 border-yellow-500 p-4">
              <p className="text-yellow-800">
                Are you sure you've completed all the requirements for this part?
              </p>
            </div>
            <div className="flex space-x-4">
              <button
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="btn-primary"
              >
                {isSubmitting ? 'Submitting...' : 'Yes, Mark as Completed'}
              </button>
              <button
                onClick={() => setIsConfirming(false)}
                disabled={isSubmitting}
                className="btn-secondary"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SelfCheckoffUploader;