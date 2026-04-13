import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { API_ENDPOINT } from '../aws-config';
import { Guide } from '../types';
import LabContentPreview from '../components/labs/content/LabContentPreview';
import LabBuilder from '../components/labs/builder/LabBuilder';

const GuideContentEditorPage: React.FC = () => {
  const { guideId } = useParams<{ guideId: string }>();
  const navigate = useNavigate();
  const { authState } = useAuth();
  const [guide, setGuide] = useState<Guide | null>(null);
  const [jsonContent, setJsonContent] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [showPreview, setShowPreview] = useState(true);
  const [editorMode, setEditorMode] = useState<'visual' | 'json'>('visual');
  
  // When on /guides/new, guideId is undefined (not 'new')
  const isNewGuide = !guideId;

  // Check if user is staff
  useEffect(() => {
    if (authState.user?.role !== 'staff') {
      navigate('/guides');
    }
  }, [authState.user, navigate]);

  // Initialize new guide or fetch existing
  useEffect(() => {
    if (isNewGuide) {
      const newGuide: Guide = {
        guideId: `guide-${Date.now()}`,
        title: 'New Guide',
        description: '',
        content: '',
        structuredContent: {
          sections: [],
          resources: [],
        },
        order: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      setGuide(newGuide);
      setJsonContent(JSON.stringify(newGuide, null, 2));
      setLoading(false);
    } else if (guideId) {
      fetchGuideData();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [guideId, isNewGuide]);

  const fetchGuideData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const idToken = localStorage.getItem('idToken');
      
      if (!idToken) {
        throw new Error('No authentication token found');
      }
      
      const baseUrl = API_ENDPOINT.endsWith('/') ? API_ENDPOINT : `${API_ENDPOINT}/`;
      const response = await fetch(`${baseUrl}guides/${guideId}`, {
        headers: {
          'Authorization': `Bearer ${idToken}`
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch guide details');
      }
      
      const data = await response.json();
      setGuide(data);
      setJsonContent(JSON.stringify(data, null, 2));
    } catch (err) {
      setError((err as Error).message);
      console.error('Error fetching guide details:', err);
    } finally {
      setLoading(false);
    }
  };

  // Handle JSON content changes
  const handleJsonChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setJsonContent(e.target.value);
    setSaveSuccess(false);
  };

  // Switch between modes with data synchronization
  const handleModeSwitch = (mode: 'visual' | 'json') => {
    if (mode === editorMode) return;

    if (mode === 'json') {
      if (guide) {
        setJsonContent(JSON.stringify(guide, null, 2));
      }
      setEditorMode('json');
    } else {
      try {
        const parsedGuide = JSON.parse(jsonContent);
        setGuide(parsedGuide);
        setEditorMode('visual');
        setError(null);
      } catch (err) {
        setError(`Cannot switch to Visual Builder: Invalid JSON. Please fix the JSON errors first. ${(err as Error).message}`);
      }
    }
  };

  // Update guide state from builder (reusing Lab builder)
  const handleGuideUpdate = (updatedGuide: any) => {
    // Convert Lab format back to Guide format
    const guideUpdate: Guide = {
      ...guide!,
      title: updatedGuide.title,
      description: updatedGuide.description,
      structuredContent: updatedGuide.structuredContent,
    };
    setGuide(guideUpdate);
    setSaveSuccess(false);
    setJsonContent(JSON.stringify(guideUpdate, null, 2));
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
    let dataToSave = guide;

    if (editorMode === 'json') {
      if (!validateJson()) {
        return;
      }
      dataToSave = JSON.parse(jsonContent);
    } else {
      setJsonContent(JSON.stringify(guide, null, 2));
    }

    try {
      setSaving(true);
      setError(null);
      setSaveSuccess(false);
      
      const idToken = localStorage.getItem('idToken');
      
      if (!idToken) {
        throw new Error('No authentication token found');
      }
      
      const baseUrl = API_ENDPOINT.endsWith('/') ? API_ENDPOINT : `${API_ENDPOINT}/`;
      const method = isNewGuide ? 'POST' : 'PUT';
      const url = isNewGuide ? `${baseUrl}guides` : `${baseUrl}guides/${guideId}`;
      
      const response = await fetch(url, {
        method,
        headers: {
          'Authorization': `Bearer ${idToken}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(dataToSave)
      });
            
      if (!response.ok) {
        let errorMessage = 'Failed to save guide';
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorMessage;
        } catch (e) {
          console.error('Error parsing error response:', e);
        }
        throw new Error(errorMessage);
      }
      
      const responseData = await response.json();
      
      setGuide(responseData.guide);
      setJsonContent(JSON.stringify(responseData.guide, null, 2));
      setSaveSuccess(true);
      
      // If creating new guide, redirect to edit page with new ID
      if (isNewGuide && responseData.guide?.guideId) {
        navigate(`/guides/${responseData.guide.guideId}/edit`, { replace: true });
      }
      
    } catch (err) {
      setError((err as Error).message);
      console.error('Error saving guide:', err);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto p-4">
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500"></div>
        </div>
      </div>
    );
  }

  if (error && !guide) {
    return (
      <div className="max-w-4xl mx-auto p-4">
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
        <button
          onClick={() => navigate('/guides')}
          className="bg-purple-500 hover:bg-purple-600 text-white font-medium py-2 px-4 rounded focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-opacity-50"
        >
          Back to Guides
        </button>
      </div>
    );
  }

  // Convert Guide to Lab format for the builder
  const guideAsLab = guide ? {
    ...guide,
    labId: guide.guideId,
    locked: false,
    dueDate: undefined,
    grade: undefined,
    earlyBirdPoints: undefined,
  } : null;

  return (
    <div className="flex flex-col h-[calc(100vh-64px)] max-h-[calc(100vh-64px)] overflow-hidden">
      {/* Action Bar */}
      <div className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 px-4 py-3 flex justify-between items-center shadow-sm z-20 flex-shrink-0">
        <button
          onClick={() => navigate('/guides')}
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
                  ? 'bg-white dark:bg-gray-600 text-purple-600 dark:text-purple-300 shadow-sm'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
              }`}
            >
              Builder
            </button>
            <button
              onClick={() => handleModeSwitch('json')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                editorMode === 'json'
                  ? 'bg-white dark:bg-gray-600 text-purple-600 dark:text-purple-300 shadow-sm'
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
                ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300' 
                : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
            }`}
          >
            {showPreview ? 'Hide Preview' : 'Show Preview'}
          </button>

          <button
            onClick={handleSave}
            disabled={saving}
            className={`${
              saving ? 'bg-purple-400' : 'bg-purple-600 hover:bg-purple-700'
            } text-white font-medium py-2 px-6 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-opacity-50 flex items-center shadow-md text-sm`}
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
              isNewGuide ? 'Create Guide' : 'Save'
            )}
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-hidden">
        {guide ? (
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
                    <p>{isNewGuide ? 'Guide created successfully!' : 'Changes saved successfully!'}</p>
                  </div>
                )}
              </div>

              {/* Scrollable Editor Content */}
              <div className="flex-1 overflow-y-auto p-4 md:p-6 custom-scrollbar">
                <div className="max-w-7xl mx-auto w-full">
                  <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 mb-6 p-6">
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Guide Title
                        </label>
                        <input
                          type="text"
                          value={guide.title}
                          onChange={(e) => setGuide({ ...guide, title: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-purple-500 focus:border-purple-500 bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Description
                        </label>
                        <textarea
                          value={guide.description}
                          onChange={(e) => setGuide({ ...guide, description: e.target.value })}
                          rows={2}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-purple-500 focus:border-purple-500 bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Tag <span className="text-gray-400 font-normal">(optional - e.g., "Lab 0", "Lab 2", "Final Project")</span>
                        </label>
                        <input
                          type="text"
                          value={guide.tag || ''}
                          onChange={(e) => setGuide({ ...guide, tag: e.target.value })}
                          placeholder="e.g., Lab 0, Lab 2, Final Project"
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-purple-500 focus:border-purple-500 bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                        />
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          This tag appears as a badge on the guide card to indicate when this guide is most relevant.
                        </p>
                      </div>
                    </div>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">Guide ID: {guide.guideId}</p>
                  </div>

                  <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 min-h-[500px]">
                    {editorMode === 'visual' && guideAsLab ? (
                      <LabBuilder lab={guideAsLab as any} onChange={handleGuideUpdate} />
                    ) : (
                      <div>
                        <label htmlFor="jsonEditor" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Edit Guide Content (JSON)
                        </label>
                        <textarea
                          id="jsonEditor"
                          value={jsonContent}
                          onChange={handleJsonChange}
                          className="w-full h-[800px] font-mono text-sm p-4 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-purple-500 focus:border-purple-500 bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
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
                      <LabContentPreview jsonContent={editorMode === 'visual' && guide ? JSON.stringify(guideAsLab) : jsonContent} />
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="p-12 text-center text-gray-500 dark:text-gray-400">
            Guide data not loaded.
          </div>
        )}
      </div>
    </div>
  );
};

export default GuideContentEditorPage;
