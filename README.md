# Mini Online Test Application (MERN Stack)

> A modern, secure, responsive full-stack online examination platform built with **MongoDB, Express.js, React, and Node.js (MERN)** for the **Infinity Classes** technical assessment.

---

## 🌟 Live Demo & Repository

- **Live Application Link**: [https://infinity-classes-online-test-app.onrender.com](https://infinity-classes-online-test-app.onrender.com)
- **GitHub Repository**: [https://github.com/sreecharantomail-arch/infinity-classes](https://github.com/sreecharantomail-arch/infinity-classes)

---

## 📋 Features Checklist

| Required Feature | Status | Description |
| :--- | :---: | :--- |
| **1. Authentication** | ✅ Implemented | Students can register and sign in with email & password. Passwords securely hashed with `bcryptjs` (10 salt rounds), sessions protected via stateless JWT. Rate limiting active on login. |
| **2. Test Screen** | ✅ Implemented | Exactly 10 multiple-choice questions loaded dynamically from MongoDB via server-managed `ExamSession`. Answers stripped at the API level. Option selection, clear response, and review flags. |
| **3. Server-Controlled 10-Minute Timer** | ✅ Implemented | Live countdown timer (`10:00`) anchored to server-side `expiresAt` timestamp. Immune to tab throttling and browser refresh. **Automatically submits when time expires**. |
| **4. Result & Review** | ✅ Implemented | Scores calculated exclusively on the backend. Displays total score, accuracy percentage, time spent, question-by-question breakdown showing student choice vs. correct answer, and solutions. |
| **5. Attempt History** | ✅ Implemented | Dedicated history dashboard showing past test attempts with scores, accuracy, timestamps, and direct links to review any past attempt. Protected by strict user-level data isolation. |
| **6. Admin Panel (Bonus)** | ✅ Implemented | Complete question management system: add new questions with 4 options, designate correct option, assign category & difficulty, delete questions, and restore question bank defaults. |

---

## 🛡️ Enterprise Security Implementations

- **Server-Side Examination Sessions (`ExamSession`)**:
  - A unique examination session is created in MongoDB with exact start and expiry timestamps.
  - Re-opening or refreshing the page synchronizes to the existing server deadline, preventing time manipulation.
- **Atomic Race-Condition & Duplicate Prevention**:
  - Test submissions transition session status atomically (`findOneAndUpdate({ status: 'in_progress' })`), preventing duplicate attempts or simultaneous multi-tab submissions.
- **Server-Side Score & Time Calculation**:
  - The server queries authentic answer keys from MongoDB and computes the score. Client-submitted scores, durations, and timeout flags are completely disregarded.
- **Deadline Enforcement**:
  - The backend rejects submissions received after the 10-minute deadline (+15s network latency grace period).
- **Strict Input Validation**:
  - NoSQL injection guards enforce primitive string types. Question IDs in submissions must match the exact 10 assigned IDs; duplicate or foreign IDs are rejected with `400 Bad Request`.
- **Login Rate Limiting**:
  - Sliding-window rate limiter blocks brute-force login attempts (max 5 failed attempts per 15 minutes per IP).
- **Zero-Knowledge Distribution**:
  - The test question endpoint strips `correctOptionIndex` and `explanation`, preventing examinees from inspecting answers in browser DevTools.

---

## 🛠️ Technology Stack

- **Frontend**:
  - **React 18** (Vite build system for instant HMR)
  - **Tailwind CSS** (Modern responsive design system)
  - **React Router v6** (Protected client-side routing)
  - **Lucide React** (Clean icon system)
  - **Canvas Confetti** (Celebratory animation on achieving high scores)
- **Backend**:
  - **Node.js** & **Express.js** (RESTful API architecture)
  - **JSON Web Tokens (JWT)** & **bcryptjs** (Stateless authentication & password encryption)
  - **CORS** & **dotenv** (Security and environment configuration)
- **Database**:
  - **MongoDB Atlas** & **Mongoose ODM** (Document schemas, validation, aggregation pipelines)

---

## 📐 Project Structure

```text
infinity classess/
├── client/                     # Frontend (React + Vite + Tailwind CSS)
│   ├── src/
│   │   ├── components/         # Navbar, Timer, ProtectedRoute, Modals
│   │   ├── context/            # AuthContext (JWT & user state)
│   │   ├── pages/              # Login, Register, Dashboard, Test, Result, History, Admin
│   │   ├── services/           # Centralized API service layer
│   │   ├── App.jsx             # Route definitions & guards
│   │   ├── index.css           # Tailwind directives & theme
│   │   └── main.jsx            # Entry point
│   ├── package.json
│   ├── tailwind.config.js
│   └── vite.config.js
├── server/                     # Backend API (Node.js + Express + Mongoose)
│   ├── config/
│   │   └── db.js               # MongoDB connection handler
│   ├── middleware/
│   │   └── auth.js             # JWT verification & role authorization
│   ├── models/
│   │   ├── User.js             # User schema with bcrypt password hashing
│   │   ├── Question.js         # Multiple-choice question schema
│   │   ├── Attempt.js          # Test submission & score history schema
│   │   └── ExamSession.js      # Server-side examination session schema
│   ├── routes/
│   │   ├── auth.js             # /api/auth (register, login, me with rate limiting)
│   │   ├── questions.js        # /api/questions (start session, test questions, admin CRUD)
│   │   └── attempts.js         # /api/attempts (secure submit, my-history, :id)
│   ├── seed/
│   │   ├── questionsData.js    # 15 high-quality pre-seeded questions
│   │   └── seedQuestions.js    # Database seeding script
│   ├── .env.example            # Environment template
│   ├── package.json
│   └── server.js               # Express application entry point
├── render.yaml                 # Render 1-click blueprint configuration
├── package.json                # Root package for concurrent execution
└── README.md                   # Documentation
```

---

## 🚀 Local Installation & Setup Guide

### Prerequisites
- **Node.js** (v18 or higher recommended)
- **MongoDB** (Local MongoDB instance or MongoDB Atlas cluster)

### 1. Clone the repository
```bash
git clone https://github.com/sreecharantomail-arch/infinity-classes.git
cd infinity-classes
```

### 2. Install all dependencies
```bash
npm run install-all
```

### 3. Configure Environment Variables
Copy `.env.example` to `server/.env`:
```env
PORT=5000
MONGODB_URI=mongodb://127.0.0.1:27017/online_test_app
JWT_SECRET=your_strong_random_jwt_secret_min_32_chars
ADMIN_SECRET=your_secure_admin_provisioning_key
CLIENT_URL=http://localhost:5173,http://localhost:5000
NODE_ENV=development
```

### 4. Seed the Database
```bash
npm run seed
```

### 5. Start the Application
Run both backend and frontend concurrently in development mode:
```bash
npm run dev
```
- **Frontend**: [http://localhost:5173](http://localhost:5173)
- **Backend API**: [http://localhost:5000](http://localhost:5000)

Alternatively, to build and run production mode:
```bash
npm run build
npm start
```

---

## 🌐 Deployment Instructions (Render)

1. Push your repository to GitHub.
2. Create a **Web Service** on [Render](https://render.com).
3. Set:
   - **Build Command**: `npm run build`
   - **Start Command**: `npm start`
4. Set Environment Variables in Render:
   - `NODE_ENV`: `production`
   - `JWT_SECRET`: *(A securely generated random 32+ character string)*
   - `MONGODB_URI`: *(Your MongoDB Atlas connection string)*
   - `CLIENT_URL`: *(Your live Render frontend URL)*
5. Deploy Web Service.
