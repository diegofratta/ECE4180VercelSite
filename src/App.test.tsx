import React from 'react';
import { render, screen } from '@testing-library/react';
import App from './App';

test('renders ECE 4180 course title', () => {
  render(<App />);
  const titleElement = screen.getByText(/ECE 4180/i);
  expect(titleElement).toBeInTheDocument();
});
