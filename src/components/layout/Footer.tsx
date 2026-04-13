import React from 'react';

const Footer: React.FC = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="mt-auto border-t border-gray-200 dark:border-gray-800 bg-surface-light-alt dark:bg-surface-dark transition-colors duration-200">
      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Branding */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <img 
                src="/Georgia_Tech_Yellow_Jackets_logo.svg" 
                alt="Georgia Tech" 
                className="w-10 h-10 object-contain"
              />
              <div className="flex flex-col">
                <span className="font-display font-bold text-secondary-600 dark:text-white text-lg">ECE 4180</span>
                <span className="text-xs text-primary-500 dark:text-gt-gold font-medium">Embedded Systems Design</span>
              </div>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400 max-w-xs">
              Georgia Institute of Technology — School of Electrical and Computer Engineering
            </p>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="font-display font-semibold text-secondary-700 dark:text-white mb-3">Resources</h4>
            <ul className="space-y-2">
              <li>
                <a 
                  href="https://gatech.instructure.com/courses/502384" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-sm text-gray-600 hover:text-secondary-600 dark:text-gray-400 dark:hover:text-gt-gold transition-colors"
                >
                  Canvas
                </a>
              </li>
              <li>
                <a 
                  href="https://gatech.instructure.com/courses/502384/external_tools/12121?display=borderless" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-sm text-gray-600 hover:text-secondary-600 dark:text-gray-400 dark:hover:text-gt-gold transition-colors"
                >
                  Ed Discussion
                </a>
              </li>
              <li>
                <a 
                  href="https://docs.espressif.com/projects/esp-idf/en/stable/esp32c6/" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-sm text-gray-600 hover:text-secondary-600 dark:text-gray-400 dark:hover:text-gt-gold transition-colors"
                >
                  ESP32-C6 Documentation
                </a>
              </li>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h4 className="font-display font-semibold text-secondary-700 dark:text-white mb-3">Contact</h4>
            <ul className="space-y-2">
              <li>
                <a 
                  href="mailto:fratta@gatech.edu"
                  className="text-sm text-gray-600 hover:text-secondary-600 dark:text-gray-400 dark:hover:text-gt-gold transition-colors flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  fratta@gatech.edu
                </a>
              </li>
              <li>
                <span className="text-sm text-gray-600 dark:text-gray-400 flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  Klaus 3354
                </span>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-800 flex flex-col sm:flex-row justify-between items-center gap-4">
          <p className="text-xs text-gray-500 dark:text-gray-500">
            © {currentYear} Georgia Institute of Technology. All rights reserved.
          </p>
          <div className="flex items-center gap-4">
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
