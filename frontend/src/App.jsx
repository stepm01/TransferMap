import React, { useState, useEffect, useRef } from 'react';
import { 
  GraduationCap, Upload, CheckCircle2, Circle, User, Mail, Building2, BookOpen,
  ArrowRight, AlertTriangle, ExternalLink, Plus, Trash2, Loader2, CheckCircle,
  XCircle, AlertCircle, Sparkles, ChevronRight, School, Menu, X, Info, HelpCircle, Users,
  LogOut, FileText,
} from 'lucide-react';

import Dashboard from './Dashboard';
const MOCK_COLLEGES = [
  "De Anza College", "Foothill College", "Mission College", "West Valley College",
  "Ohlone College", "Las Positas College", "UCSC (Uc Santa Cruz)", "UCI (Uc Irvine)", "UCSD (Uc San Diego)", "UCB (Uc Berkeley)", "UCLA (Uc Los Angeles)", "UCD (Uc Davis)", "UCR (Uc Riverside)", "UCSB (Uc Santa Barbara)", "UCM (Uc Merced)"
];
import { useGoogleAuth } from './useGoogleAuth';
import { getFirestore, doc, getDoc, setDoc } from 'firebase/firestore';
import { auth } from './firebase';
import { addCourseToTranscript, removeCourseFromTranscript } from './fireData';
const db = getFirestore();

const OPENROUTER_API_KEY = "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";
const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";

const AI_MODEL = "anthropic/claude-opus-4.5";

const parseTranscriptWithAI = async (text) => {
  if (!OPENROUTER_API_KEY) throw new Error("OpenRouter API key not configured");
  const prompt = `Extract courses from this transcript as JSON array. Each course: {courseCode, courseName, units (number), grade, semester}. Return ONLY JSON array:\n\n${text}`;
  
  const response = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${OPENROUTER_API_KEY}`, 'HTTP-Referer': window.location.origin || 'http://localhost:5173', 'X-Title': 'TransferMap' },
    body: JSON.stringify({ model: AI_MODEL, messages: [{ role: "user", content: prompt }], temperature: 0.1, max_tokens: 2000 })
  });
  const data = await response.json();
  if (data.error) throw new Error(data.error.message);
  const content = data.choices[0]?.message?.content || "";
  const jsonMatch = content.match(/\[[\s\S]*\]/);
  if (jsonMatch) {
    return JSON.parse(jsonMatch[0]).map((c, i) => ({ id: Date.now() + i, courseCode: c.courseCode || "", courseName: c.courseName || "", units: parseFloat(c.units) || 3, grade: c.grade || "B", semester: c.semester || "Fall 2024" }));
  }
  throw new Error("Could not parse courses");
};

const verifyWithAI = async (courses, major, targetUC) => {
  console.log("🚀 Starting AI verification with model:", AI_MODEL);
  console.log("Courses:", courses);
  console.log("Major:", major);
  console.log("Target UC:", targetUC);
  
  if (!OPENROUTER_API_KEY) {
    console.error("❌ No API key!");
    throw new Error("OpenRouter API key not configured");
  }
  
  const coursesText = courses.map(c => `${c.courseCode} - ${c.courseName} (${c.units} units, Grade: ${c.grade})`).join('\n');
  
  const prompt = `You are a UC transfer advisor. Analyze these courses for transfer to ${targetUC} as a ${major} major.

STUDENT'S COURSES:
${coursesText}

MAJOR REQUIREMENTS FOR ${major.toUpperCase()}:
${getMajorRequirements(major)}

IMPORTANT - INTELLIGENT MATCHING:
- Match courses flexibly! "Calculus 2" = "Calculus II" = "Calc II" = "MATH 1B" = "MATH 3B"
- "Intro Programming" = "Introduction to Programming" = "CIS 22A" = "CS 1A"
- "Data Structures" = "CIS 22B" = "CS 1B"
- "Linear Algebra" = "MATH 21" = "MATH 6"
- Look at BOTH course code AND course name for matching!

Calculate GPA using: A=4.0, A-=3.7, B+=3.3, B=3.0, B-=2.7, C+=2.3, C=2.0, C-=1.7, D=1.0, F=0
Formula: Sum(grade_points * units) / total_units

Return ONLY this JSON structure (no markdown, no backticks, just raw JSON):
{
  "eligibility_status": "likely_eligible",
  "summary": { "gpa": "3.50", "total_units": 30, "major": "${major}", "target_uc": "${targetUC}" },
  "major_requirements": {
    "completed": [{"name": "Calculus I", "codes": ["MATH 1A"], "matched_course": "MATH 1A - Calculus I"}],
    "missing": [{"name": "Linear Algebra", "codes": ["MATH 21", "MATH 6"]}]
  },
  "risks": [{"type": "Units", "severity": "high", "message": "Need 60 units minimum"}],
  "igetc_status": {
    "1A": {"name": "English Composition", "completed": true},
    "2": {"name": "Mathematical Concepts", "completed": true}
  },
  "notes": ["Keep up the good work"],
  "sources": {"ucsc_transfer": "https://admissions.ucsc.edu/transfer/requirements", "assist_org": "https://assist.org"}
}`;

  console.log("📤 Sending request to OpenRouter...");
  
  try {
    const response = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json', 
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`, 
        'HTTP-Referer': window.location.origin || 'http://localhost:5173', 
        'X-Title': 'TransferMap' 
      },
      body: JSON.stringify({ 
        model: AI_MODEL, 
        messages: [{ role: "user", content: prompt }], 
        temperature: 0.2, 
        max_tokens: 3000 
      })
    });
    
    console.log("📥 Response status:", response.status);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error("❌ HTTP Error:", response.status, errorText);
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }
    
    const data = await response.json();
    console.log("📦 Response data:", data);
    
    if (data.error) {
      console.error("❌ API Error:", data.error);
      throw new Error(data.error.message || JSON.stringify(data.error));
    }
    
    const content = data.choices?.[0]?.message?.content || "";
    console.log("📝 AI Response content:", content);
    
    // Try to extract JSON from the response
    let jsonStr = content;
    
    // Remove markdown code blocks if present
    jsonStr = jsonStr.replace(/```json\s*/g, '').replace(/```\s*/g, '');
    
    // Try to find JSON object
    const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      console.log("✅ Found JSON:", jsonMatch[0].substring(0, 200) + "...");
      const results = JSON.parse(jsonMatch[0]);
      
      return {
        eligibility_status: results.eligibility_status || "conditional",
        summary: results.summary || { gpa: "0.00", total_units: 0, major, target_uc: targetUC },
        major_requirements: results.major_requirements || { completed: [], missing: [] },
        risks: results.risks || [],
        igetc_status: results.igetc_status || {},
        notes: results.notes || [],
        sources: results.sources || { ucsc_transfer: "https://admissions.ucsc.edu/transfer/requirements", assist_org: "https://assist.org" }
      };
    }
    
    console.error("❌ No JSON found in response");
    throw new Error("Could not find JSON in AI response");
    
  } catch (error) {
    console.error("❌ Verification error:", error);
    throw error;
  }
};

const getMajorRequirements = (major) => {
  const reqs = {
    "Computer Science": `- Calculus I (MATH 1A, MATH 3A, Calc I, Calculus 1)
- Calculus II (MATH 1B, MATH 3B, Calc II, Calculus 2)
- Intro Programming (CIS 22A, CS 1A, Programming I, Introduction to Programming)
- Data Structures (CIS 22B, CS 1B)
- Linear Algebra (MATH 21, MATH 6)
- Physics Mechanics (PHYS 4A, PHYS 1A, Physics I)
- Min GPA: 3.0 (3.4+ recommended)
- Min Units: 60`,
    "Biology": `- General Biology I & II
- General Chemistry I & II
- Organic Chemistry I
- Calculus I
- Physics
- Min GPA: 2.8
- Min Units: 60`,
    "Psychology": `- Intro Psychology
- Statistics
- Research Methods
- One Biology course
- Min GPA: 2.5
- Min Units: 60`
  };
  return reqs[major] || reqs["Computer Science"];
};

const generateFallbackResults = (courses, major, errorMsg) => {
  const gp = { "A": 4.0, "A-": 3.7, "B+": 3.3, "B": 3.0, "B-": 2.7, "C+": 2.3, "C": 2.0, "C-": 1.7, "D": 1.0, "F": 0 };
  let tp = 0, tu = 0;
  courses.forEach(c => { tp += (gp[c.grade] || 0) * c.units; tu += c.units; });
  const gpa = tu > 0 ? (tp / tu).toFixed(2) : "0.00";
  return {
    eligibility_status: parseFloat(gpa) >= 3.0 && tu >= 60 ? "likely_eligible" : "conditional",
    summary: { gpa, total_units: tu, major, target_uc: "UC Santa Cruz" },
    major_requirements: { completed: [], missing: [{ name: "AI unavailable - please try again", codes: ["Retry verification"] }] },
    risks: [{ type: "Verification Error", severity: "medium", message: errorMsg || "AI verification failed. Check console for details." }],
    igetc_status: {},
    notes: ["AI temporarily unavailable. Open browser console (F12) to see error details.", "Results show GPA and units only."],
    sources: { ucsc_transfer: "https://admissions.ucsc.edu/transfer/requirements", assist_org: "https://assist.org" }
  };
};

const updateUserFirestoreField = async (uid, fields) => {
  if (!uid) return;
  try { await setDoc(doc(db, "userInformation", uid), fields, { merge: true }); } catch (err) { console.error("Firestore error:", err); }
};

const MOCK_MAJORS = ["Computer Science", "Biology", "Psychology", "Computer Engineering", "Economics", "Electrical Engineering", "Philosophy", "Sociology", "Business Administration", "Mathematics", "EECS", "Physics", "Aerospace Engineering", "Environmental Science", "Anthropology", "Political Science", "History", "Chemistry", "Mechanical Engineering"];
const UC_CAMPUSES = [
  { id: "ucsc", name: "UC Santa Cruz", available: true,},
  { id: "ucb", name: "UC Berkeley", available: true },
  { id: "ucla", name: "UCLA", available: true },
  { id: "ucsd", name: "UC San Diego", available: true },
  { id: "ucd", name: "UC Davis", available: true },
  { id: "uci", name: "UC Irvine", available: true },
  { id: "ucr", name: "UC Riverside", available: true },
  { id: "ucsb", name: "UC Santa Barbara", available: true },
  { id: "ucm", name: "UC Merced", available: true },
];

function App() {
  const [currentStep, setCurrentStep] = useState(0);
  const [selectedUC, setSelectedUC] = useState(null);
  const [courses, setCourses] = useState([]);
  const [verificationResults, setVerificationResults] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [newCourse, setNewCourse] = useState({ courseCode: '', courseName: '', units: 3, grade: 'A', semester: 'Fall 2024' });
  const { user, isAuthenticated, showSignUp, handleGoogleSignIn, setUser, setShowSignUp, setIsAuthenticated } = useGoogleAuth();
  const [currentPage, setCurrentPage] = useState('home');
  const [isParsingTranscript, setIsParsingTranscript] = useState(false);
  const [parseError, setParseError] = useState(null);
  const [verificationError, setVerificationError] = useState(null);
  const fileInputRef = useRef(null);
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const profileDropdownRef = useRef(null);
  const [verificationStatus, setVerificationStatus] = useState(false);
  

  useEffect(() => {
    const fetchUserProfile = async () => {
      if (!user.uid) return;
      try {
        const userSnap = await getDoc(doc(db, "userInformation", user.uid));
        if (userSnap.exists()) {
          const data = userSnap.data();
          let updates = {};
          if (!user.major && data.major) updates.major = data.major;
          if (!user.communityCollege && data.communityCollege) updates.communityCollege = data.communityCollege;
          // Set photoURL from Firebase if it exists and not already set
          if (data.photoURL && !user.photoURL) updates.photoURL = data.photoURL;
          if (Object.keys(updates).length > 0) setUser(prev => ({ ...prev, ...updates }));
          if ((data.major || user.major) && (data.communityCollege || user.communityCollege)) setCurrentStep(1);
          const targetUC = user.targetUC || data.targetUC;
          if (targetUC) { setSelectedUC(targetUC); setUser(prev => ({ ...prev, targetUC })); setCurrentStep(2); }
        }
      } catch (err) { /* ignore */ }
    };
    fetchUserProfile();
  }, [user.uid]);

  useEffect(() => {
    const fetchTranscript = async () => {
      if (!user.uid) return;
      try {
        const snap = await getDoc(doc(db, "userInformation", user.uid));
        if (snap.exists() && snap.data().transcript) setCourses(snap.data().transcript);
      } catch (err) { console.error("Fetch transcript error:", err); }
    };
    fetchTranscript();
  }, [user.uid]);

  useEffect(() => {
    if (!profileDropdownOpen) return;
    const handleClick = (e) => { if (profileDropdownRef.current && !profileDropdownRef.current.contains(e.target)) setProfileDropdownOpen(false); };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [profileDropdownOpen]);

  const steps = [
    { id: 1, label: "Choose UC", icon: School, completed: selectedUC !== null },
    { id: 2, label: "Transcript", icon: Upload, completed: courses.length > 0 },
    { id: 3, label: "Results", icon: CheckCircle2, completed: verificationResults !== null },
  ];

  const handleProfileSubmit = (e) => { e.preventDefault(); if (user.name && user.major && user.communityCollege) setCurrentStep(1); };

  const addCourse = async () => {
    if (newCourse.courseCode && newCourse.courseName) {
      const courseWithId = { ...newCourse, id: Date.now() };
      setCourses(prev => [...prev, courseWithId]);
      setNewCourse({ courseCode: '', courseName: '', units: 3, grade: 'A', semester: 'Fall 2024' });
      if (user?.uid) try { await addCourseToTranscript(user.uid, courseWithId); } catch (err) { console.error(err); }
    }
  };

  const removeCourse = async (id) => {
    setCourses(prev => prev.filter(c => c.id !== id));
    if (user?.uid) try { await removeCourseFromTranscript(user.uid, id); } catch (err) { console.error(err); }
  };

  // AI-POWERED VERIFICATION
  const runVerification = async () => {
    setIsLoading(true);
    setVerificationError(null);

    console.log("========================================");
    console.log("🎯 STARTING VERIFICATION");
    console.log("Using model:", AI_MODEL);
    console.log("========================================");

    try {
      const ucName = UC_CAMPUSES.find(uc => uc.id === selectedUC)?.name || 'UC Santa Cruz';
      const results = await verifyWithAI(courses, user.major, ucName);
      console.log("✅ Verification successful!", results);
      setVerificationResults(results);
      setCurrentStep(3);
      // Save verification results to Firebase (full dataVerified object)
      if (user?.uid) {
        try {
          // Build a full "dataVerified" object with everything from results
          const dataVerified = {
            summary: results.summary,
            major_requirements: results.major_requirements,
            risks: results.risks,
            igetc_status: results.igetc_status,
            notes: results.notes,
            sources: results.sources,
            eligibility_status: results.eligibility_status,
            verifiedAt: new Date().toISOString()
          };
          // Save to Firebase under the user document
          await updateUserFirestoreField(user.uid, { dataVerified });
        } catch (err) {
          console.error("Error saving full verification results to Firebase:", err);
        }
      }
    } catch (error) {
      console.error("❌ VERIFICATION FAILED:", error);
      setVerificationError(error.message);
      const fallbackResults = generateFallbackResults(courses, user.major, error.message);
      setVerificationResults(fallbackResults);
      setCurrentStep(3);
      // Save fallback results to Firebase (full dataVerified object)
      if (user?.uid) {
        try {
          const dataVerified = {
            summary: fallbackResults.summary,
            major_requirements: fallbackResults.major_requirements,
            risks: fallbackResults.risks,
            igetc_status: fallbackResults.igetc_status,
            notes: fallbackResults.notes,
            sources: fallbackResults.sources,
            eligibility_status: fallbackResults.eligibility_status,
            verifiedAt: new Date().toISOString()
          };
          await updateUserFirestoreField(user.uid, { dataVerified });
        } catch (err) {
          console.error("Error saving full verification results to Firebase:", err);
        }
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
  const fetchVerifiedData = async () => {
    if (!user.uid) return;
    try {
      const snap = await getDoc(doc(db, "userInformation", user.uid));
      if (snap.exists()) {
        const data = snap.data();
        if (data.dataVerified) {
          setVerificationResults(data.dataVerified);
          setVerificationStatus(true); // mark verification complete
        }
      }
    } catch (err) {
      console.error("Error fetching verified data:", err);
    }
  };
  fetchVerifiedData();
}, [user.uid]);

  const handleTranscriptUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    setIsParsingTranscript(true);
    setParseError(null);

    try {
      if (file.type !== "text/plain") {
        setParseError("Please upload a .txt file");
        setIsParsingTranscript(false);
        return;
      }

      const text = await file.text();
      if (text.length < 20) {
        setParseError("File too short");
        setIsParsingTranscript(false);
        return;
      }

      // AI parses transcript
      const parsedCourses = await parseTranscriptWithAI(text);

      if (parsedCourses?.length > 0) {
        // Update local state
        setCourses(prev => [...prev, ...parsedCourses]);

        // Push all parsed courses to Firebase for the current user
        if (user?.uid) {
          try {
            const formattedCourses = parsedCourses.map(c => ({
              courseName: c.courseName || "",
              courseCode: c.courseCode || "",
              units: parseFloat(c.units) || 3,
              grade: c.grade || "B",
              semester: c.semester || "Fall 2024",
              id: Date.now() + Math.random()
            }));
            await updateUserFirestoreField(user.uid, { transcript: [...(courses || []), ...formattedCourses] });
          } catch (err) {
            console.error("Error adding AI-parsed courses to Firebase:", err);
          }
        }
      } else {
        setParseError("No courses found");
      }
    } catch (err) {
      setParseError(err.message);
    } finally {
      setIsParsingTranscript(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleUCSelect = async (ucId) => {
    setSelectedUC(ucId);
    if (user.uid) { await updateUserFirestoreField(user.uid, { targetUC: ucId }); setUser(prev => ({ ...prev, targetUC: ucId })); }
    setCurrentStep(2);
  };

  const renderNavBar = () => (
    <nav className="glass rounded-2xl mb-6 relative z-60">
      <div className="px-6 py-4">
        <div className="flex items-center justify-between">
          <button onClick={() => setCurrentPage('home')} className="flex items-center gap-3 hover:opacity-80 transition-opacity">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-ucsc-gold to-yellow-400 flex items-center justify-center shadow-lg"><GraduationCap className="w-6 h-6 text-ucsc-blue" /></div>
            <span className="font-display font-bold text-white text-lg hidden md:block">TransferMap</span>
          </button>
          <div className="hidden md:flex items-center gap-6">
            <button onClick={() => setCurrentPage('about')} className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${currentPage === 'about' ? 'bg-ucsc-gold/20 text-ucsc-gold' : 'text-white/70 hover:text-white hover:bg-white/10'}`}><Users className="w-4 h-4" /><span>About</span></button>
            <button onClick={() => setCurrentPage('faqs')} className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${currentPage === 'faqs' ? 'bg-ucsc-gold/20 text-ucsc-gold' : 'text-white/70 hover:text-white hover:bg-white/10'}`}><HelpCircle className="w-4 h-4" /><span>FAQs</span></button>
            <button onClick={() => setCurrentPage('info')} className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${currentPage === 'info' ? 'bg-ucsc-gold/20 text-ucsc-gold' : 'text-white/70 hover:text-white hover:bg-white/10'}`}><Info className="w-4 h-4" /><span>Resources</span></button>
            <button onClick={() => setCurrentPage('dashboard')} className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${currentPage === 'dashboard' ? 'bg-ucsc-gold/20 text-ucsc-gold' : 'text-white/70 hover:text-white hover:bg-white/10'}`}><Info className="w-4 h-4" /><span>Dashboard</span></button>
            {isAuthenticated && (
              <div className="relative" ref={profileDropdownRef}>
                <button onClick={() => setProfileDropdownOpen(v => !v)} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white font-semibold">
                  <User className="w-5 h-5 text-ucsc-gold" /><span>{user.name ? user.name.split(" ")[0] : "Profile"}</span>
                  <svg className={`w-4 h-4 transition-transform ${profileDropdownOpen ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M6 9l6 6 6-6" /></svg>
                </button>
                {profileDropdownOpen && (
                  <div className="absolute right-0 mt-2 w-56 bg-white rounded-2xl shadow-2xl z-50 p-2">
                    <button
                      onClick={() => {
                        setCurrentStep(0); // navigate to step 1
                        setShowSignUp(true); // display the profile form
                        setProfileDropdownOpen(false); // close the dropdown
                        setCurrentPage('home'); // ensure main content switches to home so step 1 shows
                      }}
                      className="flex items-center gap-2 w-full px-4 py-3 rounded-xl bg-ucsc-gold text-ucsc-blue font-semibold hover:bg-yellow-400 mb-1"
                    >
                      <User className="w-4 h-4" />Edit Profile
                    </button>
                    <button onClick={async () => { await auth.signOut(); setIsAuthenticated(false); setUser({}); setCurrentStep(0); setSelectedUC(null); setCourses([]); setVerificationResults(null); setCurrentPage('home'); setShowSignUp(false); setProfileDropdownOpen(false); window.location.reload(); }} className="flex items-center gap-2 w-full px-4 py-3 rounded-xl bg-red-500 text-white font-semibold hover:bg-red-600"><LogOut className="w-4 h-4" />Sign Out</button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  );

  const renderAboutUs = () => (
    <div className="animate-fade-in">
      <h2 className="font-display text-3xl font-bold text-white mb-6">About Us</h2>
      <div className="space-y-6">
        <div className="glass rounded-xl p-6"><h3 className="text-ucsc-gold text-xl font-semibold mb-3">Our Mission</h3><p className="text-white/70">TransferMap uses AI to help community college students verify UC transfer eligibility with intelligent course matching.</p></div>
        <div className="glass rounded-xl p-6"><h3 className="text-ucsc-gold text-xl font-semibold mb-3">Built at CruzHacks 2025</h3><p className="text-white/70">Developed at UC Santa Cruz's premier hackathon.</p></div>
      </div>
    </div>
  );

  const renderFAQs = () => (
    <div className="animate-fade-in">
      <h2 className="font-display text-3xl font-bold text-white mb-6">FAQs</h2>
      <div className="space-y-4">
        {[
          { q: "How does AI course matching work?", a: "Our AI understands that 'Calculus 2', 'Calc II', and 'MATH 1B' all refer to the same requirement. It matches intelligently!" },
          { q: "Is this official?", a: "No, always confirm with an academic counselor." },
          { q: "What GPA do I need?", a: "Minimum 2.4 for UC, but competitive majors like CS need 3.4+." },
        ].map((faq, idx) => (
          <div key={idx} className="glass rounded-xl p-6"><h3 className="text-ucsc-gold font-semibold mb-2 flex items-start gap-2"><HelpCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />{faq.q}</h3><p className="text-white/70 ml-7">{faq.a}</p></div>
        ))}
      </div>
    </div>
  );

  const renderExtraInfo = () => (
    <div className="animate-fade-in">
      <h2 className="font-display text-3xl font-bold text-white mb-6">Resources</h2>
      <div className="glass rounded-xl p-6">
        <div className="space-y-3">
          <a href="https://assist.org" target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 p-3 bg-white/5 rounded-lg hover:bg-white/10"><ExternalLink className="w-5 h-5 text-ucsc-gold" /><div><p className="text-white font-medium">ASSIST.org</p><p className="text-white/60 text-sm">Official course articulation</p></div></a>
          <a href="https://admissions.ucsc.edu/transfer/" target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 p-3 bg-white/5 rounded-lg hover:bg-white/10"><ExternalLink className="w-5 h-5 text-ucsc-gold" /><div><p className="text-white font-medium">UCSC Transfer</p><p className="text-white/60 text-sm">UC Santa Cruz transfer info</p></div></a>
        </div>
      </div>
    </div>
  );

  const renderLeftPanel = () => (
    <div className="flex flex-col h-full">
      <div className="glass rounded-2xl p-6 mb-4 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-ucsc-gold/20 to-transparent rounded-full blur-2xl" />
        <div className="flex items-center gap-4 mb-6">
          <div className="w-14 h-14 rounded-full overflow-hidden shadow-lg">
            {user.photoURL ? (
              <img src={user.photoURL} alt="Profile" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-ucsc-gold to-yellow-400 flex items-center justify-center">
                <User className="w-7 h-7 text-ucsc-blue" />
              </div>
            )}
          </div>
          <div><h3 className="font-display font-bold text-white text-lg">{user.name || 'Your Profile'}</h3><p className="text-white/60 text-sm">Transfer Student</p></div>
        </div>
        <div className="space-y-3">
          <div className="flex items-center gap-3 text-white/80"><Mail className="w-4 h-4 text-ucsc-gold" /><span className="text-sm truncate">{user.email || '—'}</span></div>
          <div className="flex items-center gap-3 text-white/80"><Building2 className="w-4 h-4 text-ucsc-gold" /><span className="text-sm">{user.communityCollege || '—'}</span></div>
          <div className="flex items-center gap-3 text-white/80"><BookOpen className="w-4 h-4 text-ucsc-gold" /><span className="text-sm">{user.major || '—'}</span></div>
        </div>
      </div>
      <div className="space-y-3">
        {steps.map((step, idx) => {
          const Icon = step.icon;
          const isActive = currentStep === idx + 1;
          const isCompleted = step.completed;
          const isDisabled = !isAuthenticated || (idx > 0 && !steps[idx - 1].completed);
          const canGoToStep = isAuthenticated && (!isDisabled || idx < currentStep - 1);
          return (
            <button key={step.id} onClick={() => canGoToStep && setCurrentStep(idx + 1)} disabled={!canGoToStep} className={`w-full flex items-center gap-4 p-4 rounded-xl transition-all ${isActive ? 'glass step-active' : 'bg-white/5 hover:bg-white/10'} ${!canGoToStep ? 'opacity-50 cursor-not-allowed' : ''}`}>
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isCompleted ? 'step-completed' : isActive ? 'bg-ucsc-gold/20 border-2 border-ucsc-gold' : 'bg-white/10'}`}>
                {isCompleted ? <CheckCircle2 className="w-5 h-5 text-ucsc-blue" /> : <Icon className={`w-5 h-5 ${isActive ? 'text-ucsc-gold' : 'text-white/60'}`} />}
              </div>
              <div className="text-left"><p className={`font-medium ${isActive ? 'text-white' : 'text-white/70'}`}>Step {step.id}</p><p className={`text-sm ${isActive ? 'text-ucsc-gold' : 'text-white/50'}`}>{step.label}</p></div>
              {isActive && <ChevronRight className="w-5 h-5 text-ucsc-gold ml-auto" />}
            </button>
          );
        })}
      </div>
      <div className="mt-auto pt-6"><div className="glass-dark rounded-xl p-4 text-center"><p className="text-white/60 text-xs mb-2">Powered by</p><p className="text-white font-display font-bold">Speed Bridgers at CruzHracks 2026</p></div></div>
    </div>
  );

  const renderWelcomeScreen = () => (
    <div className="h-full flex flex-col items-center justify-center text-center animate-fade-in">
      <div className="mb-8">
        <div className="w-24 h-24 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-ucsc-gold to-yellow-400 flex items-center justify-center shadow-2xl shadow-yellow-500/30 animate-float"><GraduationCap className="w-12 h-12 text-ucsc-blue" /></div>
        <h1 className="font-display text-4xl md:text-5xl font-bold text-white mb-4">UC Transfer Path<br /><span className="text-ucsc-gold">Verifier</span></h1>
        <p className="text-white/70 text-lg max-w-md mx-auto">AI-powered transfer eligibility verification with intelligent course matching.</p>
      </div>
      {!showSignUp ? (
        <div className="space-y-4 w-full max-w-sm">
          <button onClick={handleGoogleSignIn} className="btn-primary w-full flex items-center justify-center gap-3">
            <svg className="w-5 h-5" viewBox="0 0 24 24"><path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
            Sign in with Google
          </button>
          <p className="text-white/50 text-sm">Demo mode - click to continue</p>
        </div>
      ) : (
        <form onSubmit={handleProfileSubmit} className="w-full max-w-sm space-y-4 animate-slide-up">
          <div className="glass rounded-xl p-4 mb-4"><div className="flex items-center gap-3"><div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center"><CheckCircle className="w-5 h-5 text-emerald-400" /></div><div><p className="text-white/60 text-xs">Signed in as</p><p className="text-white font-medium">{user.email}</p></div></div></div>
          <input type="text" value={user.name} onChange={(e) => setUser({ ...user, name: e.target.value })} placeholder="Your Name" className="input-field" required />
          <select value={user.major} onChange={(e) => { setUser(prev => ({ ...prev, major: e.target.value })); if (user.uid) updateUserFirestoreField(user.uid, { major: e.target.value }); }} className="input-field" required><option value="" disabled>Select a major</option>{MOCK_MAJORS.map(m => <option key={m} value={m}>{m}</option>)}</select>
          <select value={user.communityCollege} onChange={(e) => { setUser(prev => ({ ...prev, communityCollege: e.target.value })); if (user.uid) updateUserFirestoreField(user.uid, { communityCollege: e.target.value }); }} className="input-field" required><option value="" disabled>Select your college</option>{MOCK_COLLEGES.map(c => <option key={c} value={c}>{c}</option>)}</select>
          <button type="submit" className="btn-primary w-full mt-6">Continue<ArrowRight className="w-5 h-5 inline ml-2" /></button>
        </form>
      )}
    </div>
  );

  const renderUCSelection = () => (
    <div className="animate-fade-in">
      
      <div className="mb-8">
        <h2 className="font-display text-3xl font-bold text-white mb-2">Choose Your Target UC</h2>
        <p className="text-white/60">Select the UC campus you want to transfer to.</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        {UC_CAMPUSES.map((uc) => (
          <label key={uc.id} className={`relative cursor-pointer ${!uc.available && 'opacity-50 cursor-not-allowed'}`}>
            <input
              type="radio"
              name="uc-selection"
              value={uc.id}
              checked={selectedUC === uc.id}
              onChange={() => uc.available && handleUCSelect(uc.id)}
              disabled={!uc.available}
              className="sr-only"
            />
            <div
              className={`p-5 rounded-xl border-2 transition-all ${
                selectedUC === uc.id
                  ? 'border-ucsc-gold bg-ucsc-gold/10 shadow-lg shadow-yellow-500/20'
                  : 'border-white/10 bg-white/5 hover:border-white/30'
              } ${!uc.available && 'pointer-events-none'}`}
            >
              <div className="flex items-center gap-3">
                <div
                  className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                    selectedUC === uc.id ? 'border-ucsc-gold bg-ucsc-gold' : 'border-white/40'
                  }`}
                >
                  {selectedUC === uc.id && <div className="w-2 h-2 rounded-full bg-ucsc-blue" />}
                </div>
                <div className="flex-1">
                  <p className="text-white font-medium">{uc.name}</p>
                  {!uc.available && <p className="text-white/40 text-xs">Coming soon</p>}
                </div>
                {uc.mascot && <span className="text-2xl">{uc.mascot}</span>}
              </div>
            </div>
          </label>
        ))}
      </div>
      {/* Bottom Back + Continue buttons */}
      <div className="flex gap-4 mt-6">
        <button onClick={() => setCurrentStep(0)} className="btn-secondary">Back</button>
        <button
          onClick={() => selectedUC && setCurrentStep(2)}
          disabled={!selectedUC}
          className={`btn-primary ${!selectedUC ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          Continue
          <ArrowRight className="w-5 h-5 inline ml-2" />
        </button>
      </div>
    </div>
  );

  const renderTranscriptEntry = () => (
    <div className="animate-fade-in">
      <div className="mb-8"><h2 className="font-display text-3xl font-bold text-white mb-2">Enter Your Courses</h2><p className="text-white/60">Upload your transcript or add courses manually. AI will intelligently match them to UC requirements!</p></div>
      
      {/* Upload Section */}
      <div className="glass rounded-xl p-6 mb-6 border border-ucsc-gold/30">
        <h3 className="text-white font-semibold mb-4 flex items-center gap-2"><FileText className="w-5 h-5 text-ucsc-gold" />Upload Transcript (AI-Powered)</h3>
        <p className="text-white/60 text-sm mb-4">Upload a .txt file and AI will extract your courses automatically.</p>
        <input ref={fileInputRef} type="file" accept=".txt" onChange={handleTranscriptUpload} className="hidden" />
        <button onClick={() => fileInputRef.current?.click()} disabled={isParsingTranscript} className="btn-secondary flex items-center gap-2">
          {isParsingTranscript ? <><Loader2 className="w-4 h-4 animate-spin" />Parsing...</> : <><Upload className="w-4 h-4" />Upload File</>}
        </button>
        {parseError && <div className="mt-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg"><p className="text-red-400 text-sm flex items-center gap-2"><AlertTriangle className="w-4 h-4" />{parseError}</p></div>}
      </div>

      {/* Manual Entry */}
      <div className="glass rounded-xl p-6 mb-6">
        <h3 className="text-white font-semibold mb-4 flex items-center gap-2"><Plus className="w-5 h-5 text-ucsc-gold" />Add Course Manually</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <input type="text" value={newCourse.courseCode} onChange={(e) => setNewCourse({ ...newCourse, courseCode: e.target.value.toUpperCase() })} placeholder="Course Code (e.g., MATH 1A)" className="input-field" />
          <input type="text" value={newCourse.courseName} onChange={(e) => setNewCourse({ ...newCourse, courseName: e.target.value })} placeholder="Course Name (e.g., Calculus I)" className="input-field" />
          <input type="number" value={newCourse.units} onChange={(e) => setNewCourse({ ...newCourse, units: parseFloat(e.target.value) })} min="1" max="10" className="input-field" />
          <select value={newCourse.grade} onChange={(e) => setNewCourse({ ...newCourse, grade: e.target.value })} className="input-field">{['A', 'A-', 'B+', 'B', 'B-', 'C+', 'C', 'C-', 'D', 'F', 'P'].map(g => <option key={g} value={g}>{g}</option>)}</select>
          <select value={newCourse.semester} onChange={(e) => setNewCourse({ ...newCourse, semester: e.target.value })} className="input-field">{['Fall 2024', 'Summer 2024', 'Spring 2024', 'Fall 2023', 'Spring 2023'].map(s => <option key={s} value={s}>{s}</option>)}</select>
          <button onClick={addCourse} disabled={!newCourse.courseCode || !newCourse.courseName} className="btn-secondary disabled:opacity-50"><Plus className="w-4 h-4 inline mr-1" />Add</button>
        </div>
      </div>

      {/* Course List */}
      {courses.length > 0 && (
        <div className="glass rounded-xl p-6 mb-6">
          <h3 className="text-white font-semibold mb-4">Your Courses ({courses.length})</h3>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {courses.map((course) => (
              <div key={course.id} className="flex items-center justify-between p-3 bg-white/5 rounded-lg hover:bg-white/10">
                <div className="flex items-center gap-4">
                  <span className="font-mono text-ucsc-gold font-semibold">{course.courseCode}</span>
                  <span className="text-white/80">{course.courseName}</span>
                  <span className="text-white/50 text-sm">{course.units}u</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`px-2 py-1 rounded text-sm font-medium ${['A', 'A-'].includes(course.grade) ? 'bg-emerald-500/20 text-emerald-300' : ['B+', 'B', 'B-'].includes(course.grade) ? 'bg-blue-500/20 text-blue-300' : 'bg-amber-500/20 text-amber-300'}`}>{course.grade}</span>
                  <button onClick={() => removeCourse(course.id)} className="p-1 text-white/40 hover:text-red-400"><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Demo */}
      <div className="glass-dark rounded-xl p-4 mb-6">
        <p className="text-white/60 text-sm mb-3"><Sparkles className="w-4 h-4 inline mr-1 text-ucsc-gold" />Demo: Load sample courses</p>
        <button onClick={() => setCourses([
          { id: 1, courseCode: 'MATH 1A', courseName: 'Calculus I', units: 5, grade: 'A', semester: 'Fall 2023' },
          { id: 2, courseCode: 'MATH 1B', courseName: 'Calculus II', units: 5, grade: 'A-', semester: 'Spring 2024' },
          { id: 3, courseCode: 'CIS 22A', courseName: 'Intro to Programming', units: 4.5, grade: 'B+', semester: 'Fall 2023' },
          { id: 4, courseCode: 'CIS 22B', courseName: 'Data Structures', units: 4.5, grade: 'B', semester: 'Spring 2024' },
          { id: 5, courseCode: 'EWRT 1A', courseName: 'English Composition', units: 5, grade: 'A', semester: 'Fall 2023' },
          { id: 6, courseCode: 'PHYS 4A', courseName: 'Physics - Mechanics', units: 5, grade: 'B+', semester: 'Fall 2024' },
        ])} className="text-ucsc-gold text-sm hover:underline">Load sample transcript →</button>
      </div>

      <div className="flex gap-4">
        <button onClick={() => setCurrentStep(1)} className="btn-secondary">Back</button>
        <button onClick={runVerification} disabled={courses.length === 0 || isLoading} className={`btn-primary ${(courses.length === 0 || isLoading) && 'opacity-50 cursor-not-allowed'}`}>
          {isLoading ? <><Loader2 className="w-5 h-5 inline mr-2 animate-spin" />AI Analyzing...</> : <><Sparkles className="w-5 h-5 inline mr-2" />Verify with AI</>}
        </button>
      </div>
      {verificationError && <div className="mt-4 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg"><p className="text-amber-400 text-sm">⚠️ {verificationError} - Check browser console (F12) for details</p></div>}
    </div>
  );

  const renderResults = () => {
    if (!verificationResults) return null;
    const { eligibility_status, summary, major_requirements, risks, igetc_status, notes, sources } = verificationResults;
    const statusConfig = {
      likely_eligible: { icon: CheckCircle, color: 'text-emerald-400', bg: 'bg-emerald-500/20', border: 'border-emerald-500/30', title: 'Likely Eligible', description: 'You appear to meet the basic transfer requirements!' },
      conditional: { icon: AlertCircle, color: 'text-amber-400', bg: 'bg-amber-500/20', border: 'border-amber-500/30', title: 'Conditionally Eligible', description: 'You meet some requirements but have items to address.' },
      not_yet_eligible: { icon: XCircle, color: 'text-red-400', bg: 'bg-red-500/20', border: 'border-red-500/30', title: 'Not Yet Eligible', description: 'There are requirements you need to complete first.' }
    };
    const status = statusConfig[eligibility_status] || statusConfig.conditional;
    const StatusIcon = status.icon;

    return (
      <div className="animate-fade-in space-y-6">
        <div className={`${status.bg} ${status.border} border rounded-2xl p-6`}>
          <div className="flex items-start gap-4">
            <div className={`w-14 h-14 rounded-full ${status.bg} flex items-center justify-center`}><StatusIcon className={`w-8 h-8 ${status.color}`} /></div>
            <div className="flex-1"><h2 className={`font-display text-2xl font-bold ${status.color} mb-1`}>{status.title}</h2><p className="text-white/70">{status.description}</p></div>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="glass rounded-xl p-4 text-center"><p className="text-white/50 text-sm mb-1">GPA</p><p className="text-2xl font-bold text-white">{summary.gpa}</p></div>
          <div className="glass rounded-xl p-4 text-center"><p className="text-white/50 text-sm mb-1">Units</p><p className="text-2xl font-bold text-white">{summary.total_units}</p></div>
          <div className="glass rounded-xl p-4 text-center"><p className="text-white/50 text-sm mb-1">Major Prep</p><p className="text-2xl font-bold text-white">{major_requirements.completed?.length || 0}/{(major_requirements.completed?.length || 0) + (major_requirements.missing?.length || 0)}</p></div>
          <div className="glass rounded-xl p-4 text-center"><p className="text-white/50 text-sm mb-1">Target</p><p className="text-lg font-bold text-ucsc-gold">{summary.target_uc}</p></div>
        </div>

        {risks && risks.length > 0 && (
          <div className="glass rounded-xl p-6">
            <h3 className="text-white font-semibold mb-4 flex items-center gap-2"><AlertTriangle className="w-5 h-5 text-amber-400" />Issues to Address</h3>
            <div className="space-y-3">{risks.map((risk, idx) => (<div key={idx} className={`p-4 rounded-lg border ${risk.severity === 'high' ? 'bg-red-500/10 border-red-500/30' : 'bg-amber-500/10 border-amber-500/30'}`}><p className={`font-medium ${risk.severity === 'high' ? 'text-red-300' : 'text-amber-300'}`}>{risk.type}</p><p className="text-white/70 text-sm">{risk.message}</p></div>))}</div>
          </div>
        )}

        <div className="glass rounded-xl p-6">
          <h3 className="text-white font-semibold mb-4">Major Preparation Courses (AI-Matched)</h3>
          {major_requirements.completed && major_requirements.completed.length > 0 && (
            <div className="mb-4"><p className="text-emerald-400 text-sm mb-2">✓ Completed</p><div className="space-y-2">{major_requirements.completed.map((req, idx) => (<div key={idx} className="flex items-center gap-3 p-2 bg-emerald-500/10 rounded-lg"><CheckCircle className="w-4 h-4 text-emerald-400" /><span className="text-white/80">{req.name}</span>{req.matched_course && <span className="text-emerald-300 text-sm ml-auto">← {req.matched_course}</span>}</div>))}</div></div>
          )}
          {major_requirements.missing && major_requirements.missing.length > 0 && (
            <div><p className="text-red-400 text-sm mb-2">✗ Missing</p><div className="space-y-2">{major_requirements.missing.map((req, idx) => (<div key={idx} className="p-2 bg-red-500/10 rounded-lg"><div className="flex items-center gap-2"><Circle className="w-4 h-4 text-red-400" /><span className="text-white/80">{req.name}</span></div><p className="text-white/40 text-xs ml-6">Take: {req.codes?.join(' or ') || 'See advisor'}</p></div>))}</div></div>
          )}
        </div>

        {igetc_status && Object.keys(igetc_status).length > 0 && (
          <div className="glass rounded-xl p-6">
            <h3 className="text-white font-semibold mb-4">IGETC Status</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">{Object.entries(igetc_status).map(([area, info]) => (<div key={area} className={`p-3 rounded-lg text-center border ${info.completed ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-white/5 border-white/10'}`}><p className={`text-sm font-medium ${info.completed ? 'text-emerald-400' : 'text-white/60'}`}>Area {area}</p><p className="text-white/50 text-xs truncate">{info.name}</p>{info.completed ? <CheckCircle className="w-4 h-4 text-emerald-400 mx-auto mt-1" /> : <Circle className="w-4 h-4 text-white/30 mx-auto mt-1" />}</div>))}</div>
          </div>
        )}

        <div className="glass-dark rounded-xl p-6">
          {notes && notes.length > 0 && (<><h3 className="text-white/70 font-semibold mb-3">Notes</h3><ul className="space-y-2 mb-4">{notes.map((note, idx) => <li key={idx} className="text-white/60 text-sm flex items-start gap-2"><span className="text-ucsc-gold">•</span>{note}</li>)}</ul></>)}
          <div className="pt-4 border-t border-white/10"><p className="text-white/50 text-xs mb-2">Sources:</p><div className="flex flex-wrap gap-2"><a href={sources?.ucsc_transfer || "https://admissions.ucsc.edu/transfer"} target="_blank" rel="noopener noreferrer" className="text-ucsc-lightBlue text-xs hover:underline flex items-center gap-1">UC Transfer<ExternalLink className="w-3 h-3" /></a><a href={sources?.assist_org || "https://assist.org"} target="_blank" rel="noopener noreferrer" className="text-ucsc-lightBlue text-xs hover:underline flex items-center gap-1">Assist.org<ExternalLink className="w-3 h-3" /></a></div></div>
          <div className="mt-4 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg"><p className="text-amber-300/80 text-xs"><AlertTriangle className="w-3 h-3 inline mr-1" /><strong>Disclaimer:</strong> AI-powered verification. Always confirm with a counselor.</p></div>
        </div>

        <div className="flex gap-4">
          <button onClick={() => { setVerificationResults(null); setCurrentStep(2); }} className="btn-secondary">Edit Transcript</button>
          <button onClick={() => window.print()} className="btn-primary">Save Results</button>
        </div>
      </div>
    );
  };

  const renderRightPanel = () => {
    if (!isAuthenticated) return renderWelcomeScreen();
    switch (currentStep) {
      case 1: return renderUCSelection();
      case 2: return renderTranscriptEntry();
      case 3: return renderResults();
      default: return renderWelcomeScreen();
    }
  };

  const renderMainContent = () => {
    switch (currentPage) {
      case 'home': return (<div className="flex flex-col lg:flex-row gap-6 h-full min-h-[calc(100vh-12rem)]"><div className="lg:w-80 flex-shrink-0">{renderLeftPanel()}</div><div className="flex-1 glass rounded-2xl p-6 md:p-8 overflow-y-auto">{renderRightPanel()}</div></div>);
      case 'about': return <div className="glass rounded-2xl p-8 min-h-[calc(100vh-12rem)]">{renderAboutUs()}</div>;
      case 'faqs': return <div className="glass rounded-2xl p-8 min-h-[calc(100vh-12rem)]">{renderFAQs()}</div>;
      case 'info': return <div className="glass rounded-2xl p-8 min-h-[calc(100vh-12rem)]">{renderExtraInfo()}</div>;
      case 'dashboard': return <div className="glass rounded-2xl p-8 min-h-[calc(100vh-12rem)]"><Dashboard verificationResults={verificationResults} user={user} /></div>;
      default: return null;
    }
  };

  return (
    <div className="min-h-screen relative overflow-hidden">
      <div className="fixed inset-0 gradient-bg opacity-50" />
      <div className="fixed inset-0 noise-overlay" />
      <div className="wave-container"><div className="wave" /></div>
      <div className="relative z-10 min-h-screen p-4 md:p-6 lg:p-8">
        <div className="max-w-7xl mx-auto h-full space-y-2">
          <div className="sticky top-0 z-20 w-full py-4">{renderNavBar()}</div>
          {renderMainContent()}
        </div>
      </div>
    </div>
  );
}

export default App;

