// Sample structured content for testing lab rendering
const sampleLabContent = {
  sections: [
    {
      id: 'intro',
      type: 'introduction',
      title: 'Introduction',
      order: 1,
      content: [
        {
          type: 'text',
          content: 'This is a sample lab with structured content to demonstrate the new lab content format. This lab includes text, images, code blocks, and other rich media elements.'
        },
        {
          type: 'image',
          url: 'https://picsum.photos/800/400',
          caption: 'Sample diagram showing the lab setup'
        }
      ]
    },
    {
      id: 'objectives',
      type: 'objectives',
      title: 'Objectives',
      order: 2,
      content: [
        {
          type: 'text',
          content: '- Learn how to use the new structured lab content format\n- Understand how to include images and diagrams in labs\n- Test the rendering of different content types'
        }
      ]
    },
    {
      id: 'requirements',
      type: 'requirements',
      title: 'Requirements',
      order: 3,
      content: [
        {
          type: 'text',
          content: '- Web browser\n- Internet connection\n- ESP32-C6 development board'
        },
        {
          type: 'note',
          content: 'Make sure you have the latest version of the ESP-IDF installed on your computer.'
        }
      ]
    },
    {
      id: 'instructions',
      type: 'instructions',
      title: 'Instructions',
      order: 4,
      content: [
        {
          type: 'text',
          content: '### Step 1: Set up your environment\n\nConnect your ESP32-C6 to your computer and open a terminal.'
        },
        {
          type: 'code',
          language: 'bash',
          content: 'cd ~/esp\nexport IDF_PATH=~/esp/esp-idf\n. $IDF_PATH/export.sh'
        },
        {
          type: 'text',
          content: '### Step 2: Create a new project\n\nUse the ESP-IDF template to create a new project.'
        },
        {
          type: 'code',
          language: 'bash',
          content: 'idf.py create-project my_project\ncd my_project'
        },
        {
          type: 'image',
          url: 'https://picsum.photos/800/400?random=1',
          caption: 'Project directory structure'
        },
        {
          type: 'warning',
          content: 'Make sure to save your work frequently as the development environment may occasionally crash.'
        }
      ]
    },
    {
      id: 'submission',
      type: 'submission',
      title: 'Submission',
      order: 5,
      content: [
        {
          type: 'text',
          content: 'Submit a video (2-3 minutes) demonstrating your working project and explaining your code.'
        }
      ]
    }
  ],
  resources: [
    {
      id: 'resource1',
      type: 'document',
      title: 'ESP32-C6 Technical Reference Manual',
      description: 'Official documentation for the ESP32-C6 microcontroller',
      url: 'https://www.espressif.com/sites/default/files/documentation/esp32-c6_technical_reference_manual_en.pdf'
    },
    {
      id: 'resource2',
      type: 'video',
      title: 'Getting Started with ESP32-C6',
      description: 'Video tutorial on setting up your ESP32-C6 development environment',
      url: 'https://www.youtube.com/watch?v=example'
    }
  ]
};

export default sampleLabContent;