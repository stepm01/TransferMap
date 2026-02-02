# TransferMap - UC Transfer Path Verifier🎓

> A hackathon project for CruzHacks 2026 - Helping California community college students verify their UC transfer eligibility using official sources.

![React](https://img.shields.io/badge/React-18.2-61DAFB?style=flat-square&logo=react)
![FastAPI](https://img.shields.io/badge/FastAPI-0.128-009688?style=flat-square&logo=fastapi)
![Tailwind](https://img.shields.io/badge/Tailwind-3.4-38B2AC?style=flat-square&logo=tailwindcss)

## 🎯 The Problem

Transfer students often receive inconsistent advising - different counselors say different things, university websites are hard to navigate and sometimes misleading. This leads to costly mistakes, delayed graduations, and unnecessary stress.

## 💡 Our Solution

A tool where California community college students can:
1. Enter the classes they've taken and their target major
2. The tool checks Assist.org and official UC pages
3. See a clear checklist of what's completed, what's missing, and any risks
4. Get direct links to official sources

**This is NOT advice - it's a source-backed second opinion.**

## ✨ Features

- **Google Authentication** - Secure sign-in with your school email
- **Smart Course Entry** - Add your courses manually or load demo data
- **Real-time Verification** - Check eligibility against official requirements
- **Clear Results** - See exactly what's done, what's missing, and risks
- **Official Sources** - Every result links back to Assist.org and UC pages
- **Beautiful UI** - UCSC-themed design with smooth animations

## 🛠️ Tech Stack

### Frontend
- **React 18** - UI library
- **Vite** - Build tool
- **Tailwind CSS** - Styling
- **Lucide React** - Icons
- **Firebase Auth** - Google sign-in

### Backend
- **Python 3.11+** - Runtime
- **FastAPI** - API framework
- **SQLAlchemy** - ORM (optional)
- **Pydantic** - Data validation

### Data Sources
- Assist.org API (mock data for demo)
- UCSC Transfer Requirements

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- Python 3.11+
- npm or yarn

### Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

The frontend will be available at `http://localhost:3000`

### Backend Setup

```bash
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

The API will be available at `http://localhost:8000`

### Firebase Setup (Optional for Demo)

1. Create a Firebase project at https://console.firebase.google.com
2. Enable Google Authentication
3. Create a `.env` file in the frontend folder:

```env
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
```

## 📁 Project Structure

```
cruzhacks-transfer-tool/
├── frontend/
│   ├── src/
│   │   ├── App.jsx           # Main app component
│   │   ├── main.jsx          # Entry point
│   │   ├── index.css         # Global styles
│   │   ├── firebase.js       # Firebase config
│   │   └── services/
│   │       └── api.js        # API service
│   ├── index.html
│   ├── package.json
│   ├── tailwind.config.js
│   └── vite.config.js
├── backend/
│   ├── app/
│   │   ├── main.py           # FastAPI app
│   │   ├── db/
│   │   │   └── database.py   # Database config
│   │   ├── models/
│   │   │   └── models.py     # SQLAlchemy models
│   │   └── services/
│   │       ├── eligibility.py # Verification logic
│   │       └── explainer.py   # AI explanations
│   └── requirements.txt
└── README.md
```

## 🎮 Demo Flow

1. **Welcome Screen** - Click "Sign in with Google"
2. **Profile Setup** - Enter name, major, and community college
3. **Choose UC** - Select UCSC (other UCs coming soon)
4. **Enter Courses** - Add your transcript manually or load demo data
5. **Verify** - Click "Verify My Eligibility"
6. **Results** - See your eligibility status, completed/missing requirements, and risks

## 📊 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/colleges` | Get list of community colleges |
| GET | `/api/majors` | Get supported majors |
| GET | `/api/uc-campuses` | Get UC campus list |
| POST | `/api/auth/register` | Register new user |
| POST | `/api/select-uc` | Select target UC |
| POST | `/api/transcript/upload` | Upload transcript courses |
| POST | `/api/verify/{email}` | Run eligibility verification |

## 🔮 Future Features

- [ ] PDF transcript parsing
- [ ] All UC campuses
- [ ] More majors
- [ ] Real Assist.org API integration
- [ ] AI-powered course recommendations
- [ ] Transfer application timeline
- [ ] Community college course search

## 👥 Team

Built with ❤️ at CruzHacks 2026

## 📜 Disclaimer

**This tool is for informational purposes only.** It does not provide official advice or guarantees. Always verify information with an academic counselor and official university sources before making any decisions about your education.

## 📄 License

MIT License - See LICENSE file for details
