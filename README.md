# Mini Online Test Application (MERN Stack)

> A modern, responsive, full-stack online examination platform built with **MongoDB, Express.js, React, and Node.js (MERN)** for the **Infinity Classes** internship technical assessment.

---

## 🌟 Live Demo & Repository

- **Live Application Link**: [https://infinity-classes-online-test-app.onrender.com](https://infinity-classes-online-test-app.onrender.com) *(or your deployed Render/Vercel URL)*
- **GitHub Repository**: [https://github.com/YOUR_GITHUB_USERNAME/infinity-classes-online-test-app](https://github.com/YOUR_GITHUB_USERNAME/infinity-classes-online-test-app)

---

## 📋 Features Checklist

| Required Feature | Status | Description |
| :--- | :---: | :--- |
| **1. Authentication** | ✅ Implemented | Students can register and sign in with email & password. Passwords securely hashed with `bcryptjs`, sessions protected via JWT. |
| **2. Test Screen** | ✅ Implemented | 10 multiple-choice questions loaded dynamically from MongoDB with a question matrix, option selection, clear response, and mark for review. |
| **3. 10-Minute Timer** | ✅ Implemented | Live countdown timer (`10:00`). Displays color-coded urgency alerts (< 2m and < 1m) and **automatically submits the test when the timer reaches 00:00**. |
| **4. Result & Review** | ✅ Implemented | Instant score calculation on the server, accuracy percentage, time spent, question-by-question breakdown showing student choice vs. correct answer, and detailed explanations. |
| **5. Attempt History** | ✅ Implemented | Dedicated history dashboard showing past test attempts with scores, accuracy, timestamps, and direct links to review any past attempt. |
| **6. Admin Panel (Bonus)** | ✅ Implemented | Complete question management system: add new questions with 4 options, designate correct option, assign category & difficulty, delete questions, and restore question bank defaults. |

---

## 🔑 Pre-Seeded Demo Credentials

To make evaluation seamless, the app comes with pre-seeded test accounts and **1-click demo autofill buttons** on the sign-in page:

| Role | Email | Password | Access Privileges |
| :--- | :--- | :--- | :--- |
| **Student** | `student@infinity.com` | `student123` | Dashboard, 10-Question Test, History & Result Reviews |
| **Admin (Bonus)** | `admin@infinity.com` | `admin123` | Student access + Full Question Bank Management & Add Question |

> You can also register any new student or admin account anytime through the **Create Student Account** page.

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
  - **MongoDB** & **Mongoose ODM** (Document schemas, validation, aggregation pipelines)

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
│   │   └── Attempt.js          # Test submission & score history schema
│   ├── routes/
│   │   ├── auth.js             # /api/auth (register, login, me)
│   │   ├── questions.js        # /api/questions (test questions, admin CRUD)
│   │   └── attempts.js         # /api/attempts (submit, my-history, :id)
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
- **MongoDB** (Local MongoDB instance running on `localhost:27017` or MongoDB Atlas URI)

### 1. Clone the repository
```bash
git clone https://github.com/YOUR_GITHUB_USERNAME/infinity-classes-online-test-app.git
cd infinity-classes-online-test-app
```

### 2. Install all dependencies
You can install dependencies for root, server, and client in one command:
```bash
npm run install-all
```
*(Or manually run `npm install` in root, `server/`, and `client/`)*

### 3. Configure Environment Variables
A default `.env` file is already provided in `server/.env`. If you want to use MongoDB Atlas, update `server/.env`:
```env
PORT=5000
MONGODB_URI=mongodb://127.0.0.1:27017/online_test_app
JWT_SECRET=supersecret_jwt_key_infinity_classes_2026
NODE_ENV=development
```

### 4. Seed the Database
Populate the database with the initial 15 multiple-choice questions and demo accounts:
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
The app will be served at [http://localhost:5000](http://localhost:5000).

---

## 🌐 Deployment Instructions (Live Link)

### Deploying to Render (Recommended - Free & 1-Click)
1. Push your repository to GitHub.
2. Sign in to [Render](https://render.com) and click **New +** -> **Web Service**.
3. Connect your GitHub repository.
4. Set the following configuration:
   - **Environment**: `Node`
   - **Build Command**: `npm run install-all && npm run build`
   - **Start Command**: `npm start`
5. In the **Environment Variables** section, add:
   - `NODE_ENV`: `production`
   - `JWT_SECRET`: `your_random_jwt_secret`
   - `MONGODB_URI`: *Your MongoDB Atlas connection string (free M0 tier)*
6. Click **Deploy Web Service**. Render will build the React client and serve it through Express with full API routing!

### Setting Up Free MongoDB Atlas
1. Create a free account at [mongodb.com/atlas](https://www.mongodb.com/atlas).
2. Create a free **M0 Sandbox** cluster.
3. Under **Database Access**, create a user (e.g. `admin` and password).
4. Under **Network Access**, allow access from anywhere (`0.0.0.0/0`).
5. Click **Connect** -> **Connect your application** (Drivers) and copy the connection string into your `MONGODB_URI` environment variable.

---

## 🔒 Security Best Practices Implemented

- **Answer Protection**: The `/api/questions/test` route deliberately strips out `correctOptionIndex` and `explanation` so examinees cannot inspect network payloads or devtools to see answers before submission.
- **Server-Side Evaluation**: Test scores are computed strictly on the backend by querying the verified question records from MongoDB.
- **Password Salting & Hashing**: Passwords are encrypted using `bcryptjs` with 10 salt rounds before persistence.
- **Session Protection**: JWT authentication protects user routes and ensures students can only review their own test attempts.

---

## 📬 Contact & Submission Details

- **Candidate**: Technical Assessment Applicant
- **Submitted to**: Dr. Nikhil Arora
- **Submission Date**: 22 November, 2026
- **Deadline**: 23 November, 2026
