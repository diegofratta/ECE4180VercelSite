import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import updateLabWithStructuredContent from '../test-data/update-lab-test';

const TestLabContentPage: React.FC = () => {
  const navigate = useNavigate();
  const { authState } = useAuth();
  const [labId, setLabId] = useState('lab1');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Only staff can access this page
  if (authState.user?.role !== 'staff') {
    return (
      <div className="max-w-4xl mx-auto p-4">
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          You do not have permission to access this page.
        </div>
        <button
          onClick={() => navigate('/labs')}
          className="bg-blue-500 hover:bg-blue-600 text-white font-medium py-2 px-4 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50"
        >
          Back to Labs
        </button>
      </div>
    );
  }

  const handleUpdateLab = async () => {
    try {
      setLoading(true);
      setError(null);
      setResult(null);
      
      const updatedLab = await updateLabWithStructuredContent(labId);
      setResult(JSON.stringify(updatedLab, null, 2));
    } catch (err) {
      setError((err as Error).message);
      console.error('Error updating lab:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-4">
      <h1 className="text-3xl font-bold mb-6">Test Lab Content</h1>
      
      <div className="bg-white shadow-md rounded-lg overflow-hidden mb-6 p-6">
        <h2 className="text-xl font-semibold mb-4">Update Lab with Structured Content</h2>
        
        <div className="mb-4">
          <label htmlFor="lab-id" className="block text-sm font-medium text-gray-700 mb-1">
            Lab ID
          </label>
          <input
            id="lab-id"
            type="text"
            value={labId}
            onChange={(e) => setLabId(e.target.value)}
            className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
        
        <button
          onClick={handleUpdateLab}
          disabled={loading}
          className="bg-blue-500 hover:bg-blue-600 text-white font-medium py-2 px-4 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 disabled:opacity-50"
        >
          {loading ? 'Updating...' : 'Update Lab'}
        </button>
      </div>
      
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}
      
      {result && (
        <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4">
          <p className="font-medium mb-2">Lab updated successfully!</p>
          <a 
            href={`/labs/${labId}`} 
            className="text-blue-600 hover:text-blue-800 underline"
          >
            View updated lab
          </a>
          <details className="mt-2">
            <summary className="cursor-pointer">Show response details</summary>
            <pre className="mt-2 p-2 bg-gray-100 rounded text-xs overflow-auto">
              {result}
            </pre>
          </details>
        </div>
      )}
      
      <div className="mt-4">
        <button
          onClick={() => navigate('/labs')}
          className="bg-gray-200 hover:bg-gray-300 text-gray-800 font-medium py-2 px-4 rounded focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-opacity-50"
        >
          Back to Labs
        </button>
      </div>
    </div>
  );
};

export default TestLabContentPage;