# ECE 4180 Course Website — Frontend

React frontend for the ECE 4180 Embedded Systems Design course. Provides student and staff interfaces for lab assignments, video submissions, grading, and course content.

## Features

- **Authentication** — AWS Cognito sign-in/sign-up with role-based access (student vs. staff)
- **Lab Assignments** — Progressive labs with per-part checkoff system
- **Video Submissions** — Upload video demonstrations for lab checkoffs
- **Lab Queue** — Real-time help/checkoff queue for lab sessions
- **Partner System** — Students can request and manage lab partners
- **Guides** — Staff-created tutorials and setup guides
- **Admin Dashboard** — Student management, lab unlocking, grade export, and submission review

## Tech Stack

- React + TypeScript
- Tailwind CSS
- AWS Cognito (auth)
- AWS API Gateway + Lambda (backend)
- AWS S3 + CloudFront (video/image storage and CDN)

## Prerequisites

- [Node.js](https://nodejs.org/) (v18+)
- A deployed backend stack (see the [infrastructure README](../infrastructure/README.md))
- A [Vercel](https://vercel.com/) account (for deployment)

## Setup for a New Environment

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment Variables

Create a `.env` file in the project root:

```env
REACT_APP_USER_POOL_ID=us-east-1_XXXXXXXXX
REACT_APP_USER_POOL_CLIENT_ID=xxxxxxxxxxxxxxxxxxxxxxxxxx
REACT_APP_API_ENDPOINT=https://xxxxxxxxxx.execute-api.us-east-1.amazonaws.com/prod/
REACT_APP_S3_BUCKET=your-lab-videos-bucket-name
```

These values come from the CDK deploy output of the backend infrastructure stack.

### 3. Run Locally

```bash
npm start
```

The app runs at `http://localhost:3000`.

## Deploying to Vercel

### 1. Import Project

- Go to [vercel.com/new](https://vercel.com/new) and import the frontend repository
- Vercel auto-detects the Create React App framework

### 2. Set Environment Variables

In the Vercel project settings, add the same four `REACT_APP_*` variables from your `.env` file.

### 3. Configure Build Settings

These are already defined in `vercel.json`, but verify:
- **Build Command:** `npm run build`
- **Output Directory:** `build`
- **Install Command:** `npm install`

### 4. Deploy

Push to `main` — Vercel auto-deploys on every push.

### 5. Update Backend CORS

After getting your Vercel deployment URL, update the CORS origins in the backend CDK stack (`lib/ece4180-stack.ts`) to include your new Vercel URL, then redeploy the backend.

## Project Structure

```
frontend/
├── public/             # Static assets
├── src/
│   ├── components/     # Reusable UI components
│   │   ├── auth/       # Login, registration
│   │   ├── labs/       # Lab views, checkoff UI
│   │   ├── layout/     # Header, footer, navigation
│   │   └── submissions/ # Video upload and review
│   ├── contexts/       # React contexts (auth, etc.)
│   ├── pages/          # Route-level page components
│   ├── types/          # TypeScript type definitions
│   ├── App.tsx          # Main app with routing
│   ├── aws-config.ts   # AWS SDK configuration
│   └── index.tsx        # Entry point
├── tailwind.config.js
├── vercel.json          # Vercel deployment config
└── package.json
```
