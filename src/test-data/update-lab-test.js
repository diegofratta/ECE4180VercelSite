// Script to test updating a lab with structured content
import sampleLabContent from './sample-lab-content';

// Function to update a lab with structured content
async function updateLabWithStructuredContent(labId) {
  try {
    const idToken = localStorage.getItem('idToken');
    
    if (!idToken) {
      throw new Error('No authentication token found');
    }
    
    // First, get the current lab details
    const getResponse = await fetch(`${process.env.REACT_APP_API_ENDPOINT}labs/${labId}`, {
      headers: {
        'Authorization': `Bearer ${idToken}`
      }
    });
    
    if (!getResponse.ok) {
      throw new Error('Failed to fetch lab details');
    }
    
    const lab = await getResponse.json();
    
    // Update the lab with structured content
    const updateResponse = await fetch(`${process.env.REACT_APP_API_ENDPOINT}labs/${labId}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${idToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        title: lab.title,
        description: lab.description,
        content: lab.content,
        structuredContent: sampleLabContent
      })
    });
    
    if (!updateResponse.ok) {
      throw new Error('Failed to update lab');
    }
    
    const updatedLab = await updateResponse.json();
    console.log('Lab updated successfully:', updatedLab);
    return updatedLab;
  } catch (error) {
    console.error('Error updating lab:', error);
    throw error;
  }
}

// Usage:
// Import this function and call it with a lab ID to update that lab with structured content
// Example: updateLabWithStructuredContent('lab1')

export default updateLabWithStructuredContent;