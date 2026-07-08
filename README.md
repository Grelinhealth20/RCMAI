# RCM AI Demo System

A full-stack AI-powered Revenue Cycle Management (RCM) demo platform built by **Grelin Health**. This system showcases a suite of intelligent AI modules that automate and streamline core healthcare revenue cycle workflows — from eligibility verification through claims submission, denial management, and performance analytics.

---

## Overview

The RCM AI Demo System is a React + TypeScript single-page application powered by OpenAI. It presents a unified dashboard with seven specialized AI modules, each targeting a distinct phase of the revenue cycle. The demo is designed to illustrate how AI can reduce manual workload, catch errors earlier, and accelerate reimbursement across the full billing lifecycle.

---

## AI Modules

| Module | Description |
|---|---|
| **Eligibility AI** | Automated insurance eligibility verification with smart filtering, patient worklist management, and real-time verification status tracking |
| **Prior Authorization AI** | AI-assisted prior auth case management — creates, tracks, and resolves authorization requests with payer-specific intelligence |
| **Coding AI** | Medical coding engine that analyzes clinical documentation (PDF/DOCX), suggests ICD-10 and CPT codes, and manages a chart worklist |
| **Claims Submission AI** | Intelligent claims scrubbing and submission assistance to reduce rejections before claims leave the practice |
| **AR & Denial Management** | Accounts receivable tracking and denial workflow management with AI-prioritized follow-up queues |
| **Appeals AI** | Generates and manages insurance appeals with AI-drafted appeal letters based on denial reason and payer rules |
| **Performance AI** | RCM KPI dashboards and AI-driven insights covering collection rates, denial trends, days in AR, and clean claim rates |

---

## Tech Stack

- **Frontend:** React 19, TypeScript 6, Vite 8
- **AI:** OpenAI API (GPT models)
- **Document Parsing:** mammoth (DOCX), pdfjs-dist (PDF), jsPDF (PDF generation)
- **Linting:** oxlint
- **Auth:** Session-based demo authentication

---

## Getting Started

### Prerequisites

- Node.js 18+
- npm 9+
- An OpenAI API key

### Installation

```bash
# Clone the repository
git clone https://github.com/GrelinhealthTeam/RCMAI_Demo.git
cd RCMAI_Demo

# Install dependencies
npm install
```

### Environment Setup

Copy the example env file and add your OpenAI key:

```bash
cp .env.example .env
```

Edit `.env`:

```
OPENAI_API_KEY=your-openai-api-key-here
```

### Running Locally

```bash
npm run dev
```

The app will be available at `http://localhost:5173`.

### Build for Production

```bash
npm run build
```

Output is placed in the `dist/` folder.

---

## Demo Credentials

```
Username: Demo@grelinhealth.com
Password: Grelin@2026!!
```

---

## Project Structure

```
src/
├── assets/              # Static assets (logo, etc.)
├── modules/
│   ├── coding/          # Coding AI — chart worklist, coding engine, file parsing
│   ├── eligibility/     # Eligibility AI — patient table, verification panel, smart filter
│   ├── priorauth/       # Prior Authorization AI — case management dashboard
│   ├── registry.tsx     # Module registry (maps IDs to components and icons)
│   ├── AppealsAI.tsx
│   ├── ARDenialManagement.tsx
│   ├── ClaimsSubmissionAI.tsx
│   ├── PerformanceAI.tsx
│   └── icons.tsx
├── App.tsx              # Root component — auth gate
├── auth.ts              # Session auth helpers
├── Dashboard.tsx        # Main shell with collapsible sidebar
├── LoginPage.tsx        # Demo login screen
└── main.tsx             # Entry point
```

---

## License

This project is proprietary and intended for demonstration purposes only.  
© 2026 Grelin Health. All rights reserved.
