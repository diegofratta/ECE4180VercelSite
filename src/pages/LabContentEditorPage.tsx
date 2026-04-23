import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { API_ENDPOINT } from '../aws-config';
import { Lab } from '../types';
import LabContentPreview from '../components/labs/content/LabContentPreview';
import LabBuilder from '../components/labs/builder/LabBuilder';
import { isStaffLevel } from '../utils/roles';

const LabContentEditorPage: React.FC = () => {
  const { labId } = useParams<{ labId: string }>();
  const navigate = useNavigate();
  const { authState } = useAuth();
  const [lab, setLab] = useState<Lab | null>(null);
  const [jsonContent, setJsonContent] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [showPreview, setShowPreview] = useState(true);
  const [editorMode, setEditorMode] = useState<'visual' | 'json'>('visual');

  // Check if user is staff
  useEffect(() => {
    if (!isStaffLevel(authState.user)) {
      navigate('/labs');
    }
  }, [authState.user, navigate]);

  // Fetch lab data
  useEffect(() => {
    const fetchLabData = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const idToken = localStorage.getItem('idToken');
        
        if (!idToken) {
          throw new Error('No authentication token found');
        }
        
        const response = await fetch(`${API_ENDPOINT}labs/${labId}`, {
          headers: {
            'Authorization': `Bearer ${idToken}`
          }
        });
        
        if (!response.ok) {
          throw new Error('Failed to fetch lab details');
        }
        
        const data = await response.json();
        setLab(data);
        
        // Format the JSON content for the editor
        const formattedJson = JSON.stringify(data, null, 2);
        setJsonContent(formattedJson);
      } catch (err) {
        setError((err as Error).message);
        console.error('Error fetching lab details:', err);
      } finally {
        setLoading(false);
      }
    };

    if (labId) {
      fetchLabData();
    }
  }, [labId]);

  // Handle JSON content changes
  const handleJsonChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setJsonContent(e.target.value);
    setSaveSuccess(false);
  };

  // Switch between modes with data synchronization
  const handleModeSwitch = (mode: 'visual' | 'json') => {
    if (mode === editorMode) return;

    if (mode === 'json') {
      // Switching to JSON mode: Update JSON from current Lab state
      if (lab) {
        setJsonContent(JSON.stringify(lab, null, 2));
      }
      setEditorMode('json');
    } else {
      // Switching to Visual mode: Update Lab state from current JSON
      try {
        const parsedLab = JSON.parse(jsonContent);
        setLab(parsedLab);
        setEditorMode('visual');
        setError(null);
      } catch (err) {
        setError(`Cannot switch to Visual Builder: Invalid JSON. Please fix the JSON errors first. ${(err as Error).message}`);
        // Don't switch mode if JSON is invalid
      }
    }
  };

  // Update lab state from builder
  const handleLabUpdate = (updatedLab: Lab) => {
    setLab(updatedLab);
    setSaveSuccess(false);
    // Also update JSON content to keep it in sync for preview/switching
    setJsonContent(JSON.stringify(updatedLab, null, 2));
  };

  // Validate JSON before saving
  const validateJson = (): boolean => {
    try {
      JSON.parse(jsonContent);
      return true;
    } catch (err) {
      setError(`Invalid JSON: ${(err as Error).message}`);
      return false;
    }
  };

  // Save changes
  const handleSave = async () => {
    let dataToSave = lab;

    // If in JSON mode, ensure we validate and use the JSON content
    if (editorMode === 'json') {
      if (!validateJson()) {
        return;
      }
      dataToSave = JSON.parse(jsonContent);
    } else {
      // In Visual mode, 'lab' state is already the source of truth
      // but let's ensure jsonContent is synced just in case
      setJsonContent(JSON.stringify(lab, null, 2));
    }

    try {
      setSaving(true);
      setError(null);
      setSaveSuccess(false);
      
      const idToken = localStorage.getItem('idToken');
      
      if (!idToken) {
        throw new Error('No authentication token found');
      }
      
      // Log detailed information about the data being sent
      console.log('Saving lab content:', dataToSave);
      
      const requestHeaders = {
        'Authorization': `Bearer ${idToken}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      };
      
      const response = await fetch(`${API_ENDPOINT}labs/${labId}`, {
        method: 'PUT',
        headers: requestHeaders,
        body: JSON.stringify(dataToSave)
      });
            
      if (!response.ok) {
        let errorMessage = 'Failed to update lab content';
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorMessage;
        } catch (e) {
          console.error('Error parsing error response:', e);
        }
        throw new Error(errorMessage);
      }
      
      const responseData = await response.json();
      console.log('Update response:', responseData);
      
      // Update the lab state with the updated data
      setLab(responseData.lab);
      setJsonContent(JSON.stringify(responseData.lab, null, 2));
      
      // Show success message
      setSaveSuccess(true);
      
    } catch (err) {
      setError((err as Error).message);
      console.error('Error saving lab content:', err);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto p-4">
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      </div>
    );
  }


  if (error && !lab) {
    return (
      <div className="max-w-4xl mx-auto p-4">
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
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

  return (
    <div className="flex flex-col h-[calc(100vh-64px)] max-h-[calc(100vh-64px)] overflow-hidden">
      {/* Action Bar - Fixed at top of main content */}
      <div className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 px-4 py-3 flex justify-between items-center shadow-sm z-20 flex-shrink-0">
        <button
          onClick={() => navigate('/labs')}
          className="bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 font-medium py-2 px-4 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-opacity-50 flex items-center transition-colors shadow-sm text-sm"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
          </svg>
          Back
        </button>
        
        <div className="flex items-center space-x-3">
           <div className="hidden sm:flex items-center space-x-1 bg-gray-200 dark:bg-gray-700 p-1 rounded-lg">
              <button
                onClick={() => handleModeSwitch('visual')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                  editorMode === 'visual'
                    ? 'bg-white dark:bg-gray-600 text-blue-600 dark:text-blue-300 shadow-sm'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                }`}
              >
                Builder
              </button>
              <button
                onClick={() => handleModeSwitch('json')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                  editorMode === 'json'
                    ? 'bg-white dark:bg-gray-600 text-blue-600 dark:text-blue-300 shadow-sm'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                }`}
              >
                JSON
              </button>
           </div>
           
           <button
             onClick={() => setShowPreview(!showPreview)}
             className={`px-3 py-2 rounded-md font-medium text-sm transition-colors ${
               showPreview 
                 ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300' 
                 : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
             }`}
           >
             {showPreview ? 'Hide Preview' : 'Show Preview'}
           </button>

          <button
            onClick={handleSave}
            disabled={saving}
            className={`${
              saving ? 'bg-blue-400' : 'bg-blue-600 hover:bg-blue-700'
            } text-white font-medium py-2 px-6 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 flex items-center shadow-md text-sm`}
          >
            {saving ? (
              <>
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Saving...
              </>
            ) : (
              'Save'
            )}
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-hidden">
        {lab ? (
           <div className="h-full flex flex-col md:flex-row">
             {/* Editor Column */}
             <div className={`flex-1 flex flex-col h-full overflow-hidden transition-all duration-300 ${showPreview ? 'w-full md:w-1/2 border-r border-gray-200 dark:border-gray-700' : 'w-full max-w-5xl mx-auto'}`}>
               
               {/* Messages Area */}
               <div className="flex-shrink-0 p-4 pb-0 max-w-7xl mx-auto w-full">
                  {error && (
                    <div className="bg-red-100 dark:bg-red-900/30 border-l-4 border-red-500 text-red-700 dark:text-red-300 p-4 mb-4 rounded shadow-sm">
                      <p>{error}</p>
                    </div>
                  )}
                  
                  {saveSuccess && (
                    <div className="bg-green-100 dark:bg-green-900/30 border-l-4 border-green-500 text-green-700 dark:text-green-300 p-4 mb-4 rounded shadow-sm">
                      <p>Changes saved successfully!</p>
                    </div>
                  )}
               </div>

               {/* Scrollable Editor Content */}
               <div className="flex-1 overflow-y-auto p-4 md:p-6 custom-scrollbar">
                  <div className="max-w-7xl mx-auto w-full">
                    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 mb-6 p-6">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <h1 className="text-2xl font-bold mb-1 text-gray-900 dark:text-gray-100">{lab.title}</h1>
                          <p className="text-sm text-gray-500 dark:text-gray-400">Lab ID: {lab.labId}</p>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <label className="text-sm font-medium text-gray-600 dark:text-gray-400">Due:</label>
                          <input
                            type="date"
                            value={lab.dueDate?.split('T')[0] || ''}
                            onChange={(e) => handleLabUpdate({ ...lab, dueDate: e.target.value })}
                            className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 min-h-[500px]">
                      {editorMode === 'visual' && lab ? (
                        <LabBuilder lab={lab} onChange={handleLabUpdate} />
                      ) : (
                        <div>
                          <label htmlFor="jsonEditor" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Edit Lab Content (JSON)
                          </label>
                          <textarea
                            id="jsonEditor"
                            value={jsonContent}
                            onChange={handleJsonChange}
                            className="w-full h-[800px] font-mono text-sm p-4 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                            spellCheck="false"
                          />
                        </div>
                      )}
                    </div>
                  </div>
               </div>
             </div>

             {/* Preview Column */}
             {showPreview && (
               <div className="flex-1 flex flex-col h-full overflow-hidden bg-gray-50 dark:bg-gray-900/50 w-full md:w-1/2">
                 <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-3 shadow-sm z-10 flex justify-between items-center px-6">
                   <h3 className="font-bold text-gray-700 dark:text-gray-200">
                     Live Preview
                   </h3>
                   <span className="text-xs text-gray-500 uppercase tracking-wide font-semibold">Student View</span>
                 </div>
                 <div className="flex-1 overflow-y-auto p-4 md:p-6 custom-scrollbar">
                    <div className="max-w-7xl mx-auto w-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm min-h-full">
                      <div className="p-6">
                        <LabContentPreview jsonContent={editorMode === 'visual' && lab ? JSON.stringify(lab) : jsonContent} />
                      </div>
                    </div>
                 </div>
               </div>
             )}
           </div>
        ) : (
          <div className="p-12 text-center text-gray-500 dark:text-gray-400">
             Lab data not loaded.
          </div>
        )}
      </div>
    </div>
  );
};

export default LabContentEditorPage;